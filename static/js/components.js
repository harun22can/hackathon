const { useState, useEffect, useMemo, useRef, Component } = React;

// ═══════════════════════════════════════════
//  ERROR BOUNDARY
// ═══════════════════════════════════════════
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] CRASH in', this.props.label || 'app', error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      const minimal = this.props.minimal;
      const msg = this.state.error && (this.state.error.message || String(this.state.error));
      if (minimal) {
        return (
          <div style={{ padding: 16, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            ⚠ {this.props.label || 'Bileşen'} çöktü<br/>
            <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{msg}</span>
          </div>
        );
      }
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: 'var(--bg-0)', color: 'var(--red)',
          fontFamily: 'var(--font-mono)', fontSize: 14, flexDirection: 'column', gap: 12, padding: 40, textAlign: 'center'
        }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>RENDER HATASI</div>
          <div style={{ color: 'var(--text-2)', maxWidth: 600 }}>{msg}</div>
          <pre style={{ color: 'var(--text-3)', fontSize: 10, maxWidth: 800, overflow: 'auto', maxHeight: 200, textAlign: 'left' }}>
            {this.state.info && this.state.info.componentStack}
          </pre>
          <button className="btn btn-primary" style={{ maxWidth: 200 }}
            onClick={() => window.location.reload()}>Yeniden Yükle</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════
//  EFFICIENCY GAIN WIDGET
// ═══════════════════════════════════════════

function EfficiencyGainWidget({ routes }) {
  const [lang] = window.useLang();
  if (!routes || routes.length === 0) return null;
  const totalDelay = routes.reduce((s, r) => s + ((r.improvement && r.improvement.delay_reduction_min) || 0), 0);
  const avgDelta   = routes.reduce((s, r) => s + ((r.improvement && r.improvement.on_time_rate_delta) || 0), 0) / routes.length;
  const critFixed  = routes.filter(r => r.severity !== 'critical' && r.optimized_metrics && r.optimized_metrics.on_time_rate > 0.7).length;
  return (
    <div className="efficiency-widget">
      <div className="ew-label"><span className="ew-pulse"></span>{window.t('efficiency_gain')}</div>
      <div className="ew-main">
        <span className="ew-num">−{totalDelay.toFixed(0)}</span>
        <span className="ew-unit"> {window.t('unit_min')}</span>
      </div>
      <div className="ew-sub">↑ +{(avgDelta * 100).toFixed(1)}% {window.t('on_time')}</div>
      <div className="ew-sub2">{routes.length} rota · {critFixed} kurtarıldı · RF R² {window.LOGISTICS_DATA.MODEL_STATS.r2}</div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  PANEL COMPONENTS
// ═══════════════════════════════════════════

function VehicleIcon({ type }) {
  const paths = {
    truck: "M2 6h12v8H2zM14 9h4l3 3v2h-7z M4 16a2 2 0 104 0 2 2 0 00-4 0z M16 16a2 2 0 104 0 2 2 0 00-4 0z",
    van:   "M2 6h14v8H2z M16 9h4l2 3v2h-6z M5 16a2 2 0 104 0 2 2 0 00-4 0z M15 16a2 2 0 104 0 2 2 0 00-4 0z",
    car:   "M3 10l2-4h12l2 4h2v5H1v-5z M4 16a2 2 0 104 0 2 2 0 00-4 0z M14 16a2 2 0 104 0 2 2 0 00-4 0z",
    motorcycle: "M4 14a3 3 0 106 0 3 3 0 00-6 0z M14 14a3 3 0 106 0 3 3 0 00-6 0z M7 14l4-6h3l2 6"
  };
  return (
    <svg width="16" height="14" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d={paths[type] || paths.van} />
    </svg>
  );
}

function FleetList({ routes, selectedId, onSelect, filter, onFilter }) {
  const [lang] = window.useLang();
  const filtered = useMemo(() => {
    if (filter === 'all') return routes;
    return routes.filter(r => r.severity === filter);
  }, [routes, filter]);

  const counts = useMemo(() => ({
    all:      routes.length,
    critical: routes.filter(r => r.severity === 'critical').length,
    warning:  routes.filter(r => r.severity === 'warning').length,
    ok:       routes.filter(r => r.severity === 'ok').length,
  }), [routes]);

  return (
    <>
      <div className="pane-header">
        <h3>{window.t('fleet_active')}<span className="count">{filtered.length}/{routes.length}</span></h3>
        <button className="map-btn" style={{ width: 22, height: 22, fontSize: 13 }} title={window.t('tooltip_sort')}>⇅</button>
      </div>
      <div className="filters">
        <div className={`f ${filter === 'all' ? 'active' : ''}`} onClick={() => onFilter('all')}>{window.t('filter_all')} {counts.all}</div>
        <div className={`f ${filter === 'critical' ? 'active' : ''}`} onClick={() => onFilter('critical')}
          style={filter==='critical'?{background:'var(--red)',borderColor:'var(--red)',color:'var(--bg-0)'}:{}}>{window.t('filter_critical')} {counts.critical}</div>
        <div className={`f ${filter === 'warning' ? 'active' : ''}`} onClick={() => onFilter('warning')}
          style={filter==='warning'?{background:'var(--amber)',borderColor:'var(--amber)',color:'var(--bg-0)'}:{}}>{window.t('filter_warning')} {counts.warning}</div>
        <div className={`f ${filter === 'ok' ? 'active' : ''}`} onClick={() => onFilter('ok')}
          style={filter==='ok'?{background:'var(--lime)',borderColor:'var(--lime)',color:'var(--bg-0)'}:{}}>{window.t('filter_ok')} {counts.ok}</div>
      </div>
      <div className="pane-body">
        {filtered.map(r => (
          <div key={r.route_id} className={`route-card ${selectedId === r.route_id ? 'selected' : ''}`} onClick={() => onSelect(r.route_id)}>
            <div className="row-top">
              <div className="route-id">{r.route_id}</div>
              <span className={`badge ${r.severity}`}>
                {r.severity === 'critical' ? window.t('sev_critical') : r.severity === 'warning' ? window.t('sev_warning') : window.t('sev_ok')}
              </span>
            </div>
            <div className="vehicle">
              <VehicleIcon type={r.vehicle_type} />
              <span className="mono">{r.vehicle_id}</span>
              <span style={{ color: 'var(--text-3)' }}>·</span>
              <span>{r.num_stops} {window.t('unit_stops')}</span>
              <span style={{ color: 'var(--text-3)' }}>·</span>
              <span>{Number(r.total_distance_km).toFixed(0)} km</span>
            </div>
            <div className="row-metrics">
              <div className="m">
                <span className="k">{window.t('on_time')}</span>
                <span className={`v ${r.original_metrics.on_time_rate < 0.3 ? 'critical' : r.original_metrics.on_time_rate < 0.7 ? 'warning' : 'ok'}`}>
                  {(r.original_metrics.on_time_rate * 100).toFixed(0)}% → {(r.optimized_metrics.on_time_rate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="m">
                <span className="k">{window.t('delay')}</span>
                <span className="v" style={{ color: 'var(--lime)' }}>
                  −{Number(r.improvement.delay_reduction_min).toFixed(0)} {window.t('unit_min')}
                </span>
              </div>
            </div>
            <div className="progress">
              <div className={`fill ${r.severity}`} style={{ width: `${r.optimized_metrics.on_time_rate * 100}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Sparkline({ data, width = 80, height = 22, color = 'var(--cyan)' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `0,${height} ` + pts + ` ${width},${height}`;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function TimelineGantt({ route }) {
  const [lang] = window.useLang();
  const [mode, setMode] = useState('compare');
  if (!route || !route.stops) return <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 12 }}>{window.t('no_stop_detail')}</div>;

  const parseT = (t) => {
    if (!t || t === '??:??') return 0;
    const [h, m] = t.split(':').map(Number);
    let mins = h * 60 + m;
    if (h < 6) mins += 24 * 60;
    return mins;
  };

  const allTimes = [];
  route.stops.forEach(s => {
    allTimes.push(parseT(s.time_window_open));
    allTimes.push(parseT(s.time_window_close));
    allTimes.push(parseT(s.original.predicted_arrival));
    allTimes.push(parseT(s.optimized.predicted_arrival));
  });
  const tMin = Math.min(...allTimes.filter(t => t > 0)) - 15;
  const tMax = Math.max(...allTimes) + 15;
  const span = tMax - tMin || 1;
  const pctFor = (t) => ((parseT(t) - tMin) / span) * 100;

  const tickStep = span > 300 ? 120 : span > 120 ? 60 : 30;
  const ticks = [];
  for (let t = Math.ceil(tMin / tickStep) * tickStep; t <= tMax; t += tickStep) {
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    ticks.push({ pct: ((t - tMin) / span) * 100, label: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` });
  }

  return (
    <div className="timeline">
      <div className="timeline-head">
        <div>
          <h3 style={{ margin: 0, fontSize: 13, color: 'var(--text-0)', fontWeight: 600 }}>{window.t('stop_timeline')}</h3>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{window.t('legend_timeline')}</div>
        </div>
        <div className="tabs">
          <button className={mode==='compare'?'active':''} onClick={()=>setMode('compare')}>{window.t('mode_compare')}</button>
          <button className={mode==='original'?'active':''} onClick={()=>setMode('original')}>{window.t('mode_original')}</button>
          <button className={mode==='optimized'?'active':''} onClick={()=>setMode('optimized')}>{window.t('mode_optimized')}</button>
        </div>
      </div>
      <div className="gantt-axis">
        <div></div>
        <div className="ticks">{ticks.map((t, i) => <span key={i}>{t.label}</span>)}</div>
        <div></div>
      </div>
      <div className="gantt">
        {route.stops.map((s, i) => {
          const winL = pctFor(s.time_window_open);
          const winR = pctFor(s.time_window_close);
          const origL = pctFor(s.original.predicted_arrival);
          const optL  = pctFor(s.optimized.predicted_arrival);
          const serviceWpct = (s.planned_service_min / span) * 100;
          return (
            <div className="gantt-row" key={s.stop_id}>
              <div className="label">{String(i+1).padStart(2,'0')} · {s.stop_id.slice(-5)}</div>
              <div className="track">
                <div className="window" style={{ left: `${winL}%`, width: `${winR - winL}%` }}></div>
                {(mode === 'compare' || mode === 'original') && (
                  <div className={`bar ${s.original.within_time_window ? 'ok' : 'miss'}`}
                       style={{ left: `${origL}%`, width: `${Math.max(serviceWpct, 1.2)}%`, top: mode==='compare'?1:3, height: mode==='compare'?4:10 }}></div>
                )}
                {(mode === 'compare' || mode === 'optimized') && (
                  <div className="bar ok" style={{ background: 'var(--cyan)', boxShadow: '0 0 4px var(--cyan-glow)',
                    left: `${optL}%`, width: `${Math.max(serviceWpct, 1.2)}%`, top: mode==='compare'?11:3, height: mode==='compare'?4:10 }}></div>
                )}
              </div>
              <div className={`delay ${s.original.within_time_window ? 'ok' : 'miss'}`}>
                {s.original.within_time_window ? '✓' : `+${Number(s.original.predicted_stop_delay_min).toFixed(0)}′`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StopsList({ route }) {
  if (!route || !route.stops) return null;
  return (
    <div className="stops-list">
      {route.stops.map((s, i) => {
        const origOk = s.original.within_time_window;
        const d = s.dynamic_conditions;
        return (
          <div className="stop-row" key={s.stop_id}>
            <div className={`seq ${origOk ? 'ok' : 'miss'}`}>{i + 1}</div>
            <div className="main-info">
              <div className="sid">{s.stop_id}</div>
              <div className="meta">
                <span>{s.road_type}</span>
                <span>·</span>
                <span>{s.package_count} pkt / {Number(s.package_weight_kg).toFixed(0)}kg</span>
                <span>·</span>
                <span className={`cond-pill ${d.weather}`}>{d.weather}</span>
                <span className={`cond-pill ${d.road_surface}`}>{d.road_surface.replace('_',' ')}</span>
              </div>
            </div>
            <div className="arrival">
              <span style={{ color: origOk ? 'var(--text-1)' : 'var(--red)' }}>{s.original.predicted_arrival}</span>
              <span className="delta">→</span>
              <span style={{ color: 'var(--cyan)' }}>{s.optimized.predicted_arrival}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModelCard({ route }) {
  const stats = window.LOGISTICS_DATA.MODEL_STATS;
  const feats = stats.top_features || {};
  const featEntries = Object.entries(feats);
  const maxF = featEntries.length > 0 ? Math.max(...Object.values(feats)) : 1;

  return (
    <div className="model-card">
      <h4><span className="ai-dot"></span>Random Forest Model</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg-2)', padding: 8, borderRadius: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>MAE</div>
          <div className="mono" style={{ fontSize: 18, color: 'var(--text-0)' }}>{stats.mae_min}<span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 2 }}>dk</span></div>
        </div>
        <div style={{ background: 'var(--bg-2)', padding: 8, borderRadius: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>R²</div>
          <div className="mono" style={{ fontSize: 18, color: 'var(--lime)' }}>{stats.r2}</div>
        </div>
        <div style={{ background: 'var(--bg-2)', padding: 8, borderRadius: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Özellik</div>
          <div className="mono" style={{ fontSize: 18, color: 'var(--text-0)' }}>{stats.features_used}</div>
        </div>
      </div>
      <div className="upper" style={{ marginBottom: 8 }}>Önemli Özellikler</div>
      {featEntries.map(([k, v]) => (
        <div className="feat-bar" key={k}>
          <div className="fn">{k}</div>
          <div className="fb"><div className="fill" style={{ width: `${(v / maxF) * 100}%` }}></div></div>
          <div className="fv">{(v * 100).toFixed(1)}%</div>
        </div>
      ))}
      {route && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div className="upper" style={{ marginBottom: 6 }}>Bu Rota İçin Tahmin</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-2)' }}>RF tahmini toplam gecikme</span>
            <span className="mono" style={{ color: 'var(--amber)' }}>{Number(route.rf_predicted_total_delay_min).toFixed(1)} dk</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-2)' }}>Delay factor</span>
            <span className="mono">{Number(route.delay_factor).toFixed(3)}×</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>Güven (± MAE)</span>
            <span className="mono">±{stats.mae_min} dk</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPane({ route, onApply, applied, onReOptimize }) {
  const [tab, setTab] = useState('timeline');
  const [lang] = window.useLang();
  if (!route) return <div style={{ padding: 20, color: 'var(--text-3)' }}>{window.t('no_route_selected')}</div>;

  const orig = route.original_metrics  || { on_time_rate: 0, total_predicted_delay_min: 0, avg_delay_per_stop_min: 0 };
  const opt  = route.optimized_metrics || { on_time_rate: 0, total_predicted_delay_min: 0, avg_delay_per_stop_min: 0 };
  const imp  = route.improvement       || { on_time_rate_delta: 0, delay_reduction_min: 0 };
  const vtype = route.vehicle_type || 'van';
  const weatherCond = route.weather_condition || 'clear';
  const trafficLvl  = route.traffic_level || 'low';

  return (
    <>
      <div className="detail-head">
        <div className="route-title">
          <div>
            <div className="rid">{route.route_id} <span className="sub">· {route.vehicle_id}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
              <VehicleIcon type={vtype} /> {vtype.toUpperCase()}
              <span>·</span>
              <span>{route.num_stops} {window.t('unit_stops')} · {Number(route.total_distance_km).toFixed(0)} km</span>
              <span>·</span>
              <span>{route.departure_planned ? new Date(route.departure_planned).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'tr-TR', { day: '2-digit', month: 'short' }) : '—'}</span>
            </div>
          </div>
          <span className={`badge ${route.severity}`}>
            {route.severity === 'critical' ? window.t('sev_critical') : route.severity === 'warning' ? window.t('sev_warning') : window.t('sev_ok')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-2)', marginBottom: 8, flexWrap: 'wrap' }}>
          <span className={`cond-pill ${weatherCond}`}>{weatherCond}</span>
          <span className="mono">{route.temperature_c ?? '—'}°C</span>
          <span>·</span>
          <span>{route.visibility_km ?? '—'}km</span>
          <span>·</span>
          <span>{route.wind_speed_kmh ?? '—'}km/h</span>
          <span>·</span>
          <span>{trafficLvl}</span>
        </div>

        {/* 3D COMPARISON CARDS */}
        <div className="comparison">
          <div className="col">
            <div className="label">{window.t('current_plan')}</div>
            <div className="big">{(orig.on_time_rate * 100).toFixed(0)}<span className="unit">%</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{window.t('on_time_delivery')}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {window.t('delay')}: {Number(orig.total_predicted_delay_min).toFixed(1)} {window.t('unit_min')}
            </div>
          </div>
          <div className="col optimized">
            <div className="label" style={{ color: 'var(--cyan)' }}>⚡ {window.t('mode_optimized').replace('.', '')}</div>
            <div className="big">{(opt.on_time_rate * 100).toFixed(0)}<span className="unit">%</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{window.t('on_time_delivery')}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {window.t('delay')}: {Number(opt.total_predicted_delay_min).toFixed(1)} {window.t('unit_min')}
            </div>
          </div>
        </div>

        <div className="delta-banner">
          <span className="arrow">↗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>
              <span className="metric">+{(imp.on_time_rate_delta * 100).toFixed(1)}%</span> {window.t('on_time').toLowerCase()} ·
              <span className="metric" style={{ marginLeft: 6 }}>−{Number(imp.delay_reduction_min).toFixed(1)} {window.t('unit_min')}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
              {window.t('delay_factor')} {Number(route.delay_factor).toFixed(3)}× · RF: {Number(route.rf_predicted_total_delay_min).toFixed(1)} {window.t('unit_min')}
            </div>
          </div>
        </div>
      </div>

      <div className="actions">
        {applied ? (
          <button className="btn btn-ghost" disabled style={{ color: 'var(--lime)', borderColor: 'rgba(142,230,138,0.3)' }}>✓</button>
        ) : (
          <button className="btn btn-primary" onClick={onApply}>{window.t('apply_optimized')}</button>
        )}
        <button className="btn btn-ghost" onClick={onReOptimize}>{window.t('reoptimize')}</button>
      </div>

      <div style={{ display: 'flex', gap: 2, padding: '8px 16px 0', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)' }}>
        {[['timeline', window.t('tab_timeline')],['stops', window.t('tab_stops')],['model', window.t('tab_model')]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '6px 10px', fontSize: 12, fontWeight: 500,
            color: tab===k ? 'var(--text-0)' : 'var(--text-2)',
            borderBottom: tab===k ? '1.5px solid var(--cyan)' : '1.5px solid transparent',
            marginBottom: -1
          }}>{l}</button>
        ))}
      </div>

      <div className="pane-body">
        {tab === 'timeline' && <TimelineGantt route={route} />}
        {tab === 'stops'    && <StopsList route={route} />}
        {tab === 'model'    && <ModelCard route={route} />}
      </div>
    </>
  );
}

function AlertsStrip({ routes, onSelect }) {
  const [lang] = window.useLang();
  const alerts = useMemo(() => {
    const list = [];
    (routes || []).forEach(r => {
      if (!r) return;
      const wc = (r.weather_condition || 'clear').toUpperCase();
      if (r.severity === 'critical') {
        list.push({
          severity: 'critical', route_id: r.route_id,
          title: `${r.route_id}: ${window.t('alert_window_miss_risk')}`,
          desc: `${wc} · ${window.t('alert_visibility')} ${r.visibility_km ?? '—'}km · ${window.t('alert_delay_factor')} ${Number(r.delay_factor || 1).toFixed(2)}×`,
          time: '—',
          meta: `${window.t('alert_rf_delay')} +${Number(r.rf_predicted_total_delay_min || 0).toFixed(0)} ${window.t('alert_delay_min_suffix')}`
        });
      }
      if (Array.isArray(r.stops)) {
        r.stops.forEach(s => {
          if (!s || !s.original || !s.dynamic_conditions) return;
          if (!s.original.within_time_window && s.dynamic_conditions.road_surface === 'icy') {
            list.push({
              severity: 'warning', route_id: r.route_id,
              title: `${s.stop_id}: ${window.t('alert_icy_window_risk')}`,
              desc: `${r.route_id} · ${s.road_type || '—'} · ${window.t('alert_arrival')} ${s.original.predicted_arrival} (${window.t('alert_window')} ${s.time_window_close})`,
              time: s.original.predicted_arrival,
              meta: `${window.t('alert_risk_score')} ${Number(s.dynamic_conditions.delay_risk_score || 0).toFixed(2)} · ${window.t('alert_congestion')} %${((s.dynamic_conditions.congestion_ratio || 0)*100).toFixed(0)}`
            });
          }
        });
      }
    });
    return list.slice(0, 8);
  }, [routes, lang]);

  return (
    <>
      <div className="pane-header">
        <h3>{window.t('alert_center')}<span className="count">{alerts.length} {window.t('alerts_active')}</span></h3>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {alerts.map((a, i) => (
          <div key={i} className={`alert-item ${a.severity}`} onClick={() => onSelect(a.route_id)}>
            <div className="pin"></div>
            <div className="body">
              <div className="title">{a.title}</div>
              <div className="desc">{a.desc}</div>
              <div className="meta">{a.meta}</div>
            </div>
            <div className="time">{a.time}</div>
          </div>
        ))}
        {alerts.length === 0 && (
          <div style={{ padding: '16px 14px', color: 'var(--text-3)', fontSize: 12 }}>{window.t('no_alerts')}</div>
        )}
      </div>
    </>
  );
}

function TweaksPanel({ open, onClose, tweaks, setTweaks }) {
  if (!open) return null;
  return (
    <div className="tweaks-panel">
      <div className="tp-head">
        <h4>Tweaks</h4>
        <button onClick={onClose} style={{ color: 'var(--text-2)', fontSize: 16 }}>×</button>
      </div>
      <div className="tp-body">
        <div className="tp-group">
          <div className="tp-label">Hava Senaryosu</div>
          <div className="tp-seg">
            {['snow','rain','fog','clear'].map(w => (
              <button key={w} className={tweaks.weather===w?'active':''} onClick={()=>setTweaks({...tweaks,weather:w})}>
                {w==='snow'?'Kar':w==='rain'?'Yağmur':w==='fog'?'Sis':'Açık'}
              </button>
            ))}
          </div>
        </div>
        <div className="tp-group">
          <div className="tp-label">Yoğunluk</div>
          <div className="tp-seg">
            {['compact','comfortable'].map(d => (
              <button key={d} className={tweaks.density===d?'active':''} onClick={()=>setTweaks({...tweaks,density:d})}>
                {d==='compact'?'Kompakt':'Rahat'}
              </button>
            ))}
          </div>
        </div>
        <div className="tp-group">
          <div className="tp-label">Renk Aksanı</div>
          <div className="tp-seg">
            {[['cyan','Cyan'],['lime','Lime'],['violet','Mor']].map(([k,l]) => (
              <button key={k} className={tweaks.accent===k?'active':''} onClick={()=>setTweaks({...tweaks,accent:k})}>{l}</button>
            ))}
          </div>
        </div>
        <div className="tp-group">
          <div className="tp-label">Düzen</div>
          <div className="tp-seg">
            {[['split','Üçlü'],['focus','Geniş Harita']].map(([k,l]) => (
              <button key={k} className={tweaks.layout===k?'active':''} onClick={()=>setTweaks({...tweaks,layout:k})}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  APP SHELL COMPONENTS
// ═══════════════════════════════════════════

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(t.getHours()).padStart(2,'0');
  const mm = String(t.getMinutes()).padStart(2,'0');
  const ss = String(t.getSeconds()).padStart(2,'0');
  return <div className="clock">{hh}:{mm}:{ss}<span className="tz">UTC+3 SİVAS</span></div>;
}

function LangToggle() {
  const [lang, setLang] = window.useLang();
  const opts = [['tr','TR'],['en','EN'],['ru','RU']];
  return (
    <div className="lang-toggle" title={window.t('language')}>
      {opts.map(([k, l]) => (
        <button
          key={k}
          className={'lang-btn' + (lang === k ? ' active' : '')}
          onClick={() => setLang(k)}
        >{l}</button>
      ))}
    </div>
  );
}

function TopBar({ activeNav, setActiveNav, criticalCount, onOpenTweaks, optimizing, weather }) {
  const [lang] = window.useLang();
  const weatherMeta = {
    snow:  { icon: '❄', labelKey: 'w_snow',  cls: 'chip weather-snow'  },
    rain:  { icon: '🌧', labelKey: 'w_rain',  cls: 'chip weather-rain'  },
    fog:   { icon: '🌫', labelKey: 'w_fog',   cls: 'chip weather-fog'   },
    wind:  { icon: '💨', labelKey: 'w_wind',  cls: 'chip weather-wind'  },
    clear: { icon: '☀',  labelKey: 'w_clear', cls: 'chip weather-clear' },
  };
  const wm = weatherMeta[weather] || weatherMeta.clear;
  const navItems = [
    ['overview', window.t('nav_overview')],
    ['winter',   window.t('nav_winter')],
    ['fleet',    window.t('nav_fleet')],
    ['routes',   window.t('nav_routes')],
    ['reports',  window.t('nav_reports')],
  ];
  return (
    <div className="topbar">
      <div className="brand">
        <div className="mark"></div>
        <span>{window.t('app_title')}</span>
        <span className="sub">v3.1 · sivas</span>
      </div>
      <nav>
        {navItems.map(([k, l]) => (
          <button key={k} className={activeNav===k?'active':''} onClick={()=>setActiveNav(k)}>{l}</button>
        ))}
      </nav>
      <div className="spacer"></div>
      <div className={wm.cls} style={{ fontWeight: 600, letterSpacing: '0.04em', marginRight: 4 }}>
        <span style={{ marginRight: 4 }}>{wm.icon}</span>
        <span>{window.t(wm.labelKey)}</span>
      </div>
      <div className="status-chips">
        {criticalCount > 0 && (
          <div className="chip critical"><span className="dot"></span><span>{criticalCount} {window.t('sev_critical').toLowerCase()}</span></div>
        )}
        {optimizing && (
          <div className="chip info"><span className="dot"></span><span>{window.t('f_optimizing').toLowerCase()}…</span></div>
        )}
        <div className="chip info"><span className="dot"></span><span>{window.t('chip_ai_active')}</span></div>
        <div className="chip"><span className="dot"></span><span>{window.t('chip_secure')}</span></div>
      </div>
      <LangToggle />
      <Clock />
      <button className="map-btn" onClick={onOpenTweaks} title={window.t('tooltip_tweaks')} style={{ marginLeft: 8 }}>⚙</button>
    </div>
  );
}

function KpiStrip({ routes }) {
  const [lang] = window.useLang();
  if (!routes || routes.length === 0) return <div className="kpi-strip"></div>;
  const total = routes.length;
  const avgOrig = routes.reduce((s, r) => s + ((r.original_metrics && r.original_metrics.on_time_rate) || 0), 0) / total;
  const avgOpt  = routes.reduce((s, r) => s + ((r.optimized_metrics && r.optimized_metrics.on_time_rate) || 0), 0) / total;
  const totalDelayReduction = routes.reduce((s, r) => s + ((r.improvement && r.improvement.delay_reduction_min) || 0), 0);
  const totalStops = routes.reduce((s, r) => s + (r.num_stops || 0), 0);
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <div className="k">{window.t('kpi_active_routes')}</div>
        <div className="v">{total}<span className="unit"> / {totalStops} {window.t('unit_stops')}</span></div>
        <div className="trend">{Sparkline({ data: [3,5,4,6,5,7,6], width: 60, height: 16 })}</div>
      </div>
      <div className="kpi">
        <div className="k">{window.t('kpi_on_time_current')}</div>
        <div className="v">{(avgOrig * 100).toFixed(1)}<span className="unit">%</span></div>
        <div className="trend down">↓</div>
      </div>
      <div className="kpi">
        <div className="k">{window.t('kpi_on_time_optimized')}</div>
        <div className="v" style={{ color: 'var(--cyan)' }}>{(avgOpt * 100).toFixed(1)}<span className="unit">%</span></div>
        <div className="trend">↑ +{((avgOpt - avgOrig) * 100).toFixed(1)}pp</div>
      </div>
      <div className="kpi">
        <div className="k">{window.t('kpi_total_delay_reduction')}</div>
        <div className="v" style={{ color: 'var(--lime)' }}>−{totalDelayReduction.toFixed(0)}<span className="unit"> {window.t('unit_min')}</span></div>
        <div className="trend">≈ {(totalDelayReduction / 60).toFixed(1)} h</div>
      </div>
    </div>
  );
}

function Footer({ weather, routes }) {
  const [lang] = window.useLang();
  const tempMap = { snow: -4, rain: 8, fog: 3, clear: 11 };
  const temp = tempMap[weather] ?? 0;
  const ts = window.LOGISTICS_DATA.MODEL_STATS;
  return (
    <div className="footer">
      <div><span className="k">{window.t('f_system')}:</span><span className="v" style={{ color: 'var(--lime)' }}>{window.t('f_optimizing')}</span></div>
      <div className="sep"></div>
      <div><span className="k">{window.t('f_weather')}:</span><span className="v">{temp}°C · {weather.toUpperCase()}</span></div>
      <div className="sep"></div>
      <div><span className="k">{window.t('f_route')}:</span><span className="v">{routes.length} {window.t('f_active')}</span></div>
      <div className="sep"></div>
      <div><span className="k">{window.t('f_security')}:</span><span className="v">{window.t('f_high')}</span></div>
      <div className="right">
        <div><span className="k">{window.t('f_model')}:</span><span className="v">RF · R² {ts.r2}</span></div>
        <div className="sep"></div>
        <div><span className="k">{window.t('f_mae_short')}:</span><span className="v">{ts.mae_min} {window.t('unit_min')}</span></div>
      </div>
    </div>
  );
}
