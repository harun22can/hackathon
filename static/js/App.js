const { useState, useEffect, useMemo, useRef, Component } = React;

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════

function App() {
  const [lang]     = window.useLang();
  const [routes,     setRoutes]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter,     setFilter]     = useState('all');
  const [routeMode,  setRouteMode]  = useState('both');
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(null);
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: 0 });
  const [optimizing,      setOptimizing]      = useState(false);
  const [leftOpen,        setLeftOpen]        = useState(true);
  const [rightOpen,       setRightOpen]       = useState(true);
  const [mapStyle,        setMapStyle]        = useState('satellite');
  const [projectionMode,  setProjectionMode]  = useState('sphere');
  const [tweaks, setTweaks] = useState(() => {
    try {
      const s = localStorage.getItem('sivas-tweaks');
      return s ? { ...TWEAK_DEFAULTS, ...JSON.parse(s) } : TWEAK_DEFAULTS;
    } catch { return TWEAK_DEFAULTS; }
  });
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    const accentMap = {
      cyan:   { main: '#0891b2', soft: 'rgba(8,145,178,0.10)',   glow: 'rgba(8,145,178,0.30)'  },
      lime:   { main: '#16a34a', soft: 'rgba(22,163,74,0.10)',   glow: 'rgba(22,163,74,0.30)'  },
      violet: { main: '#7c3aed', soft: 'rgba(124,58,237,0.10)',  glow: 'rgba(124,58,237,0.30)' },
    };
    const a = accentMap[tweaks.accent] || accentMap.violet;
    document.documentElement.style.setProperty('--cyan',      a.main);
    document.documentElement.style.setProperty('--cyan-soft', a.soft);
    document.documentElement.style.setProperty('--cyan-glow', a.glow);
  }, [tweaks.accent]);

  useEffect(() => {
    if (tweaks.density === 'compact') {
      document.documentElement.style.setProperty('--space-4', '12px');
      document.documentElement.style.setProperty('--space-5', '14px');
    } else {
      document.documentElement.style.setProperty('--space-4', '16px');
      document.documentElement.style.setProperty('--space-5', '20px');
    }
  }, [tweaks.density]);

  useEffect(() => {
    localStorage.setItem('sivas-tweaks', JSON.stringify(tweaks));
  }, [tweaks]);

  async function loadAll() {
    console.log('[loadAll] start — basic list only');
    try {
      const [modelStats, circuity, routeList] = await Promise.all([
        fetch(`${API_BASE}/stats/model`).then(r => { if (!r.ok) throw new Error('stats/model '+r.status); return r.json(); }),
        fetch(`${API_BASE}/stats/circuity`).then(r => { if (!r.ok) throw new Error('stats/circuity '+r.status); return r.json(); }),
        fetch(`${API_BASE}/routes?limit=80`).then(r => { if (!r.ok) throw new Error('routes '+r.status); return r.json(); }),
      ]);
      if (!Array.isArray(routeList) || routeList.length === 0) {
        throw new Error('Backend /routes returned empty list — is app.py running and did data_loader succeed?');
      }

      window.LOGISTICS_DATA = {
        MODEL_STATS: {
          mae_min:       modelStats.mae_min       ?? '—',
          r2:            modelStats.r2            ?? '—',
          features_used: modelStats.features_used ?? 26,
          top_features:  modelStats.top_features  || {},
        },
        CIRCUITY: circuity,
      };

      const basic = routeList.map(buildBasicRecord);
      setLoadProgress({ done: basic.length, total: basic.length });
      setRoutes(basic);

      const savedId  = localStorage.getItem('sivas-selected');
      const hasId    = basic.some(r => r.route_id === savedId);
      const newSelId = hasId ? savedId : basic[0].route_id;
      setSelectedId(newSelId);
      if (newSelId) localStorage.setItem('sivas-selected', newSelId);
    } catch (e) {
      console.error('[loadAll] FATAL:', e);
      throw e;
    }
  }

  // Tek rotayı (seçilen veya arka plan) optimize et.
  async function optimizeOne(routeId, weather, { silent = false } = {}) {
    if (!silent) setOptimizing(true);
    try {
      const merged = await fetchAndMergeRoute(routeId, weather);
      setRoutes(prev => prev.map(r => r.route_id === routeId ? merged : r));
      return merged;
    } catch (e) {
      console.error('optimizeOne failed:', routeId, e);
      return null;
    } finally {
      if (!silent) setOptimizing(false);
    }
  }

  async function reOptimizeSelected() {
    if (!selectedId) return;
    await optimizeOne(selectedId, tweaks.weather);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await loadAll();
      } catch (e) {
        setLoadError(String(e && e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Seçim değiştiğinde — eğer bu rota henüz detaylı değilse optimize et.
  useEffect(() => {
    if (!selectedId || loading) return;
    const sel = routes.find(r => r.route_id === selectedId);
    if (sel && !sel._detailed) {
      optimizeOne(selectedId, tweaks.weather);
    }
  }, [selectedId, loading]);

  // Hava senaryosu değişince: sadece şu an seçili olanı yeniden optimize et.
  // Diğerleri arka-plan tick'i ile kademeli güncellenecek.
  useEffect(() => {
    if (loading || !selectedId) return;
    optimizeOne(selectedId, tweaks.weather);
    // Değişen hava → eski detayları invalidate et (lazy re-fetch olsun)
    setRoutes(prev => prev.map(r =>
      r.route_id === selectedId ? r : { ...r, _detailed: false, optimized_metrics: null }
    ));
  }, [tweaks.weather]);

  // Arka plan tick — her 20 saniyede bir, detaylanmamış rastgele bir rotayı
  // sessizce optimize et. Alerts ve KPI şeridi kademeli dolsun.
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => {
      setRoutes(prev => {
        const pending = prev.filter(r => !r._detailed && r.route_id !== selectedId);
        if (pending.length === 0) return prev;
        const pick = pending[Math.floor(Math.random() * pending.length)];
        optimizeOne(pick.route_id, tweaks.weather, { silent: true });
        return prev;
      });
    }, 20000);
    return () => clearInterval(id);
  }, [loading, selectedId, tweaks.weather]);

  const handleTweaksChange = (newTweaks) => {
    const weatherChanged = newTweaks.weather !== tweaks.weather;
    setTweaks(newTweaks);
    if (weatherChanged && !loading) reOptimizeAll(newTweaks.weather);
  };

  const handleSelectRoute = (id) => {
    setSelectedId(id);
    localStorage.setItem('sivas-selected', id);
  };

  const selected      = (routes || []).find(r => r.route_id === selectedId) || (routes && routes[0]) || null;
  const criticalCount = (routes || []).filter(r => r && r.severity === 'critical').length;

  console.log('[App] render · routes:', routes.length, '· selected:', selected && selected.route_id, '· critical:', criticalCount);
  if (routes.length > 0 && !selected) {
    console.warn('[App] routes loaded but no selected — routes[0]:', routes[0]);
  }

  if (loading) {
    const pct = loadProgress.total > 0 ? (loadProgress.done / loadProgress.total) * 100 : 0;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-0)', color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)', fontSize: 14, flexDirection: 'column', gap: 16,
      }}>
        <div style={{ color: 'var(--cyan)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
          textShadow: '0 0 16px var(--cyan-glow)' }}>{window.t('app_title')}</div>
        <div style={{ color: 'var(--text-3)' }}>
          {loadProgress.total > 0
            ? `${window.t('loading_routes')} ${loadProgress.done}/${loadProgress.total}`
            : window.t('loading_model')}
        </div>
        <div style={{ width: 280, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cyan)',
            boxShadow: '0 0 8px var(--cyan-glow)', transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cyan)',
              opacity: 0.3 + i * 0.35, animation: `pulse ${1 + i * 0.3}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-0)', color: 'var(--red)',
        fontFamily: 'var(--font-mono)', fontSize: 14, flexDirection: 'column', gap: 12, padding: 40, textAlign: 'center'
      }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{window.t('connection_error')}</div>
        <div style={{ color: 'var(--text-2)' }}>{loadError}</div>
        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{window.t('check_console')}</div>
        <button className="btn btn-primary" style={{ marginTop: 16, maxWidth: 200 }}
          onClick={() => window.location.reload()}>{window.t('retry')}</button>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        criticalCount={criticalCount}
        onOpenTweaks={() => setTweaksOpen(!tweaksOpen)}
        optimizing={optimizing}
        weather={tweaks.weather}
      />

      <div className="main" style={{
        gridTemplateColumns: (() => {
          const W = tweaks.layout === 'focus';
          const L = leftOpen  ? (W ? '300px' : '340px') : '0px';
          const R = rightOpen ? (W ? '380px' : '400px') : '0px';
          return `${L} 1fr ${R}`;
        })()
      }}>
        {/* LEFT — Fleet list + Alerts */}
        <div className="pane" style={{ overflow: 'visible', position: 'relative', minWidth: 0 }}>
          <div style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {leftOpen && <>
              <ErrorBoundary label="FleetList" minimal>
                <FleetList
                  routes={routes}
                  selectedId={selectedId}
                  onSelect={handleSelectRoute}
                  filter={filter}
                  onFilter={setFilter}
                />
              </ErrorBoundary>
              <ErrorBoundary label="AlertsStrip" minimal>
                <AlertsStrip routes={routes} onSelect={handleSelectRoute} />
              </ErrorBoundary>
            </>}
          </div>
          <button className="pane-toggle-btn left-toggle"
            onClick={() => setLeftOpen(v => !v)}
            title={leftOpen ? 'Paneli Kapat' : 'Paneli Aç'}>
            {leftOpen ? '‹' : '›'}
          </button>
        </div>

        {/* CENTER — KPI strip + Map + Efficiency Widget */}
        <div className="pane" style={{ position: 'relative', minWidth: 0 }}>
          <ErrorBoundary label="KpiStrip" minimal>
            <KpiStrip routes={routes} />
          </ErrorBoundary>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <ErrorBoundary label="MapView" minimal>
              <MapView
                route={selected}
                allRoutes={routes}
                weatherVisible={true}
                weatherScenario={tweaks.weather}
                routeMode={routeMode}
                onRouteMode={setRouteMode}
                mapStyle={mapStyle}
                onMapStyle={setMapStyle}
                projectionMode={projectionMode}
                onProjectionMode={setProjectionMode}
              />
            </ErrorBoundary>
            <ErrorBoundary label="EfficiencyWidget" minimal>
              <EfficiencyGainWidget routes={routes} />
            </ErrorBoundary>
          </div>
        </div>

        {/* RIGHT — Detail pane */}
        <div className="pane" style={{ overflow: 'visible', position: 'relative', minWidth: 0 }}>
          <div style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {rightOpen && (
              <ErrorBoundary label="DetailPane" minimal>
                <DetailPane
                  route={selected}
                  onReOptimize={reOptimizeSelected}
                />
              </ErrorBoundary>
            )}
          </div>
          <button className="pane-toggle-btn right-toggle"
            onClick={() => setRightOpen(v => !v)}
            title={rightOpen ? 'Paneli Kapat' : 'Paneli Aç'}>
            {rightOpen ? '›' : '‹'}
          </button>
        </div>
      </div>

      <Footer weather={tweaks.weather} routes={routes} />

      <TweaksPanel
        open={tweaksOpen}
        onClose={() => setTweaksOpen(false)}
        tweaks={tweaks}
        setTweaks={handleTweaksChange}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary label="App">
    <App />
  </ErrorBoundary>
);
