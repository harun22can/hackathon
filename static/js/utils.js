const { useState, useEffect, useMemo, useRef, Component } = React;

function fmtTime(str) {
  if (!str) return '??:??';
  const s = String(str);
  const isoM = s.match(/[T ](\d{2}):(\d{2})/);
  if (isoM) return `${isoM[1]}:${isoM[2]}`;
  const tmM = s.match(/^(\d{2}):(\d{2})/);
  if (tmM) return `${tmM[1]}:${tmM[2]}`;
  return s.slice(0, 5);
}

function mergeToDesignFormat(routeDetail, optimResp) {
  const route = (routeDetail && routeDetail.route) || {};
  const rawStops = (routeDetail && routeDetail.stops) || [];
  const origStops = (optimResp.original_order && optimResp.original_order.stops) || [];
  const optStops  = (optimResp.optimized_order && optimResp.optimized_order.stops) || [];

  const origMap = {};  origStops.forEach(s => { origMap[s.stop_id] = s; });
  const optMap  = {};  optStops.forEach(s  => { optMap[s.stop_id]  = s; });
  const rawMap  = {};  rawStops.forEach(s  => { rawMap[s.stop_id]  = s; });

  const stopIds = origStops.map(s => s.stop_id);

  const stops = stopIds.map(sid => {
    const orig = origMap[sid] || {};
    const opt  = optMap[sid]  || {};
    const raw  = rawMap[sid]  || {};
    const dc   = orig.dynamic_conditions || {};
    return {
      stop_id:           sid,
      latitude:          orig.latitude          ?? raw.latitude          ?? 0,
      longitude:         orig.longitude         ?? raw.longitude         ?? 0,
      road_type:         orig.road_type         ?? raw.road_type         ?? 'rural',
      time_window_open:  fmtTime(orig.time_window_open  || raw.time_window_open),
      time_window_close: fmtTime(orig.time_window_close || raw.time_window_close),
      package_count:     orig.package_count     ?? raw.package_count     ?? 0,
      package_weight_kg: orig.package_weight_kg ?? raw.package_weight_kg ?? 0,
      planned_service_min: raw.planned_service_min ?? 10,
      planned_arrival: fmtTime(orig.planned_arrival || raw.planned_arrival),
      original: {
        predicted_arrival:        fmtTime(orig.predicted_arrival),
        within_time_window:       orig.within_time_window      ?? true,
        predicted_stop_delay_min: orig.predicted_stop_delay_min ?? 0,
        arrival_deviation_min:    orig.arrival_deviation_min   ?? 0,
      },
      optimized: {
        predicted_arrival:        fmtTime(opt.predicted_arrival),
        within_time_window:       opt.within_time_window       ?? true,
        predicted_stop_delay_min: opt.predicted_stop_delay_min ?? 0,
        arrival_deviation_min:    opt.arrival_deviation_min    ?? 0,
      },
      dynamic_conditions: {
        weather:          dc.weather           || 'clear',
        traffic:          dc.traffic           || 'low',
        congestion_ratio: dc.congestion_ratio  ?? 0,
        delay_risk_score: dc.delay_risk_score  ?? 0,
        road_surface:     dc.road_surface      || 'dry',
      },
    };
  });

  const origM = (optimResp.original_order  && optimResp.original_order.metrics)  || {};
  const optM  = (optimResp.optimized_order && optimResp.optimized_order.metrics) || {};
  const origRate = origM.on_time_rate ?? 0;
  const severity = origRate < 0.3 ? 'critical' : origRate < 0.7 ? 'warning' : 'ok';

  return {
    route_id:    route.route_id || 'UNKNOWN',
    vehicle_id:  route.vehicle_id || route.route_id || '—',
    vehicle_type: route.vehicle_type || 'van',
    num_stops:   route.num_stops ?? 0,
    total_distance_km: route.total_distance_km ?? 0,
    departure_planned: route.departure_planned,
    weather_condition: (optimResp.conditions && optimResp.conditions.weather) || route.weather_condition || 'clear',
    temperature_c: route.temperature_c   ?? 0,
    visibility_km: route.visibility_km   ?? 10,
    wind_speed_kmh: route.wind_speed_kmh ?? 10,
    traffic_level: (optimResp.conditions && optimResp.conditions.traffic) || route.traffic_level || 'low',
    severity,
    delay_factor:                 optimResp.delay_factor                ?? 1,
    rf_predicted_total_delay_min: optimResp.rf_predicted_total_delay_min ?? 0,
    original_metrics: {
      on_time_rate:              origM.on_time_rate              ?? 0,
      total_predicted_delay_min: origM.total_predicted_delay_min ?? 0,
      avg_delay_per_stop_min:    origM.avg_delay_per_stop_min    ?? 0,
      historical_risk_sum_min:   origM.historical_risk_sum_min   ?? 0,
    },
    optimized_metrics: {
      on_time_rate:              optM.on_time_rate              ?? 0,
      total_predicted_delay_min: optM.total_predicted_delay_min ?? 0,
      avg_delay_per_stop_min:    optM.avg_delay_per_stop_min    ?? 0,
      historical_risk_sum_min:   optM.historical_risk_sum_min   ?? 0,
    },
    improvement: optimResp.improvement || { on_time_rate_delta: 0, delay_reduction_min: 0 },
    stops,
  };
}

// Quadratic bezier arc — düz çizgi yerine taktiksel kavisli hat
function bezierArc(lat1, lon1, lat2, lon2, curvature = 0.18, steps = 20) {
  const dlat = lat2 - lat1, dlon = lon2 - lon1;
  const cx = (lat1 + lat2) / 2 - dlon * curvature;
  const cy = (lon1 + lon2) / 2 + dlat * curvature;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      (1-t)*(1-t)*lat1 + 2*(1-t)*t*cx + t*t*lat2,
      (1-t)*(1-t)*lon1 + 2*(1-t)*t*cy + t*t*lon2,
    ]);
  }
  return pts;
}

function makeArcPath(latLngs) {
  if (latLngs.length < 2) return latLngs;
  const out = [];
  for (let i = 0; i < latLngs.length - 1; i++) {
    const seg = bezierArc(latLngs[i][0], latLngs[i][1], latLngs[i+1][0], latLngs[i+1][1]);
    out.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return out;
}

// Çakışan marker'ları küçük spiral offset ile ayır
function offsetOverlaps(stops) {
  const GRID = 0.004, D = 0.0028;
  const seen = {};
  return stops.map(s => {
    const key = `${(s.latitude/GRID).toFixed(0)},${(s.longitude/GRID).toFixed(0)}`;
    const n = seen[key] ?? 0;
    seen[key] = n + 1;
    const angle = n * (Math.PI * 2 / 6);
    const dist  = n === 0 ? 0 : D;
    return { ...s, _lat: s.latitude + dist * Math.cos(angle), _lon: s.longitude + dist * Math.sin(angle) };
  });
}

// Hafif kayıt — /routes endpoint'inden tek satır, henüz optimize edilmedi.
// Fleet list için gereken alanları historical veriden doldurur.
function buildBasicRecord(row) {
  const rate = row.on_time_delivery_rate ?? 0;
  const severity = rate < 0.3 ? 'critical' : rate < 0.7 ? 'warning' : 'ok';
  return {
    route_id: row.route_id,
    vehicle_id: row.route_id,
    vehicle_type: row.vehicle_type || 'van',
    num_stops: row.num_stops ?? 0,
    total_distance_km: row.total_distance_km ?? 0,
    weather_condition: row.weather_condition || 'clear',
    traffic_level: row.traffic_level || 'low',
    temperature_c: null,
    visibility_km: null,
    wind_speed_kmh: null,
    severity,
    delay_factor: 1,
    rf_predicted_total_delay_min: 0,
    original_metrics: {
      on_time_rate: rate,
      total_predicted_delay_min: row.total_delay_min ?? 0,
      avg_delay_per_stop_min: (row.num_stops ? (row.total_delay_min ?? 0) / row.num_stops : 0),
      historical_risk_sum_min: 0,
    },
    optimized_metrics: {
      on_time_rate: rate,
      total_predicted_delay_min: row.total_delay_min ?? 0,
      avg_delay_per_stop_min: (row.num_stops ? (row.total_delay_min ?? 0) / row.num_stops : 0),
    },
    improvement: { on_time_rate_delta: 0, delay_reduction_min: 0 },
    stops: [],
    _detailed: false,
  };
}

async function fetchAndMergeRoute(routeId, weather) {
  const [detail, optResult] = await Promise.all([
    fetch(`${API_BASE}/routes/${routeId}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(`${API_BASE}/optimize/${routeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weather_condition: weather }),
    }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]);
  const merged = mergeToDesignFormat(detail, optResult);
  merged._detailed = true;
  return merged;
}
