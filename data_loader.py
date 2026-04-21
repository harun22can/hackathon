"""
data_loader.py
==============
Veri yükleme, birleştirme ve AI eğitimi için feature matrisi oluşturma.

Veri ilişkileri:
  routes (1) ──── (N) route_stops       [route_id üzerinden]
  routes              traffic_segments  [coğrafi yakınlık — Haversine]
  routes              weather_observations [coğrafi yakınlık — Haversine]
  route_stops         historical_delay_stats [road_type × traffic × weather × time_bucket]

Gecikme mekanizması:
  overall_delay_factor = f(traffic_level, incident_severity, weather_condition)
  Stop seviyesi gecikme = planned_travel_min × delay_factor + service delay
"""

import pandas as pd
import numpy as np
from math import radians, cos, sin, asin, sqrt
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Temel coğrafi yardımcı
# ---------------------------------------------------------------------------

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki koordinat arasındaki kuş uçuşu mesafe (km)."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * R * asin(sqrt(max(0.0, a)))


# ---------------------------------------------------------------------------
# Ham veri yükleme
# ---------------------------------------------------------------------------

def load_all() -> tuple:
    """
    Tüm 5 CSV dosyasını yükler.
    Döndürür: (routes, stops, traffic, weather, hist)
    """
    routes = pd.read_csv(
        DATA_DIR / "routes.csv",
        parse_dates=["departure_planned", "departure_actual"],
    )
    stops = pd.read_csv(
        DATA_DIR / "route_stops.csv",
        parse_dates=[
            "planned_arrival", "actual_arrival",
            "time_window_open", "time_window_close",
        ],
    )
    traffic = pd.read_csv(DATA_DIR / "traffic_segments.csv", parse_dates=["timestamp"])
    weather = pd.read_csv(DATA_DIR / "weather_observations.csv", parse_dates=["timestamp"])
    hist = pd.read_csv(DATA_DIR / "historical_delay_stats.csv")
    return routes, stops, traffic, weather, hist


# ---------------------------------------------------------------------------
# Internal Circuity Factor
# ---------------------------------------------------------------------------

def compute_circuity_factors(stops: pd.DataFrame) -> dict:
    """
    Her road_type için Internal Circuity Factor hesaplar:
        CF = road_distance_km / haversine_km

    Veri setindeki bilinen durak çiftlerinden türetilir — dışarıdan veri kullanılmaz.
    Bilinmeyen yollar (örn. A→C verisi yokken) için CF ile tahmin edilebilir:
        road_km ≈ haversine(A, C) × CF[road_type]
    """
    buckets: dict = {}
    sorted_stops = stops.sort_values(["route_id", "stop_sequence"])

    for _, group in sorted_stops.groupby("route_id"):
        rows = group.reset_index(drop=True)
        for i in range(1, len(rows)):
            prev, curr = rows.iloc[i - 1], rows.iloc[i]
            road_dist = float(curr["distance_from_prev_km"])
            straight = haversine(
                float(prev["latitude"]), float(prev["longitude"]),
                float(curr["latitude"]), float(curr["longitude"]),
            )
            if straight < 0.5:
                continue
            ratio = road_dist / straight
            if not (0.5 <= ratio <= 8.0):
                continue
            buckets.setdefault(str(curr["road_type"]), []).append(ratio)

    result = {}
    counts = {}
    for rt, vals in buckets.items():
        result[rt] = float(np.median(vals))
        counts[rt] = len(vals)

    # Varsayılan değerler — veri setinde görülmemiş road_type için
    defaults = {"highway": 1.10, "urban": 1.35, "rural": 1.45, "mountain": 1.65}
    for rt, default in defaults.items():
        result.setdefault(rt, default)
        counts.setdefault(rt, 0)
    return result, counts


# ---------------------------------------------------------------------------
# Effective Speed Table — (road_type × traffic × weather) → gerçek hız (km/h)
# ---------------------------------------------------------------------------
#
# Mantık: veri setinde ardışık durak çiftleri (A→B) için
#   distance_from_prev_km ve actual_travel_min biliniyor.
# Buradan "o yol türünde, o trafik ve hava koşulunda kurye gerçekte ne hızda
# gidiyor?" sorusu empirik olarak cevaplanır.
# Optimizer A→C kenarını icat ederken sabit BASE_SPEED yerine bu tabloyu
# kullanır — "A urban, C urban, trafik yoğun, yağmur" için veri ne diyorsa.
# ---------------------------------------------------------------------------

def compute_speed_table(
    routes: pd.DataFrame,
    stops: pd.DataFrame,
) -> tuple:
    """
    (road_type, traffic_level, weather_condition) → median effective speed (km/h)
    Geri dönüş: (speed_table, count_table)

    Aykırı değerler (5 km/h altı, 130 km/h üstü) filtrelenir.
    Çok kısa segmentler (0.5 km altı) ölçüm gürültüsü içerdiği için çıkarılır.
    """
    rt_info = routes[["route_id", "traffic_level", "weather_condition"]]
    merged = stops.merge(rt_info, on="route_id", how="left")

    valid = (
        (merged["actual_travel_min"] > 1.0)
        & (merged["distance_from_prev_km"] > 0.5)
    )
    df = merged[valid].copy()
    df["effective_speed_kmh"] = (
        df["distance_from_prev_km"] / (df["actual_travel_min"] / 60.0)
    )
    # Fiziksel olarak imkansız değerleri ayıkla
    df = df[(df["effective_speed_kmh"] >= 5.0) & (df["effective_speed_kmh"] <= 130.0)]

    speed_table: dict = {}
    count_table: dict = {}
    for (rt, tl, wc), group in df.groupby(["road_type", "traffic_level", "weather_condition"]):
        speed_table[(str(rt), str(tl), str(wc))] = float(group["effective_speed_kmh"].median())
        count_table[(str(rt), str(tl), str(wc))] = int(len(group))

    return speed_table, count_table


# BASE_SPEED — fallback default'ları (tablo hiç örnek içermiyorsa)
DEFAULT_BASE_SPEED = {"highway": 90.0, "urban": 45.0, "rural": 65.0, "mountain": 40.0}


def compute_service_inflation(stops: pd.DataFrame) -> float:
    """
    Gerçek/planlanan servis süresi oranı — tüm duraklar için medyan.

    Veri seti istatistiği: actual_service_min / planned_service_min.
    Teslimat sırasında paket sayısı, asansör, park gibi gecikmeler
    planlananın üstüne çıkar. Medyanı alarak aykırı değerlerden korunuyoruz.

    Cascade'de `service_min × inflation` olarak kullanılır.
    """
    valid = stops[
        (stops["planned_service_min"] > 0.1)
        & (stops["actual_service_min"] > 0.1)
    ]
    if valid.empty:
        return 1.22
    ratio = valid["actual_service_min"] / valid["planned_service_min"]
    return float(ratio.median())


def lookup_effective_speed(
    road_type: str,
    traffic_level: str,
    weather_condition: str,
    speed_table: dict,
) -> float:
    """
    Kademeli fallback:
      1. Tam eşleşme (road × traffic × weather)
      2. road × traffic (hava marjinalleştir)
      3. road (hava + trafik marjinalleştir)
      4. DEFAULT_BASE_SPEED[road_type]
      5. 55 km/h (yol türü de bilinmiyorsa)
    """
    key = (road_type, traffic_level, weather_condition)
    if key in speed_table:
        return speed_table[key]

    same_road_traffic = [
        v for (rt, tl, _wc), v in speed_table.items()
        if rt == road_type and tl == traffic_level
    ]
    if same_road_traffic:
        return float(np.median(same_road_traffic))

    same_road = [v for (rt, _tl, _wc), v in speed_table.items() if rt == road_type]
    if same_road:
        return float(np.median(same_road))

    return DEFAULT_BASE_SPEED.get(road_type, 55.0)


# ---------------------------------------------------------------------------
# Dinamik coğrafi + zamansal lookup yardımcıları
# ---------------------------------------------------------------------------

def get_weather_at(
    lat: float,
    lon: float,
    timestamp: pd.Timestamp,
    weather_df: pd.DataFrame,
) -> pd.Series:
    """
    Belirli bir koordinat VE saate en uygun hava gözlemini döndürür.

    Strateji (kademeli fallback):
      1. Aynı saat (hour_of_day eşleşmesi) → en yakın koordinat
      2. ±2 saat aralığı                   → en yakın koordinat
      3. Tüm gözlemler                      → en yakın koordinat

    Bu sayede kurye bir durağa 2 saat geç varırsa (current_time değişmiş),
    o saate ait hava koşullarıyla tahmin yapılır.
    """
    hour = timestamp.hour
    hours_of_day = weather_df["timestamp"].dt.hour

    for window in [0, 2, 24]:          # 0 = tam eşleşme, 2 = ±2 saat, 24 = hepsi
        if window == 24:
            subset = weather_df
        else:
            lo = (hour - window) % 24
            hi = (hour + window) % 24
            if lo <= hi:
                mask = hours_of_day.between(lo, hi)
            else:                        # gece yarısı geçişi (ör: 23→1)
                mask = (hours_of_day >= lo) | (hours_of_day <= hi)
            subset = weather_df[mask]

        if subset.empty:
            continue

        dists = subset.apply(
            lambda r: haversine(lat, lon, float(r["latitude"]), float(r["longitude"])),
            axis=1,
        )
        return subset.loc[dists.idxmin()]

    # Bu noktaya ulaşılmamalı; güvenlik ağı
    return weather_df.iloc[0]


def get_traffic_at(
    lat: float,
    lon: float,
    timestamp: pd.Timestamp,
    road_type: str,
    traffic_df: pd.DataFrame,
) -> pd.Series:
    """
    Belirli bir koordinat, saat ve yol türüne en uygun trafik segmentini döndürür.

    Strateji (kademeli fallback):
      1. Aynı hour_of_day + aynı road_type → en yakın koordinat
      2. Aynı hour_of_day (road_type yok)  → en yakın koordinat
      3. ±1 saat + aynı road_type          → en yakın koordinat
      4. ±1 saat (road_type yok)           → en yakın koordinat
      5. Tüm segmentler                    → en yakın koordinat

    Böylece kurye gece yarısına geç kalırsa gece saatine ait düşük trafik
    verisi kullanılır; rush-hour'da erken varırsa yoğun trafik yansır.
    """
    hour = traffic_df["hour_of_day"]
    h = timestamp.hour

    candidates = [
        (traffic_df["hour_of_day"] == h) & (traffic_df["road_type"] == road_type),
        (traffic_df["hour_of_day"] == h),
        (traffic_df["hour_of_day"].between(max(0, h - 1), min(23, h + 1))) & (traffic_df["road_type"] == road_type),
        (traffic_df["hour_of_day"].between(max(0, h - 1), min(23, h + 1))),
        pd.Series([True] * len(traffic_df), index=traffic_df.index),
    ]

    for mask in candidates:
        subset = traffic_df[mask]
        if subset.empty:
            continue
        dists = subset.apply(
            lambda r: haversine(lat, lon, float(r["center_lat"]), float(r["center_lon"])),
            axis=1,
        )
        return subset.loc[dists.idxmin()]

    return traffic_df.iloc[0]


# Eski isimler — geriye dönük uyumluluk için ince sarmalayıcılar
def get_nearest_weather(lat: float, lon: float, weather_df: pd.DataFrame) -> pd.Series:
    return get_weather_at(lat, lon, pd.Timestamp.now(), weather_df)


def get_nearest_traffic(lat: float, lon: float, road_type: str, traffic_df: pd.DataFrame) -> pd.Series:
    return get_traffic_at(lat, lon, pd.Timestamp.now(), road_type, traffic_df)


# ---------------------------------------------------------------------------
# Stop-seviyesi özellik agregasyonu (rota başına)
# ---------------------------------------------------------------------------

def _aggregate_stops(stops: pd.DataFrame) -> pd.DataFrame:
    """
    route_stops tablosundan rota başına özet istatistikler üretir.
    Bu değerler, rota seviyesi modelin zenginleştirilmesinde kullanılır.
    """
    agg = (
        stops.groupby("route_id")
        .agg(
            avg_delay_probability=("delay_probability", "mean"),
            max_delay_probability=("delay_probability", "max"),
            missed_window_count=("missed_time_window", "sum"),
            total_packages=("package_count", "sum"),
            total_weight_kg=("package_weight_kg", "sum"),
            pct_mountain=("road_type", lambda x: (x == "mountain").mean()),
            pct_highway=("road_type", lambda x: (x == "highway").mean()),
            pct_urban=("road_type", lambda x: (x == "urban").mean()),
            pct_rural=("road_type", lambda x: (x == "rural").mean()),
            mean_actual_travel=("actual_travel_min", "mean"),
            mean_planned_travel=("planned_travel_min", "mean"),
        )
        .reset_index()
    )
    # Durak bazında gerçek/planlanan seyahat oranı (1.0 = tam zamanında)
    agg["stop_travel_ratio"] = (
        agg["mean_actual_travel"] / agg["mean_planned_travel"].replace(0, np.nan)
    ).fillna(1.0)
    return agg


# ---------------------------------------------------------------------------
# AI eğitimine hazır birleşik feature matrisi
# ---------------------------------------------------------------------------

def build_training_features(
    routes: pd.DataFrame,
    stops: pd.DataFrame,
    traffic: pd.DataFrame,
    weather: pd.DataFrame,
) -> pd.DataFrame:
    """
    Rota + durak + trafik + hava verilerini birleştirerek
    Random Forest eğitimine hazır, tek bir DataFrame döndürür.

    Özellik kaynakları:
      - routes.csv        : hava, trafik, araç, planlama bilgileri
      - route_stops.csv   : road_type dağılımı, gecikme olasılığı ortalaması
      - traffic_segments  : rota merkezine en yakın trafik segmentinin congestion_ratio
      - weather_observations: rota merkezine en yakın istasyonun delay_risk_score

    Hedef değişken: total_delay_min (negatif değerler 0 ile klipslenmiş)
    """
    df = routes.copy()

    # --- Zaman özellikleri ---
    dep = pd.to_datetime(df["departure_planned"])
    df["hour"] = dep.dt.hour
    df["day_of_week"] = dep.dt.dayofweek
    df["month"] = dep.dt.month
    df["is_rush_hour"] = df["hour"].apply(lambda h: 1 if h in range(7, 10) or h in range(17, 20) else 0)
    df["is_night"] = df["hour"].apply(lambda h: 1 if h >= 22 or h <= 5 else 0)

    # --- Kategorik encoding (ordinal, ML için anlamlı sıra) ---
    weather_order = ["clear", "cloudy", "fog", "wind", "rain", "snow"]
    traffic_order = ["low", "moderate", "high", "congested"]
    vehicle_order = ["motorcycle", "car", "van", "truck"]

    def safe_ordinal(series: pd.Series, order: list) -> pd.Series:
        mapping = {v: i for i, v in enumerate(order)}
        return series.map(mapping).fillna(len(order) // 2).astype(int)

    df["weather_enc"] = safe_ordinal(df["weather_condition"], weather_order)
    df["traffic_enc"] = safe_ordinal(df["traffic_level"], traffic_order)
    df["vehicle_enc"] = safe_ordinal(df["vehicle_type"], vehicle_order)

    # --- Bileşik hava riski skoru ---
    # precipitation + düşük visibility + yüksek rüzgar → yüksek risk
    df["weather_risk"] = (
        df["precipitation_mm"].clip(0, 20) / 20.0 * 0.4
        + (1.0 - df["visibility_km"].clip(0, 30) / 30.0) * 0.3
        + df["wind_speed_kmh"].clip(0, 60) / 60.0 * 0.3
    )

    # --- Rota merkezini hesapla (en yakın hava/trafik araması için) ---
    stop_centers = (
        stops.groupby("route_id")[["latitude", "longitude"]]
        .mean()
        .rename(columns={"latitude": "center_lat", "longitude": "center_lon"})
        .reset_index()
    )
    df = df.merge(stop_centers, on="route_id", how="left")

    # --- En yakın trafik segmentinin congestion_ratio ---
    def nearest_congestion(row):
        if pd.isna(row.get("center_lat")):
            return 0.2
        dists = traffic.apply(
            lambda t: haversine(
                float(row["center_lat"]), float(row["center_lon"]),
                float(t["center_lat"]), float(t["center_lon"]),
            ),
            axis=1,
        )
        return float(traffic.iloc[dists.idxmin()]["congestion_ratio"])

    df["nearest_congestion_ratio"] = df.apply(nearest_congestion, axis=1)

    # --- En yakın hava istasyonunun delay_risk_score ---
    def nearest_weather_risk(row):
        if pd.isna(row.get("center_lat")):
            return 0.3
        dists = weather.apply(
            lambda w: haversine(
                float(row["center_lat"]), float(row["center_lon"]),
                float(w["latitude"]), float(w["longitude"]),
            ),
            axis=1,
        )
        return float(weather.iloc[dists.idxmin()]["delay_risk_score"])

    df["nearest_weather_risk"] = df.apply(nearest_weather_risk, axis=1)

    # --- Durak özeti (routes ile birleştir) ---
    stop_agg = _aggregate_stops(stops)
    df = df.merge(stop_agg, on="route_id", how="left")

    # --- Hedef değişken ---
    df["target_delay_min"] = df["total_delay_min"].clip(lower=0)

    # --- Son feature listesi ---
    feature_cols = [
        "route_id",
        # Hava
        "weather_enc", "temperature_c", "precipitation_mm",
        "wind_speed_kmh", "humidity_pct", "visibility_km", "weather_risk",
        # Trafik
        "traffic_enc", "nearest_congestion_ratio",
        # Kaza
        "road_incident", "incident_severity",
        # Araç / rota
        "vehicle_enc", "num_stops", "total_distance_km",
        # Zaman
        "hour", "day_of_week", "month", "is_rush_hour", "is_night",
        # Durak istatistikleri (route_stops → aggregate)
        "avg_delay_probability", "max_delay_probability",
        "pct_mountain", "pct_highway", "pct_urban", "pct_rural",
        "stop_travel_ratio", "total_packages", "total_weight_kg",
        # Hava istasyonu riski
        "nearest_weather_risk",
        # Hedef
        "target_delay_min",
    ]

    available = [c for c in feature_cols if c in df.columns]
    return df[available].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Model feature sütunları (route_id ve target hariç)
# ---------------------------------------------------------------------------

MODEL_FEATURE_COLS = [
    "weather_enc", "temperature_c", "precipitation_mm",
    "wind_speed_kmh", "humidity_pct", "visibility_km", "weather_risk",
    "traffic_enc", "nearest_congestion_ratio",
    "road_incident", "incident_severity",
    "vehicle_enc", "num_stops", "total_distance_km",
    "hour", "day_of_week", "month", "is_rush_hour", "is_night",
    # NOT: stop_travel_ratio, avg_delay_probability, max_delay_probability kaldırıldı —
    # bunlar actual_travel_min'den türetildiği için target'ı sızdırıyorlardı (data leakage).
    # Model gerçek senaryoda (yeni rota, actual yok) çöker.
    "pct_mountain", "pct_highway", "pct_urban", "pct_rural",
    "total_packages", "total_weight_kg",
    "nearest_weather_risk",
]
