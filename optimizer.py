"""
optimizer.py
============
Dinamik rota simülasyonu ve optimizasyon.

Her durak hesaplanırken current_time ve durağın lat/lon'u kullanılarak
o ana ait hava ve trafik verisi çekilir. Bu sayede sıra değişikliğinden
veya gecikmeden doğan çevresel farklılıklar tahmine yansır.

Akış:
  1. simulate_route        — mevcut sırayı simüle eder (karşılaştırma bazı)
  2. optimize_stop_order   — greedy nearest-neighbor + time-window urgency
  3. Her iki fonksiyon da per-stop dinamik lookup kullanır

Cascade modeli (BUG FIX):
  Eskiden travel_min (effective_speed) + service + stop_delay(historical) eklenirdi.
  Ama historical mean_delay_min ≈ travel inflation → effective_speed'te zaten
  var → çift sayım → 8 stop sonra saatler kayıyordu.
  Yeni: cascade sadece travel + (service × service_inflation). stop_delay
  sadece risk göstergesi olarak output'a koyulur, current_time'a eklenmez.
"""

import pandas as pd
from datetime import timedelta
from typing import List

from data_loader import haversine, get_weather_at, get_traffic_at, lookup_effective_speed
from predictor import DelayPredictor


# Sivas lojistik hub — tüm rotalar buradan başlar/biter.
# route_stops.csv'de stop_sequence=1'in distance_from_prev_km değeri
# bu noktadan o durağa olan mesafedir.
DEPOT_LAT = 39.7477
DEPOT_LON = 37.0179


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------

def _travel_minutes(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
    road_type: str,
    traffic_level: str,
    weather_condition: str,
    circuity: dict,
    speed_table: dict,
) -> float:
    """
    A→C kenarı için seyahat süresi tahmini (veri-güdümlü).
    road_km ≈ haversine × circuity_factor[road_type]
    speed   = effective_speed_table[(road, traffic, weather)]
    """
    straight_km = haversine(lat1, lon1, lat2, lon2)
    cf = circuity.get(road_type, 1.4)
    road_km = straight_km * cf
    speed = lookup_effective_speed(road_type, traffic_level, weather_condition, speed_table)
    return (road_km / speed) * 60.0


def _first_leg_minutes(
    stop: pd.Series,
    traffic_level: str,
    weather_condition: str,
    circuity: dict,
    speed_table: dict,
) -> float:
    """
    Depo → ilk seçilen durak seyahat süresi.

    BUG FIX: Eskiden `stop["distance_from_prev_km"]` kullanılıyordu. Ama
    bu alan CSV'de ORİJİNAL sequence'a göre tanımlı — yani sequence=5'in
    distance_from_prev_km'si depodan değil stop 4'ten olan mesafedir.
    Optimizer farklı bir ilk durak seçtiğinde bu değer yanlış (bir ara
    leg'i depo→stop mesafesi sanarak). Sabit depodan haversine × circuity
    kullanıyoruz — tüm leg'ler için tutarlı.
    """
    lat = float(stop["latitude"])
    lon = float(stop["longitude"])
    road = str(stop["road_type"])
    straight_km = haversine(DEPOT_LAT, DEPOT_LON, lat, lon)
    cf = circuity.get(road, 1.4)
    road_km = straight_km * cf
    speed = lookup_effective_speed(road, traffic_level, weather_condition, speed_table)
    return (road_km / speed) * 60.0


def _dynamic_conditions(
    lat: float,
    lon: float,
    road_type: str,
    current_time: pd.Timestamp,
    weather_df: pd.DataFrame,
    traffic_df: pd.DataFrame,
) -> dict:
    """Durağın konumuna ve o anki saate göre dinamik hava + trafik."""
    w = get_weather_at(lat, lon, current_time, weather_df)
    t = get_traffic_at(lat, lon, current_time, road_type, traffic_df)
    return {
        "weather_condition": str(w["weather_condition"]),
        "traffic_level": str(t["traffic_level"]),
        "congestion_ratio": float(t["congestion_ratio"]),
        "delay_risk_score": float(w["delay_risk_score"]),
        "road_surface": str(w.get("road_surface_condition", "dry")),
        "precipitation_mm": float(w["precipitation_mm"]),
        "visibility_km": float(w["visibility_km"]),
        "wind_speed_kmh": float(w["wind_speed_kmh"]),
    }


def _stop_result(
    stop: pd.Series,
    arrival: pd.Timestamp,
    travel_min: float,
    stop_delay_min: float,
    new_sequence: int,
    dynamic: dict,
) -> dict:
    window_open = pd.Timestamp(stop["time_window_open"])
    window_close = pd.Timestamp(stop["time_window_close"])
    in_window = window_open <= arrival <= window_close
    planned_arr = pd.Timestamp(stop["planned_arrival"])
    deviation_min = (arrival - planned_arr).total_seconds() / 60.0

    return {
        "stop_id": str(stop["stop_id"]),
        "stop_sequence": new_sequence,
        "original_sequence": int(stop["stop_sequence"]),
        "latitude": float(stop["latitude"]),
        "longitude": float(stop["longitude"]),
        "road_type": str(stop["road_type"]),
        "predicted_arrival": arrival.isoformat(),
        "planned_arrival": planned_arr.isoformat(),
        "arrival_deviation_min": round(deviation_min, 1),
        "time_window_open": window_open.isoformat(),
        "time_window_close": window_close.isoformat(),
        "within_time_window": bool(in_window),
        "predicted_travel_min": round(travel_min, 1),
        "predicted_stop_delay_min": round(stop_delay_min, 1),   # historical risk — INFO only
        "package_count": int(stop["package_count"]),
        "package_weight_kg": float(stop["package_weight_kg"]),
        "dynamic_conditions": {
            "weather": dynamic["weather_condition"],
            "traffic": dynamic["traffic_level"],
            "congestion_ratio": round(dynamic["congestion_ratio"], 3),
            "delay_risk_score": round(dynamic["delay_risk_score"], 3),
            "road_surface": dynamic["road_surface"],
        },
    }


# ---------------------------------------------------------------------------
# Simülasyon (orijinal sıra)
# ---------------------------------------------------------------------------

def simulate_route(
    stops_df: pd.DataFrame,
    route_info: dict,
    predictor: DelayPredictor,
    hist_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    traffic_df: pd.DataFrame,
    circuity: dict,
    speed_table: dict,
    service_inflation: float,
    initial_weather: str,
    initial_traffic: str,
) -> List[dict]:
    """
    Mevcut durak sırasını simüle eder.

    Cascade: current_time += travel_min + (planned_service × service_inflation)
    stop_delay cascade'den ÇIKARILDI (historical lookup çift sayım yapıyordu).
    """
    results = []
    current_time = pd.Timestamp(route_info["departure_planned"])

    prev_lat = None
    prev_lon = None

    for idx, (_, stop) in enumerate(stops_df.iterrows()):
        lat = float(stop["latitude"])
        lon = float(stop["longitude"])
        road_type = str(stop["road_type"])

        # Hareket BAŞLANGICINDA dinamik koşul (yol boyunca bu koşul hakim)
        pre_dyn = _dynamic_conditions(lat, lon, road_type, current_time, weather_df, traffic_df)

        if idx == 0:
            # İlk durak: distance_from_prev_km gerçek yol mesafesi
            travel_min = _first_leg_minutes(stop, pre_dyn["traffic_level"],
                                            pre_dyn["weather_condition"],
                                            circuity, speed_table)
        else:
            travel_min = _travel_minutes(
                prev_lat, prev_lon, lat, lon, road_type,
                pre_dyn["traffic_level"], pre_dyn["weather_condition"],
                circuity, speed_table,
            )

        current_time += timedelta(minutes=travel_min)

        # Pencere açılmadıysa bekle (gerçek kurye davranışı).
        window_open = pd.Timestamp(stop["time_window_open"])
        if current_time < window_open:
            current_time = window_open

        # Varış anındaki dinamik koşul (stop_delay ve display için)
        final_dyn = _dynamic_conditions(lat, lon, road_type, current_time, weather_df, traffic_df)

        stop_delay = predictor.predict_stop_delay(
            road_type=road_type,
            traffic_level=final_dyn["traffic_level"],
            weather_condition=final_dyn["weather_condition"],
            hour=current_time.hour,
            hist_df=hist_df,
        )

        results.append(_stop_result(stop, current_time, travel_min, stop_delay, idx + 1, final_dyn))

        # Cascade: yalnızca servis süresi × inflation. stop_delay EKLENMEZ.
        service_min = float(stop["planned_service_min"]) * service_inflation
        current_time += timedelta(minutes=service_min)
        prev_lat, prev_lon = lat, lon

    return results


# ---------------------------------------------------------------------------
# Optimizasyon (greedy nearest-neighbor + time-window urgency)
# ---------------------------------------------------------------------------

def optimize_stop_order(
    stops_df: pd.DataFrame,
    route_info: dict,
    predictor: DelayPredictor,
    hist_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    traffic_df: pd.DataFrame,
    circuity: dict,
    speed_table: dict,
    service_inflation: float,
    initial_weather: str,
    initial_traffic: str,
) -> List[dict]:
    """
    Greedy nearest-neighbor.

    Skor = travel + window_penalty - urgency_bonus
    Travel hesaplaması DİNAMİK koşullarla yapılır (BUG FIX):
    aday stop'un ETA'sındaki hava/trafik ile — statik değil.
    Bu sayede "akşam trafiğini kaçır" / "kar başlamadan önce dağdan in"
    gibi zaman-farkındalı kararlar alınabilir.
    """
    current_time = pd.Timestamp(route_info["departure_planned"])
    # İlk bacak için çıkış noktası yok — her aday için distance_from_prev_km kullan.
    cur_lat = None
    cur_lon = None
    first_leg = True

    remaining = stops_df.copy().reset_index(drop=True)
    visited: List[dict] = []

    while not remaining.empty:
        best_score = float("inf")
        best_idx = 0
        best_dynamic = {}
        best_travel = 0.0

        for i, row in remaining.iterrows():
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            road_type = str(row["road_type"])

            # Yol boyunca kullanılacak koşulu, o anki saat + aday konum ile çek
            leg_dyn = _dynamic_conditions(lat, lon, road_type, current_time, weather_df, traffic_df)

            if first_leg:
                # İlk bacak: distance_from_prev_km gerçek yol mesafesi
                travel = _first_leg_minutes(row, leg_dyn["traffic_level"],
                                            leg_dyn["weather_condition"],
                                            circuity, speed_table)
            else:
                # Dinamik koşullarla route — sabit initial_* değil (BUG FIX)
                travel = _travel_minutes(
                    cur_lat, cur_lon, lat, lon, road_type,
                    leg_dyn["traffic_level"], leg_dyn["weather_condition"],
                    circuity, speed_table,
                )

            eta = current_time + timedelta(minutes=travel)
            arrival_dyn = _dynamic_conditions(lat, lon, road_type, eta, weather_df, traffic_df)

            window_open = pd.Timestamp(row["time_window_open"])
            window_close = pd.Timestamp(row["time_window_close"])

            # Gerçek servis başlangıcı: eta ile window_open'ın max'ı.
            # Varışta pencere açılmamışsa beklenir.
            service_start = max(eta, window_open)
            wait_min = (service_start - eta).total_seconds() / 60.0
            minutes_until_close = (window_close - current_time).total_seconds() / 60.0

            # Ceza: eğer servis penceresi kapandıktan sonra başlayacaksa
            if service_start > window_close:
                overrun = (service_start - window_close).total_seconds() / 60.0
                penalty = 2000.0 + overrun * 8.0
            elif (window_close - service_start).total_seconds() / 60.0 < 10:
                # Pencere kapanmasına 10 dk'dan az kaldı — riskli
                penalty = 200.0
            else:
                penalty = 0.0

            # Bekleme süresi sıkı ceza — optimizer çok erken varmaya
            # teşvik edilmesin, penceresi açık olan stop'ları tercih etsin.
            penalty += wait_min * 2.0

            # Urgency bonus: sadece HÂLÂ YAKALANABİLİR stop'lar için.
            # BUG FIX: Eskiden max(1.0, minutes_until_close) vardı — negatif
            # değer (pencere zaten kapalı) 1.0'a yuvarlanıp 900 max-bonus alıyordu.
            if travel < minutes_until_close < 120 and wait_min < 30:
                slack = (window_close - service_start).total_seconds() / 60.0
                urgency_bonus = 600.0 / max(5.0, slack)
            else:
                urgency_bonus = 0.0

            # Total "effective time" = travel + wait; optimizer bunu minimize etsin
            score = travel + wait_min * 0.5 + penalty - urgency_bonus
            if score < best_score:
                best_score = score
                best_idx = i
                best_dynamic = arrival_dyn
                best_travel = travel

        chosen = remaining.loc[best_idx]
        lat = float(chosen["latitude"])
        lon = float(chosen["longitude"])
        road_type = str(chosen["road_type"])

        current_time += timedelta(minutes=best_travel)

        # Pencere açılmadıysa bekle (gerçek kurye davranışı).
        chosen_window_open = pd.Timestamp(chosen["time_window_open"])
        if current_time < chosen_window_open:
            current_time = chosen_window_open

        # Varışta final dinamik koşul (kayıt için)
        final_dynamic = _dynamic_conditions(lat, lon, road_type, current_time, weather_df, traffic_df)

        stop_delay = predictor.predict_stop_delay(
            road_type=road_type,
            traffic_level=final_dynamic["traffic_level"],
            weather_condition=final_dynamic["weather_condition"],
            hour=current_time.hour,
            hist_df=hist_df,
        )

        visited.append(
            _stop_result(chosen, current_time, best_travel, stop_delay, len(visited) + 1, final_dynamic)
        )

        # Cascade: sadece servis × inflation
        service_min = float(chosen["planned_service_min"]) * service_inflation
        current_time += timedelta(minutes=service_min)
        cur_lat, cur_lon = lat, lon
        first_leg = False
        remaining = remaining.drop(best_idx).reset_index(drop=True)

    return visited


# ---------------------------------------------------------------------------
# Metrik hesaplama
# ---------------------------------------------------------------------------

def compute_metrics(stops_results: List[dict]) -> dict:
    """
    On-time rate: zaman penceresine zamanında girme oranı.
    Total predicted delay: plana göre sapma (varış - planlanan_varış), pozitif toplam.
    predicted_stop_delay_min (historical) sadece bilgi amaçlı; toplamı ayrı alan olarak.
    """
    total = len(stops_results)
    if total == 0:
        return {
            "total_stops": 0, "on_time_stops": 0, "on_time_rate": 0.0,
            "total_predicted_delay_min": 0.0, "avg_delay_per_stop_min": 0.0,
            "historical_risk_sum_min": 0.0,
        }
    on_time = sum(1 for s in stops_results if s["within_time_window"])
    schedule_deviation = sum(max(0.0, s.get("arrival_deviation_min", 0.0)) for s in stops_results)
    hist_risk = sum(s["predicted_stop_delay_min"] for s in stops_results)
    return {
        "total_stops": total,
        "on_time_stops": on_time,
        "on_time_rate": round(on_time / total, 3),
        "total_predicted_delay_min": round(schedule_deviation, 1),
        "avg_delay_per_stop_min": round(schedule_deviation / total, 1),
        "historical_risk_sum_min": round(hist_risk, 1),
    }
