// ═══════════════════════════════════════════════════════════════
//  i18n — 3 dilli arayüz (TR / EN / RU)
//  Kullanım: t('key') veya const [lang, setLang] = useLang();
//  Çeviri eksikse TR'ye, TR'de de yoksa key'e fallback yapar.
// ═══════════════════════════════════════════════════════════════

const STRINGS = {
  tr: {
    // Genel
    app_title: 'LOJİSTİK KOMUTA',
    loading_model: 'Model yükleniyor…',
    loading_routes: 'Rotalar optimize ediliyor…',
    connection_error: 'BAĞLANTI HATASI',
    render_error: 'RENDER HATASI',
    check_console: 'Konsolu (F12) kontrol edin.',
    retry: 'Yeniden Dene',
    reload: 'Yeniden Yükle',
    component_crashed: 'çöktü',
    no_route_selected: 'Bir rota seçin',
    no_stop_detail: 'Bu rota için durak detayı yok.',

    // Severity
    sev_critical: 'KRİTİK',
    sev_warning: 'UYARI',
    sev_ok: 'NORMAL',

    // TopBar
    nav_overview: 'Genel Bakış',
    nav_winter: 'Kış Operasyonları',
    nav_fleet: 'Filo',
    nav_routes: 'Rotalar',
    nav_reports: 'Raporlar',
    chip_ai_active: 'AI motoru aktif',
    chip_secure: 'Bağlantı: güvenli',
    tooltip_tweaks: 'Tweaks',

    // Weather chips
    w_snow: 'KAR AKTİF',
    w_rain: 'YAĞMUR',
    w_fog: 'SİS AKTİF',
    w_wind: 'FIRTINA',
    w_clear: 'AÇIK HAVA',

    // FleetList
    fleet_active: 'Aktif Filo',
    tooltip_sort: 'Sırala',
    on_time: 'Zamanında',
    delay: 'Gecikme',

    // DetailPane
    tab_timeline: 'Zaman',
    tab_stops: 'Duraklar',
    tab_model: 'AI Model',
    stop_timeline: 'Durak Zaman Çizelgesi',
    legend_timeline: 'Yeşil = zamanında · Kırmızı = pencere kaçırıldı · Mavi şerit = teslimat penceresi',
    mode_compare: 'Karşılaştır',
    mode_original: 'Orjinal',
    mode_optimized: 'Opt.',
    current_plan: 'Mevcut Plan',
    on_time_delivery: 'Zamanında teslimat',
    apply_optimized: 'Optimize Planı Uygula',
    reoptimize: 'Yeniden Hesapla',

    // Model panel
    rf_model: 'Random Forest Model',
    metric_mae: 'MAE',
    metric_feature_count: 'Özellik',
    top_features: 'Önemli Özellikler',
    route_prediction: 'Bu Rota İçin Tahmin',
    rf_predicted_delay: 'RF tahmini toplam gecikme',
    delay_factor: 'Delay factor',
    confidence_mae: 'Güven (± MAE)',

    // Alerts
    alert_center: 'Uyarı Merkezi',
    alerts_active: 'aktif',
    no_alerts: 'Aktif uyarı yok.',
    alert_window_miss_risk: 'pencere kaçırma riski',
    alert_icy_window_risk: 'BUZLU YOL + pencere riski',
    alert_visibility: 'görüş',
    alert_delay_factor: 'Delay factor',
    alert_rf_delay: 'RF tahmini',
    alert_delay_min_suffix: 'dk gecikme',
    alert_arrival: 'varış',
    alert_window: 'pencere',
    alert_risk_score: 'Risk skoru',
    alert_congestion: 'tıkanıklık',
    map_route: 'ROTA',
    map_distance: 'MESAFE',

    // Tweaks
    tweaks: 'Tweaks',
    weather_scenario: 'Hava Senaryosu',
    density: 'Yoğunluk',
    accent_color: 'Renk Aksanı',
    layout: 'Düzen',
    weather_snow: 'Kar',
    weather_rain: 'Yağmur',
    weather_fog: 'Sis',
    weather_clear: 'Açık',
    density_compact: 'Kompakt',
    density_comfortable: 'Rahat',
    accent_cyan: 'Cyan',
    accent_lime: 'Lime',
    accent_violet: 'Mor',
    layout_split: 'Üçlü',
    layout_focus: 'Geniş Harita',

    // KPI strip
    kpi_active_routes: 'Aktif Rota',
    kpi_on_time_current: 'Zamanında (Mevcut)',
    kpi_on_time_optimized: 'Zamanında (Optimize)',
    kpi_total_delay_reduction: 'Toplam Gecikme Düşüşü',

    // Footer
    f_system: 'SİSTEM',
    f_optimizing: 'OPTİMİZE EDİYOR',
    f_weather: 'HAVA',
    f_route: 'ROTA',
    f_active: 'aktif',
    f_security: 'GÜVENLİK',
    f_high: 'YÜKSEK',
    f_model: 'MODEL',
    f_mae_short: 'MAE',

    // Efficiency widget
    efficiency_gain: 'VERİMLİLİK KAZANCI',

    // Lang toggle
    language: 'Dil',

    // Extra
    filter_all: 'Tümü',
    filter_critical: 'Kritik',
    filter_warning: 'Uyarı',
    filter_ok: 'İyi',
    unit_min: 'dk',
    unit_stops: 'durak',
    critical_alerts: 'kritik uyarı',
    optimizing: 'optimize ediliyor',
  },

  en: {
    app_title: 'LOGISTICS COMMAND',
    loading_model: 'Loading model…',
    loading_routes: 'Optimizing routes…',
    connection_error: 'CONNECTION ERROR',
    render_error: 'RENDER ERROR',
    check_console: 'Check the console (F12).',
    retry: 'Retry',
    reload: 'Reload',
    component_crashed: 'crashed',
    no_route_selected: 'Select a route',
    no_stop_detail: 'No stop details for this route.',

    sev_critical: 'CRITICAL',
    sev_warning: 'WARNING',
    sev_ok: 'NORMAL',

    nav_overview: 'Overview',
    nav_winter: 'Winter Ops',
    nav_fleet: 'Fleet',
    nav_routes: 'Routes',
    nav_reports: 'Reports',
    chip_ai_active: 'AI engine active',
    chip_secure: 'Connection: secure',
    tooltip_tweaks: 'Tweaks',

    w_snow: 'SNOW ACTIVE',
    w_rain: 'RAIN',
    w_fog: 'FOG ACTIVE',
    w_wind: 'STORM',
    w_clear: 'CLEAR',

    fleet_active: 'Active Fleet',
    tooltip_sort: 'Sort',
    on_time: 'On Time',
    delay: 'Delay',

    tab_timeline: 'Timeline',
    tab_stops: 'Stops',
    tab_model: 'AI Model',
    stop_timeline: 'Stop Timeline',
    legend_timeline: 'Green = on time · Red = window missed · Blue strip = delivery window',
    mode_compare: 'Compare',
    mode_original: 'Original',
    mode_optimized: 'Opt.',
    current_plan: 'Current Plan',
    on_time_delivery: 'On-time delivery',
    apply_optimized: 'Apply Optimized Plan',
    reoptimize: 'Re-optimize',

    rf_model: 'Random Forest Model',
    metric_mae: 'MAE',
    metric_feature_count: 'Features',
    top_features: 'Top Features',
    route_prediction: 'Prediction for This Route',
    rf_predicted_delay: 'RF predicted total delay',
    delay_factor: 'Delay factor',
    confidence_mae: 'Confidence (± MAE)',

    alert_center: 'Alert Center',
    alerts_active: 'active',
    no_alerts: 'No active alerts.',
    alert_window_miss_risk: 'time window miss risk',
    alert_icy_window_risk: 'ICY ROAD + window risk',
    alert_visibility: 'visibility',
    alert_delay_factor: 'Delay factor',
    alert_rf_delay: 'RF predicted',
    alert_delay_min_suffix: 'min delay',
    alert_arrival: 'arrival',
    alert_window: 'window',
    alert_risk_score: 'Risk score',
    alert_congestion: 'congestion',
    map_route: 'ROUTE',
    map_distance: 'DISTANCE',

    tweaks: 'Tweaks',
    weather_scenario: 'Weather Scenario',
    density: 'Density',
    accent_color: 'Accent Color',
    layout: 'Layout',
    weather_snow: 'Snow',
    weather_rain: 'Rain',
    weather_fog: 'Fog',
    weather_clear: 'Clear',
    density_compact: 'Compact',
    density_comfortable: 'Comfortable',
    accent_cyan: 'Cyan',
    accent_lime: 'Lime',
    accent_violet: 'Violet',
    layout_split: 'Split',
    layout_focus: 'Wide Map',

    kpi_active_routes: 'Active Routes',
    kpi_on_time_current: 'On Time (Current)',
    kpi_on_time_optimized: 'On Time (Optimized)',
    kpi_total_delay_reduction: 'Total Delay Reduction',

    f_system: 'SYSTEM',
    f_optimizing: 'OPTIMIZING',
    f_weather: 'WEATHER',
    f_route: 'ROUTE',
    f_active: 'active',
    f_security: 'SECURITY',
    f_high: 'HIGH',
    f_model: 'MODEL',
    f_mae_short: 'MAE',

    efficiency_gain: 'EFFICIENCY GAIN',

    language: 'Language',

    filter_all: 'All',
    filter_critical: 'Critical',
    filter_warning: 'Warning',
    filter_ok: 'OK',
    unit_min: 'min',
    unit_stops: 'stops',
    critical_alerts: 'critical alerts',
    optimizing: 'optimizing',
  },

  ru: {
    app_title: 'ЛОГИСТИЧЕСКИЙ ЦЕНТР',
    loading_model: 'Загрузка модели…',
    loading_routes: 'Оптимизация маршрутов…',
    connection_error: 'ОШИБКА СОЕДИНЕНИЯ',
    render_error: 'ОШИБКА ОТРИСОВКИ',
    check_console: 'Проверьте консоль (F12).',
    retry: 'Повторить',
    reload: 'Перезагрузить',
    component_crashed: 'сломался',
    no_route_selected: 'Выберите маршрут',
    no_stop_detail: 'Нет данных об остановках.',

    sev_critical: 'КРИТИЧНО',
    sev_warning: 'ВНИМАНИЕ',
    sev_ok: 'НОРМА',

    nav_overview: 'Обзор',
    nav_winter: 'Зимние операции',
    nav_fleet: 'Автопарк',
    nav_routes: 'Маршруты',
    nav_reports: 'Отчёты',
    chip_ai_active: 'ИИ активен',
    chip_secure: 'Соединение: безопасное',
    tooltip_tweaks: 'Настройки',

    w_snow: 'СНЕГ',
    w_rain: 'ДОЖДЬ',
    w_fog: 'ТУМАН',
    w_wind: 'БУРЯ',
    w_clear: 'ЯСНО',

    fleet_active: 'Активный автопарк',
    tooltip_sort: 'Сортировать',
    on_time: 'Вовремя',
    delay: 'Задержка',

    tab_timeline: 'График',
    tab_stops: 'Остановки',
    tab_model: 'AI модель',
    stop_timeline: 'График остановок',
    legend_timeline: 'Зелёный = вовремя · Красный = окно пропущено · Синяя полоса = окно доставки',
    mode_compare: 'Сравнить',
    mode_original: 'Исходный',
    mode_optimized: 'Опт.',
    current_plan: 'Текущий план',
    on_time_delivery: 'Доставка вовремя',
    apply_optimized: 'Применить оптимизацию',
    reoptimize: 'Пересчитать',

    rf_model: 'Random Forest модель',
    metric_mae: 'MAE',
    metric_feature_count: 'Признаки',
    top_features: 'Ключевые признаки',
    route_prediction: 'Прогноз для маршрута',
    rf_predicted_delay: 'RF прогноз задержки',
    delay_factor: 'Коэффициент задержки',
    confidence_mae: 'Доверие (± MAE)',

    alert_center: 'Центр оповещений',
    alerts_active: 'активных',
    no_alerts: 'Нет активных оповещений.',
    alert_window_miss_risk: 'риск пропуска окна',
    alert_icy_window_risk: 'ГОЛОЛЁД + риск окна',
    alert_visibility: 'видимость',
    alert_delay_factor: 'Коэф. задержки',
    alert_rf_delay: 'RF прогноз',
    alert_delay_min_suffix: 'мин задержки',
    alert_arrival: 'прибытие',
    alert_window: 'окно',
    alert_risk_score: 'Оценка риска',
    alert_congestion: 'загруженность',
    map_route: 'МАРШРУТ',
    map_distance: 'РАССТОЯНИЕ',

    tweaks: 'Настройки',
    weather_scenario: 'Погодный сценарий',
    density: 'Плотность',
    accent_color: 'Акцентный цвет',
    layout: 'Макет',
    weather_snow: 'Снег',
    weather_rain: 'Дождь',
    weather_fog: 'Туман',
    weather_clear: 'Ясно',
    density_compact: 'Компактно',
    density_comfortable: 'Просторно',
    accent_cyan: 'Циан',
    accent_lime: 'Лайм',
    accent_violet: 'Фиолет',
    layout_split: 'Три панели',
    layout_focus: 'Карта',

    kpi_active_routes: 'Активные маршруты',
    kpi_on_time_current: 'Вовремя (сейчас)',
    kpi_on_time_optimized: 'Вовремя (опт.)',
    kpi_total_delay_reduction: 'Снижение задержки',

    f_system: 'СИСТЕМА',
    f_optimizing: 'ОПТИМИЗАЦИЯ',
    f_weather: 'ПОГОДА',
    f_route: 'МАРШРУТ',
    f_active: 'активно',
    f_security: 'БЕЗОПАСНОСТЬ',
    f_high: 'ВЫСОКИЙ',
    f_model: 'МОДЕЛЬ',
    f_mae_short: 'MAE',

    efficiency_gain: 'ПРИРОСТ ЭФФЕКТИВНОСТИ',

    language: 'Язык',

    filter_all: 'Все',
    filter_critical: 'Критично',
    filter_warning: 'Внимание',
    filter_ok: 'Норма',
    unit_min: 'мин',
    unit_stops: 'остановок',
    critical_alerts: 'критических',
    optimizing: 'оптимизация',
  },
};

// ───────────────────────────────────────────────────────────────
// Dil durumu — global, localStorage persisted, observable
// ───────────────────────────────────────────────────────────────
const LangStore = {
  lang: (() => {
    try {
      const saved = localStorage.getItem('sivas-lang');
      return (saved === 'tr' || saved === 'en' || saved === 'ru') ? saved : 'en';
    } catch { return 'en'; }
  })(),
  listeners: new Set(),
  set(l) {
    if (l !== 'tr' && l !== 'en' && l !== 'ru') return;
    this.lang = l;
    try { localStorage.setItem('sivas-lang', l); } catch {}
    document.documentElement.setAttribute('lang', l);
    this.listeners.forEach(fn => { try { fn(l); } catch {} });
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
};
document.documentElement.setAttribute('lang', LangStore.lang);

// t(key) — geçerli dilde metni döndür, fallback TR → key
function t(key, lang) {
  const L = lang || LangStore.lang;
  const dict = STRINGS[L] || STRINGS.tr;
  if (dict && dict[key] != null) return dict[key];
  if (STRINGS.tr && STRINGS.tr[key] != null) return STRINGS.tr[key];
  return key;
}

// useLang() — React hook, [lang, setLang]
function useLang() {
  const [lang, setLocal] = React.useState(LangStore.lang);
  React.useEffect(() => LangStore.subscribe(setLocal), []);
  return [lang, (l) => LangStore.set(l)];
}

// Global expose — Babel standalone'da scriptler IIFE'ye sarıldığı için
window.t = t;
window.useLang = useLang;
window.LangStore = LangStore;
window.STRINGS = STRINGS;
