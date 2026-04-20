from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pathlib import Path

from data_loader import load_all, compute_circuity_factors, compute_speed_table, haversine
from predictor import DelayPredictor
from optimizer import simulate_route, optimize_stop_order, compute_metrics

# ---------------------------------------------------------------------------
# Application state (populated at startup)
# ---------------------------------------------------------------------------
state: dict = {}


MODEL_PATH = Path(__file__).parent / "models" / "delay_predictor.pkl"


@asynccontextmanager
async def lifespan(app: FastAPI):
    routes, stops, traffic, weather, hist = load_all()

    predictor = DelayPredictor()
    if MODEL_PATH.exists():
        try:
            predictor.load(MODEL_PATH)
            # Kayıtlı modelde metrikler yok — feature importance'tan özet üret
            train_stats = {
                "mae_min": None,
                "r2": None,
                "source": "loaded_from_disk",
                "features_used": len(predictor._feature_cols),
                "top_features": dict(
                    sorted(
                        zip(predictor._feature_cols, predictor.model.feature_importances_.round(4)),
                        key=lambda x: -x[1],
                    )[:6]
                ),
            }
            print(f"Model diskten yüklendi: {MODEL_PATH.name}")
        except Exception as exc:
            print(f"Model yüklenemedi ({exc}) — sıfırdan eğitiliyor...")
            train_stats = predictor.train(routes, stops, traffic, weather)
            predictor.save(MODEL_PATH)
    else:
        train_stats = predictor.train(routes, stops, traffic, weather)
        predictor.save(MODEL_PATH)
        print(f"Model eğitildi ve kaydedildi: {MODEL_PATH.name}")

    circuity, circuity_counts = compute_circuity_factors(stops)
    speed_table, speed_counts = compute_speed_table(routes, stops)

    state["routes"] = routes
    state["stops"] = stops
    state["traffic"] = traffic
    state["weather"] = weather
    state["hist"] = hist
    state["predictor"] = predictor
    state["circuity"] = circuity          # flat CF dict — used by optimizer
    state["circuity_counts"] = circuity_counts  # sample counts — exposed in API
    state["speed_table"] = speed_table    # (road,traffic,weather) → km/h
    state["speed_counts"] = speed_counts
    state["train_stats"] = train_stats

    print("=" * 60)
    print("Akıllı Lojistik API — hazır")
    print(f"  Model MAE  : {train_stats.get('mae_min')} dakika")
    print(f"  Model R²   : {train_stats.get('r2')}")
    print(f"  Circuity   : {circuity}")
    print(f"  Speed tbl. : {len(speed_table)} kombinasyon ({sum(speed_counts.values())} örnek)")
    print("=" * 60)
    yield


app = FastAPI(
    title="Akıllı Lojistik Rota Optimizasyonu",
    description="Sivas bölgesi kurye rota optimizasyonu — hava, trafik ve kaza verisiyle.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — frontend'in API'ye istek atabilmesi için
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static + Root
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent / "static"
INDEX_FILE = STATIC_DIR / "index.html"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    """Gerçek favicon dosyasını servis et."""
    from fastapi.responses import FileResponse
    import os
    
    # Dosya yolunu belirle (sunucuyu başlattığın yere göre değişebilir)
    favicon_path = os.path.join("static", "favicon.ico")
    
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    else:
        # Dosya yoksa hata vermemesi için boş dönmeye devam etsin (veya 404)
        from fastapi.responses import Response
        return Response(status_code=204)

@app.get("/", response_class=HTMLResponse, tags=["Meta"])
def root():
    """Komuta Merkezi — ana arayüz."""
    return FileResponse(str(INDEX_FILE), media_type="text/html")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class OptimizeRequest(BaseModel):
    weather_condition: Optional[str] = None
    traffic_level: Optional[str] = None


class PredictRequest(BaseModel):
    weather_condition: str = "clear"
    traffic_level: str = "low"
    vehicle_type: str = "van"
    num_stops: int = 5
    total_distance_km: float = 100.0
    temperature_c: float = 20.0
    precipitation_mm: float = 0.0
    wind_speed_kmh: float = 10.0
    humidity_pct: float = 50.0
    visibility_km: float = 20.0
    road_incident: int = 0
    incident_severity: float = 0.0
    hour: int = 10
    day_of_week: int = 1


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _resolve_route(route_id: str) -> dict:
    routes: pd.DataFrame = state["routes"]
    row = routes[routes["route_id"] == route_id]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Route '{route_id}' not found.")
    return row.iloc[0].to_dict()


def _compute_delay_factor(route_info: dict, predicted_delay_min: float) -> float:
    planned = float(route_info.get("planned_duration_min", 1))
    if planned <= 0:
        return 1.0
    # Üst sınır 1.45 — fazla kötümserliği önler.
    # delay_factor * congestion_penalty bileşik etkisini dengede tutar.
    raw = (planned + predicted_delay_min) / planned
    return min(max(1.0, raw), 1.45)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Meta"])
def health():
    ts = state.get("train_stats", {})
    return {
        "status": "ok",
        "model": {
            "mae_min": ts.get("mae_min"),
            "r2": ts.get("r2"),
            "top_features": ts.get("top_features"),
        },
        "circuity_factors": state.get("circuity"),
        "loaded_routes": len(state.get("routes", [])),
        "loaded_stops": len(state.get("stops", [])),
    }


@app.get("/routes", tags=["Routes"])
def list_routes(limit: int = Query(50, ge=1, le=200)):
    routes: pd.DataFrame = state["routes"]
    cols = [
        "route_id", "vehicle_type", "num_stops", "total_distance_km",
        "planned_duration_min", "actual_duration_min", "total_delay_min",
        "on_time_delivery_rate", "weather_condition", "traffic_level",
    ]
    return routes[cols].head(limit).to_dict(orient="records")


@app.get("/routes/{route_id}", tags=["Routes"])
def get_route(route_id: str):
    route_info = _resolve_route(route_id)
    stops_df = (
        state["stops"][state["stops"]["route_id"] == route_id]
        .sort_values("stop_sequence")
    )
    return {
        "route": route_info,
        "stops": stops_df.to_dict(orient="records"),
    }


@app.post("/optimize/{route_id}", tags=["Optimization"])
def optimize_route(route_id: str, req: OptimizeRequest):
    """
    Simulate the original stop order AND re-optimize using greedy nearest-neighbour
    with time-window urgency. Returns both orderings with metrics for comparison.
    """
    route_info = _resolve_route(route_id)
    stops_df = (
        state["stops"][state["stops"]["route_id"] == route_id]
        .sort_values("stop_sequence")
        .reset_index(drop=True)
    )

    weather = req.weather_condition or str(route_info["weather_condition"])
    traffic = req.traffic_level or str(route_info["traffic_level"])

    dep = pd.Timestamp(route_info["departure_planned"])

    # ── Feature Alignment: compute route-specific values from actual stops ──
    pct_mountain = float((stops_df["road_type"] == "mountain").mean())
    pct_highway  = float((stops_df["road_type"] == "highway").mean())
    pct_urban    = float((stops_df["road_type"] == "urban").mean())
    pct_rural    = float((stops_df["road_type"] == "rural").mean())
    total_packages  = int(stops_df["package_count"].sum()) if "package_count" in stops_df.columns else 30
    total_weight_kg = float(stops_df["package_weight_kg"].sum()) if "package_weight_kg" in stops_df.columns else 100.0

    # Nearest traffic congestion at route centroid
    center_lat = float(stops_df["latitude"].mean())
    center_lon = float(stops_df["longitude"].mean())
    traffic_df = state["traffic"]
    t_dists = traffic_df.apply(
        lambda t: haversine(center_lat, center_lon, float(t["center_lat"]), float(t["center_lon"])),
        axis=1,
    )
    nearest_congestion = float(traffic_df.iloc[t_dists.idxmin()]["congestion_ratio"])

    predicted_delay_min = state["predictor"].predict_route_delay(
        weather_condition=weather,
        temperature_c=float(route_info["temperature_c"]),
        precipitation_mm=float(route_info["precipitation_mm"]),
        wind_speed_kmh=float(route_info["wind_speed_kmh"]),
        humidity_pct=float(route_info["humidity_pct"]),
        visibility_km=float(route_info["visibility_km"]),
        traffic_level=traffic,
        road_incident=int(route_info["road_incident"]),
        incident_severity=float(route_info["incident_severity"]),
        num_stops=int(route_info["num_stops"]),
        total_distance_km=float(route_info["total_distance_km"]),
        hour=dep.hour,
        day_of_week=dep.dayofweek,
        month=dep.month,                          # ← Seasonal intelligence fix
        vehicle_type=str(route_info["vehicle_type"]),
        pct_mountain=pct_mountain,                # ← Feature alignment
        pct_highway=pct_highway,
        pct_urban=pct_urban,
        pct_rural=pct_rural,
        total_packages=total_packages,
        total_weight_kg=total_weight_kg,
        nearest_congestion_ratio=nearest_congestion,
    )

    delay_factor = _compute_delay_factor(route_info, predicted_delay_min)
    route_info["predicted_delay_factor"] = delay_factor

    original_stops = simulate_route(
        stops_df, route_info, state["predictor"], state["hist"],
        state["weather"], state["traffic"], state["circuity"], state["speed_table"],
        initial_weather=weather, initial_traffic=traffic,
    )
    original_metrics = compute_metrics(original_stops)

    optimized_stops = optimize_stop_order(
        stops_df, route_info, state["predictor"], state["hist"],
        state["weather"], state["traffic"], state["circuity"], state["speed_table"],
        initial_weather=weather, initial_traffic=traffic,
    )
    optimized_metrics = compute_metrics(optimized_stops)

    improvement = {
        "on_time_rate_delta": round(
            optimized_metrics["on_time_rate"] - original_metrics["on_time_rate"], 3
        ),
        "delay_reduction_min": round(
            original_metrics["total_predicted_delay_min"]
            - optimized_metrics["total_predicted_delay_min"],
            1,
        ),
    }

    return {
        "route_id": route_id,
        "conditions": {"weather": weather, "traffic": traffic},
        "rf_predicted_total_delay_min": round(predicted_delay_min, 1),
        "delay_factor": round(delay_factor, 3),
        "original_order": {"metrics": original_metrics, "stops": original_stops},
        "optimized_order": {"metrics": optimized_metrics, "stops": optimized_stops},
        "improvement": improvement,
    }


@app.post("/predict", tags=["Prediction"])
def predict_delay(req: PredictRequest):
    """Predict total route delay (minutes) for arbitrary input conditions."""
    delay = state["predictor"].predict_route_delay(
        weather_condition=req.weather_condition,
        temperature_c=req.temperature_c,
        precipitation_mm=req.precipitation_mm,
        wind_speed_kmh=req.wind_speed_kmh,
        humidity_pct=req.humidity_pct,
        visibility_km=req.visibility_km,
        traffic_level=req.traffic_level,
        road_incident=req.road_incident,
        incident_severity=req.incident_severity,
        num_stops=req.num_stops,
        total_distance_km=req.total_distance_km,
        hour=req.hour,
        day_of_week=req.day_of_week,
        vehicle_type=req.vehicle_type,
    )
    return {
        "predicted_delay_min": round(delay, 1),
        "conditions": req.model_dump(),
    }


@app.get("/stats/circuity", tags=["Meta"])
def get_circuity():
    """Return Internal Circuity Factors with sample counts per road type."""
    cf     = state.get("circuity", {})
    counts = state.get("circuity_counts", {})
    return {rt: {"cf": round(v, 3), "n": counts.get(rt, 0)} for rt, v in cf.items()}


@app.get("/stats/model", tags=["Meta"])
def get_model_stats():
    """Return Random Forest training metrics and feature importances."""
    return state.get("train_stats", {})


@app.get("/stats/speed", tags=["Meta"])
def get_speed_table():
    """
    Veri-güdümlü Effective Speed Table:
    (road_type, traffic_level, weather_condition) → medyan gerçek hız (km/h)

    Optimizer A→C (veride olmayan) kenarları icat ederken bu tabloyu kullanır.
    """
    speed = state.get("speed_table", {})
    counts = state.get("speed_counts", {})
    rows = [
        {
            "road_type": rt,
            "traffic_level": tl,
            "weather_condition": wc,
            "median_speed_kmh": round(v, 1),
            "sample_count": counts.get((rt, tl, wc), 0),
        }
        for (rt, tl, wc), v in speed.items()
    ]
    rows.sort(key=lambda r: (-r["sample_count"], r["road_type"]))
    return {
        "total_combinations": len(rows),
        "total_samples": sum(counts.values()),
        "rows": rows,
    }
