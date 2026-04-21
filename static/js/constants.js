const { useState, useEffect, useMemo, useRef, Component } = React;

// API base — explicit same-origin URL so relative paths never misresolve
const API_BASE = window.location.origin;
console.log('[BOOT] API_BASE =', API_BASE);

const SIVAS_CENTER = [39.7477, 37.0179];

const TWEAK_DEFAULTS = { weather: 'fog', density: 'comfortable', accent: 'violet', layout: 'focus' };

window.LOGISTICS_DATA = {
  MODEL_STATS: { mae_min: '—', r2: '—', features_used: 26, top_features: {} },
  CIRCUITY: {},
};
