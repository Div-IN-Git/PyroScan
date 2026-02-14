const map = L.map("map", {
  zoomControl: false,
  minZoom: 2,
  maxZoom: 8,
  worldCopyJump: true,
  preferCanvas: true,
}).setView([20, 0], 2);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 19,
  crossOrigin: true,
}).addTo(map);

const heatLayer = L.heatLayer([], {
  radius: 28,
  blur: 22,
  maxZoom: 6,
  gradient: {
    0.0: "#3ddc84",
    0.3: "#9be45b",
    0.55: "#ffc857",
    0.75: "#ff7f50",
    1.0: "#9c1127",
  },
}).addTo(map);

const zoneLayer = L.layerGroup().addTo(map);

const regions = [
  {
    id: "global",
    name: "Global View",
    group: "Global",
    bounds: [[-55, -180], [75, 180]],
    center: [20, 0],
    zoom: 2,
    seed: 11,
    baseRisk: 0.45,
    pointCount: 320,
    grid: { rows: 7, cols: 12 },
    hotspots: [
      { lat: 37.5, lng: -120.5, radius: 750, boost: 0.45 },
      { lat: -8, lng: -62, radius: 900, boost: 0.5 },
      { lat: 42, lng: 15, radius: 650, boost: 0.45 },
      { lat: 35, lng: 105, radius: 900, boost: 0.35 },
      { lat: -25, lng: 135, radius: 1000, boost: 0.55 },
      { lat: 15, lng: 100, radius: 750, boost: 0.4 },
      { lat: 55, lng: 90, radius: 850, boost: 0.4 },
      { lat: -20, lng: 28, radius: 650, boost: 0.35 },
    ],
  },
  {
    id: "north-america",
    name: "North America",
    group: "Continents",
    bounds: [[7, -170], [83, -50]],
    center: [45, -105],
    zoom: 3,
    seed: 21,
    baseRisk: 0.5,
    pointCount: 180,
    grid: { rows: 6, cols: 10 },
    hotspots: [
      { lat: 37, lng: -119, radius: 500, boost: 0.45 },
      { lat: 61, lng: -137, radius: 700, boost: 0.35 },
    ],
  },
  {
    id: "south-america",
    name: "South America",
    group: "Continents",
    bounds: [[-56, -82], [13, -34]],
    center: [-20, -60],
    zoom: 3,
    seed: 22,
    baseRisk: 0.58,
    pointCount: 170,
    grid: { rows: 6, cols: 8 },
    hotspots: [
      { lat: -8, lng: -62, radius: 650, boost: 0.55 },
      { lat: -34, lng: -71, radius: 450, boost: 0.35 },
    ],
  },
  {
    id: "europe",
    name: "Europe",
    group: "Continents",
    bounds: [[35, -11], [71, 40]],
    center: [50, 15],
    zoom: 4,
    seed: 23,
    baseRisk: 0.48,
    pointCount: 150,
    grid: { rows: 6, cols: 9 },
    hotspots: [
      { lat: 41, lng: 14, radius: 400, boost: 0.4 },
      { lat: 40, lng: -4, radius: 350, boost: 0.35 },
    ],
  },
  {
    id: "africa",
    name: "Africa",
    group: "Continents",
    bounds: [[-35, -17], [37, 52]],
    center: [4, 20],
    zoom: 3,
    seed: 24,
    baseRisk: 0.62,
    pointCount: 180,
    grid: { rows: 6, cols: 9 },
    hotspots: [
      { lat: 16, lng: 10, radius: 650, boost: 0.55 },
      { lat: -18, lng: 28, radius: 450, boost: 0.35 },
    ],
  },
  {
    id: "asia",
    name: "Asia",
    group: "Continents",
    bounds: [[5, 30], [65, 150]],
    center: [35, 90],
    zoom: 3,
    seed: 25,
    baseRisk: 0.56,
    pointCount: 200,
    grid: { rows: 6, cols: 11 },
    hotspots: [
      { lat: 23, lng: 78, radius: 600, boost: 0.5 },
      { lat: 13, lng: 104, radius: 500, boost: 0.45 },
      { lat: 55, lng: 90, radius: 800, boost: 0.4 },
    ],
  },
  {
    id: "oceania",
    name: "Oceania",
    group: "Continents",
    bounds: [[-50, 110], [10, 180]],
    center: [-22, 145],
    zoom: 3,
    seed: 26,
    baseRisk: 0.6,
    pointCount: 140,
    grid: { rows: 5, cols: 9 },
    hotspots: [
      { lat: -33, lng: 146, radius: 500, boost: 0.55 },
      { lat: -13, lng: 130, radius: 450, boost: 0.4 },
    ],
  },
  {
    id: "california",
    name: "California, USA",
    group: "Countries & States",
    bounds: [[32, -124.5], [42.2, -113.8]],
    center: [37, -119],
    zoom: 6,
    seed: 31,
    baseRisk: 0.72,
    pointCount: 140,
    grid: { rows: 6, cols: 8 },
    hotspots: [
      { lat: 38.5, lng: -121.5, radius: 180, boost: 0.5 },
      { lat: 34.2, lng: -118.4, radius: 160, boost: 0.45 },
    ],
  },
  {
    id: "british-columbia",
    name: "British Columbia, Canada",
    group: "Countries & States",
    bounds: [[48, -139], [60, -114]],
    center: [54, -126],
    zoom: 5,
    seed: 32,
    baseRisk: 0.62,
    pointCount: 120,
    grid: { rows: 5, cols: 7 },
    hotspots: [{ lat: 52.5, lng: -123, radius: 220, boost: 0.4 }],
  },
  {
    id: "amazon-basin",
    name: "Amazon Basin, Brazil",
    group: "Countries & States",
    bounds: [[-12, -75], [5, -50]],
    center: [-5, -63],
    zoom: 5,
    seed: 33,
    baseRisk: 0.78,
    pointCount: 160,
    grid: { rows: 6, cols: 8 },
    hotspots: [
      { lat: -6, lng: -62, radius: 280, boost: 0.55 },
      { lat: -2, lng: -58, radius: 260, boost: 0.45 },
    ],
  },
  {
    id: "mediterranean",
    name: "Mediterranean Basin",
    group: "Critical Zones",
    bounds: [[30, -10], [46, 38]],
    center: [38, 18],
    zoom: 5,
    seed: 34,
    baseRisk: 0.7,
    pointCount: 160,
    grid: { rows: 6, cols: 9 },
    hotspots: [
      { lat: 40, lng: 23, radius: 220, boost: 0.5 },
      { lat: 39, lng: -2, radius: 220, boost: 0.45 },
    ],
  },
  {
    id: "sahel",
    name: "Sahel Belt",
    group: "Critical Zones",
    bounds: [[12, -17], [20, 35]],
    center: [16, 9],
    zoom: 5,
    seed: 35,
    baseRisk: 0.66,
    pointCount: 140,
    grid: { rows: 5, cols: 9 },
    hotspots: [{ lat: 16, lng: 14, radius: 300, boost: 0.45 }],
  },
  {
    id: "siberia",
    name: "Siberian Taiga",
    group: "Critical Zones",
    bounds: [[52, 60], [70, 140]],
    center: [61, 100],
    zoom: 4,
    seed: 36,
    baseRisk: 0.6,
    pointCount: 150,
    grid: { rows: 5, cols: 9 },
    hotspots: [{ lat: 60, lng: 110, radius: 400, boost: 0.45 }],
  },
  {
    id: "india-central",
    name: "Central India",
    group: "Countries & States",
    bounds: [[16, 72], [28, 86]],
    center: [22, 79],
    zoom: 5,
    seed: 37,
    baseRisk: 0.68,
    pointCount: 140,
    grid: { rows: 6, cols: 8 },
    hotspots: [{ lat: 21, lng: 81, radius: 250, boost: 0.45 }],
  },
  {
    id: "indonesia",
    name: "Indonesia (Sumatra + Java)",
    group: "Countries & States",
    bounds: [[-9, 95], [6, 120]],
    center: [-2, 110],
    zoom: 5,
    seed: 38,
    baseRisk: 0.7,
    pointCount: 140,
    grid: { rows: 5, cols: 8 },
    hotspots: [
      { lat: -2, lng: 102, radius: 250, boost: 0.5 },
      { lat: -7, lng: 112, radius: 230, boost: 0.45 },
    ],
  },
  {
    id: "australia-nsw",
    name: "New South Wales, Australia",
    group: "Countries & States",
    bounds: [[-38, 140], [-28, 154]],
    center: [-33, 147],
    zoom: 6,
    seed: 39,
    baseRisk: 0.74,
    pointCount: 120,
    grid: { rows: 5, cols: 7 },
    hotspots: [{ lat: -34, lng: 149, radius: 180, boost: 0.5 }],
  },
  {
    id: "spain",
    name: "Spain",
    group: "Countries & States",
    bounds: [[36, -9.5], [44, 3.5]],
    center: [40, -3],
    zoom: 6,
    seed: 40,
    baseRisk: 0.63,
    pointCount: 120,
    grid: { rows: 5, cols: 7 },
    hotspots: [{ lat: 39.5, lng: -1, radius: 180, boost: 0.4 }],
  },
  {
    id: "greece",
    name: "Greece",
    group: "Countries & States",
    bounds: [[34, 19], [42, 29]],
    center: [38.5, 23.5],
    zoom: 6,
    seed: 41,
    baseRisk: 0.66,
    pointCount: 110,
    grid: { rows: 5, cols: 7 },
    hotspots: [{ lat: 38.3, lng: 23.9, radius: 150, boost: 0.45 }],
  },
  {
    id: "south-africa",
    name: "Western Cape, South Africa",
    group: "Countries & States",
    bounds: [[-35, 17], [-31, 21]],
    center: [-33.5, 19],
    zoom: 7,
    seed: 42,
    baseRisk: 0.6,
    pointCount: 100,
    grid: { rows: 4, cols: 6 },
    hotspots: [{ lat: -33.7, lng: 18.6, radius: 120, boost: 0.4 }],
  },
];

const fallbackPlaces = [
  { name: "California, USA", lat: 36.7, lon: -119.5, zoom: 6 },
  { name: "Amazon Basin", lat: -5.5, lon: -63, zoom: 5 },
  { name: "Mediterranean Basin", lat: 38, lon: 18, zoom: 5 },
  { name: "Greece", lat: 38.5, lon: 23.5, zoom: 6 },
  { name: "Sydney, Australia", lat: -33.86, lon: 151.2, zoom: 7 },
  { name: "Jakarta, Indonesia", lat: -6.2, lon: 106.8, zoom: 7 },
  { name: "New Delhi, India", lat: 28.6, lon: 77.2, zoom: 7 },
  { name: "Sao Paulo, Brazil", lat: -23.5, lon: -46.6, zoom: 7 },
  { name: "Lisbon, Portugal", lat: 38.7, lon: -9.1, zoom: 7 },
  { name: "Cape Town, South Africa", lat: -33.9, lon: 18.4, zoom: 7 },
];

const regionData = {};
const forecastDates = Array.from({ length: 10 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d;
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function formatDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function classifyRisk(riskIndex) {
  if (!Number.isFinite(riskIndex)) return "Unknown";
  if (riskIndex < 0.3) return "Low";
  if (riskIndex < 0.5) return "Moderate";
  if (riskIndex < 0.7) return "High";
  return "Extreme";
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function normalizeBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 2) return null;
  const south = Number(bounds[0][0]);
  const west = Number(bounds[0][1]);
  const north = Number(bounds[1][0]);
  const east = Number(bounds[1][1]);

  if (
    !Number.isFinite(south) ||
    !Number.isFinite(west) ||
    !Number.isFinite(north) ||
    !Number.isFinite(east)
  ) {
    return null;
  }

  const minLat = Math.min(south, north);
  const maxLat = Math.max(south, north);
  const minLng = Math.min(west, east);
  const maxLng = Math.max(west, east);
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

function fallbackBounds(lat, lon, zoom = 6) {
  const zoomSpanByLevel = {
    2: 40,
    3: 24,
    4: 14,
    5: 8,
    6: 4.5,
    7: 2.8,
    8: 1.8,
  };
  const spanLat = zoomSpanByLevel[zoom] || 6;
  const spanLng = spanLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.35);
  return [
    [lat - spanLat * 0.5, lon - spanLng * 0.5],
    [lat + spanLat * 0.5, lon + spanLng * 0.5],
  ];
}

function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const avgLat = (lat1 + lat2) * 0.5 * rad;
  const dx = (lon2 - lon1) * Math.cos(avgLat) * 111;
  const dy = (lat2 - lat1) * 111;
  return Math.hypot(dx, dy);
}

function hotspotBoost(lat, lon, hotspots = []) {
  return hotspots.reduce((sum, spot) => {
    const dist = distanceKm(lat, lon, spot.lat, spot.lng);
    const influence = clamp(1 - dist / spot.radius, 0, 1);
    return sum + influence * spot.boost;
  }, 0);
}

function dayFactor(region, dayIndex) {
  const phase = (region.seed % 13) / 13 * Math.PI * 2;
  const wave = Math.sin((dayIndex / 9) * Math.PI * 1.7 + phase) * 0.2;
  const drift = (dayIndex - 4.5) * 0.015;
  return clamp(0.85 + wave + drift, 0.6, 1.15);
}

const ML_PREDICT_TIMEOUT_MS = 950;

function computeRegionPeakDay(days) {
  if (!Array.isArray(days) || days.length === 0) return 0;
  let peakDay = 0;
  days.forEach((day, index) => {
    if ((day?.riskAvg || 0) > (days[peakDay]?.riskAvg || 0)) {
      peakDay = index;
    }
  });
  return peakDay;
}

function buildDaySignals(region, dayIndex, riskAvg) {
  const signalRng = makeRng(region.seed * 100 + dayIndex * 113);
  const thermalCeiling = clamp(0.8 + region.baseRisk * 0.12, 0.82, 0.9);
  return {
    thermal: clamp(0.24 + riskAvg * 0.5 + signalRng() * 0.14 - 0.07, 0.2, thermalCeiling),
    vegetation: clamp(0.35 + riskAvg * 0.6 + signalRng() * 0.18 - 0.05, 0, 1),
    wind: clamp(0.25 + riskAvg * 0.7 + signalRng() * 0.22 - 0.08, 0, 1),
    human: clamp(0.28 + riskAvg * 0.55 + signalRng() * 0.25 - 0.07, 0, 1),
  };
}

function deterministicFallbackTileValue(region, dayIndex, tileMeta) {
  const seed = hashString(`${region.id}|${dayIndex}|${tileMeta.id}`);
  const rng = makeRng(seed);
  const lat = Number(tileMeta.lat || 0);
  const lng = Number(tileMeta.lng || 0);
  const factor = dayFactor(region, dayIndex);
  const hotspot = hotspotBoost(lat, lng, region.hotspots);

  const thermal = clamp(
    0.86 + Math.sin((dayIndex + 1) * 0.55 + lat * 0.06) * 0.1 + rng() * 0.05,
    0.72,
    1.25
  );
  const vegetation = clamp(
    0.85 + Math.cos((dayIndex + 2) * 0.41 + lng * 0.04) * 0.11 + rng() * 0.04,
    0.7,
    1.25
  );
  const wind = clamp(
    0.82 + Math.sin((dayIndex + 3) * 0.63 + (lat - lng) * 0.02) * 0.12 + rng() * 0.06,
    0.68,
    1.35
  );
  const human = clamp(
    0.84 + Math.cos((dayIndex + 4) * 0.27 + (lat + lng) * 0.03) * 0.09 + rng() * 0.05,
    0.7,
    1.25
  );
  const noise = (rng() - 0.5) * 0.05;

  let value = region.baseRisk * factor * thermal * vegetation * wind * human;
  value += hotspot * 0.32 + noise;
  return clamp(value, 0, 1);
}

function recalculateDayStats(region, dayIndex, dayData) {
  let riskSum = 0;
  let highCount = 0;
  dayData.tiles.forEach((tile) => {
    const value = clamp(Number(tile.value) || 0, 0, 1);
    tile.value = value;
    riskSum += value;
    if (value > 0.75) highCount += 1;
  });
  const riskAvg = dayData.tiles.length ? riskSum / dayData.tiles.length : 0;
  dayData.riskAvg = riskAvg;
  dayData.highCount = highCount;
  dayData.signals = buildDaySignals(region, dayIndex, riskAvg);
}

function tileFromPoint(dayData, lat, lng) {
  const meta = dayData.gridMeta;
  if (!meta) return 0;
  const row = clamp(Math.floor((lat - meta.minLat) / meta.latStep), 0, meta.rows - 1);
  const col = clamp(Math.floor((lng - meta.minLng) / meta.lngStep), 0, meta.cols - 1);
  const tile = dayData.tiles[row * meta.cols + col];
  return clamp(Number(tile?.value || 0), 0, 1);
}

function refreshHeatPointsFromTiles(dayData) {
  dayData.points = dayData.points.map(([lat, lng, previousIntensity]) => {
    const tileValue = tileFromPoint(dayData, lat, lng);
    const merged = tileValue * 0.82 + clamp(Number(previousIntensity) || 0, 0, 1) * 0.18;
    return [lat, lng, clamp(merged, 0, 1)];
  });
}

function withTimeout(promise, timeoutMs) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("Predictor timeout"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
}

function normalizePredictionMap(raw, tiles) {
  let map = null;
  if (raw instanceof Map) {
    map = raw;
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    map = new Map(Object.entries(raw));
  }

  if (!map || map.size === 0) return null;
  for (const tile of tiles) {
    if (!map.has(tile.id)) return null;
    const value = Number(map.get(tile.id));
    if (!Number.isFinite(value)) return null;
  }
  return map;
}

function tilePredictorInput(tile) {
  return {
    id: tile.id,
    bbox: tile.bounds,
    lat: tile.lat,
    lng: tile.lng,
  };
}

async function enrichDayWithPredictor(region, dayIndex, dayData) {
  if (typeof window.predictTiles !== "function") {
    dayData.mlSource = "fallback";
    return;
  }

  try {
    const predictionPayload = await withTimeout(
      window.predictTiles(region, dayIndex, dayData.tiles.map(tilePredictorInput)),
      ML_PREDICT_TIMEOUT_MS
    );
    const predictionMap = normalizePredictionMap(predictionPayload, dayData.tiles);
    if (!predictionMap) {
      throw new Error("Predictor returned invalid payload.");
    }

    dayData.tiles.forEach((tile) => {
      tile.value = clamp(Number(predictionMap.get(tile.id)), 0, 1);
    });
    refreshHeatPointsFromTiles(dayData);
    recalculateDayStats(region, dayIndex, dayData);
    dayData.mlSource = "ml";
    dayData.mlError = null;
  } catch (error) {
    dayData.mlSource = "fallback";
    dayData.mlError = String(error?.message || error);
  }

  const entry = regionData[region.id];
  if (entry) {
    entry.peakDay = computeRegionPeakDay(entry.days);
  }
  if (activeRegion?.id === region.id && regionData[region.id]?.days?.[activeDay]) {
    updateUI();
  }
}

function generateRegionDay(region, dayIndex) {
  const rng = makeRng(region.seed * 1000 + dayIndex * 97);
  const points = [];
  const tiles = [];
  const [minLat, minLng] = region.bounds[0];
  const [maxLat, maxLng] = region.bounds[1];
  const rows = region.grid?.rows || 5;
  const cols = region.grid?.cols || 7;
  const latStep = (maxLat - minLat) / rows;
  const lngStep = (maxLng - minLng) / cols;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const tileMinLat = minLat + r * latStep;
      const tileMinLng = minLng + c * lngStep;
      const tileMaxLat = tileMinLat + latStep;
      const tileMaxLng = tileMinLng + lngStep;
      const centerLat = tileMinLat + latStep * 0.5;
      const centerLng = tileMinLng + lngStep * 0.5;
      const id = `${region.id}:${dayIndex}:${r}:${c}`;

      tiles.push({
        id,
        row: r,
        col: c,
        lat: centerLat,
        lng: centerLng,
        bounds: [
          [tileMinLat, tileMinLng],
          [tileMaxLat, tileMaxLng],
        ],
        value: deterministicFallbackTileValue(region, dayIndex, {
          id,
          lat: centerLat,
          lng: centerLng,
        }),
      });
    }
  }

  for (let i = 0; i < region.pointCount; i += 1) {
    const lat = minLat + (maxLat - minLat) * rng();
    const lng = minLng + (maxLng - minLng) * rng();
    const row = clamp(Math.floor((lat - minLat) / latStep), 0, rows - 1);
    const col = clamp(Math.floor((lng - minLng) / lngStep), 0, cols - 1);
    const tile = tiles[row * cols + col];
    const jitter = (rng() - 0.5) * 0.08;
    const intensity = clamp((tile?.value || region.baseRisk) + jitter, 0, 1);
    points.push([lat, lng, intensity]);
  }

  const dayData = {
    points,
    tiles,
    riskAvg: 0,
    highCount: 0,
    signals: {
      thermal: 0,
      vegetation: 0,
      wind: 0,
      human: 0,
    },
    mlSource: "fallback",
    mlError: null,
    gridMeta: {
      minLat,
      minLng,
      maxLat,
      maxLng,
      rows,
      cols,
      latStep,
      lngStep,
    },
  };

  recalculateDayStats(region, dayIndex, dayData);
  window.setTimeout(() => {
    void enrichDayWithPredictor(region, dayIndex, dayData);
  }, 0);

  return dayData;
}

function buildRegionData() {
  regions.forEach((region) => {
    buildRegionEntry(region);
  });
}

buildRegionData();

const ui = {
  dayChips: document.getElementById("dayChips"),
  daySlider: document.getElementById("daySlider"),
  dayLabel: document.getElementById("dayLabel"),
  regionName: document.getElementById("regionName"),
  regionRisk: document.getElementById("regionRisk"),
  regionTiles: document.getElementById("regionTiles"),
  regionPeak: document.getElementById("regionPeak"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadStatus: document.getElementById("downloadStatus"),
  heatToggle: document.getElementById("heatToggle"),
  zoneToggle: document.getElementById("zoneToggle"),
  signalThermal: document.getElementById("signalThermal"),
  signalVeg: document.getElementById("signalVeg"),
  signalWind: document.getElementById("signalWind"),
  signalHuman: document.getElementById("signalHuman"),
  regionGroups: document.getElementById("regionGroups"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  searchStatus: document.getElementById("searchStatus"),
  searchResults: document.getElementById("searchResults"),
  autoPlayBtn: document.getElementById("autoPlayBtn"),
};

let activeRegion = regions[0];
let activeDay = 0;
let autoplayId = null;
let searchRegion = null;

function buildRegionEntry(region) {
  const days = [];
  for (let i = 0; i < 10; i += 1) {
    days.push(generateRegionDay(region, i));
  }
  regionData[region.id] = {
    days,
    peakDay: computeRegionPeakDay(days),
  };
}

function createSearchRegion(item) {
  const name = String(item.name || "Searched Region");
  const shortName = name.split(",")[0].trim() || "Searched Region";
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  const validLat = Number.isFinite(lat) ? lat : 0;
  const validLon = Number.isFinite(lon) ? lon : 0;
  const bounds =
    normalizeBounds(item.bounds) || fallbackBounds(validLat, validLon, Number(item.zoom) || 6);
  const [southWest, northEast] = bounds;
  const minLat = southWest[0];
  const minLng = southWest[1];
  const maxLat = northEast[0];
  const maxLng = northEast[1];
  const centerLat = (minLat + maxLat) * 0.5;
  const centerLng = (minLng + maxLng) * 0.5;
  const latSpan = Math.max(maxLat - minLat, 0.6);
  const lngSpan = Math.max(maxLng - minLng, 0.6);
  const areaFactor = clamp((latSpan * lngSpan) / 18, 0.8, 3.5);
  const seed = hashString(`${name}-${centerLat.toFixed(4)}-${centerLng.toFixed(4)}`);
  const localRng = makeRng(seed);

  return {
    id: `search-${seed}`,
    name: shortName,
    group: "Search Result",
    bounds: [
      [centerLat - latSpan * 0.5, centerLng - lngSpan * 0.5],
      [centerLat + latSpan * 0.5, centerLng + lngSpan * 0.5],
    ],
    center: [centerLat, centerLng],
    zoom: Number(item.zoom) || 6,
    seed,
    baseRisk: clamp(0.45 + localRng() * 0.24, 0.4, 0.72),
    pointCount: Math.round(clamp(120 + areaFactor * 75, 120, 360)),
    grid: {
      rows: Math.round(clamp(6 + latSpan * 1.25, 6, 16)),
      cols: Math.round(clamp(6 + lngSpan * 1.0, 6, 18)),
    },
    hotspots: [
      {
        lat: centerLat + (localRng() - 0.5) * latSpan * 0.35,
        lng: centerLng + (localRng() - 0.5) * lngSpan * 0.35,
        radius: 160 + areaFactor * 130,
        boost: 0.45 + localRng() * 0.15,
      },
      {
        lat: centerLat + (localRng() - 0.5) * latSpan * 0.5,
        lng: centerLng + (localRng() - 0.5) * lngSpan * 0.5,
        radius: 130 + areaFactor * 110,
        boost: 0.32 + localRng() * 0.12,
      },
    ],
  };
}

function applySearchRegion(item) {
  searchRegion = createSearchRegion(item);
  buildRegionEntry(searchRegion);
  setRegion(searchRegion);
}

function getWindProfile(region, dayIndex, windSignal) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const directionIndex = Math.abs((region.seed + dayIndex * 3) % directions.length);
  const windSpeed = Math.round(clamp(8 + (windSignal || 0) * 34, 8, 42));
  return { windDirection: directions[directionIndex], windSpeed };
}

function getTileCenter(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 2) {
    return { latitude: 0, longitude: 0 };
  }
  const min = bounds[0] || [0, 0];
  const max = bounds[1] || [0, 0];
  const latitude = ((Number(min[0]) || 0) + (Number(max[0]) || 0)) * 0.5;
  const longitude = ((Number(min[1]) || 0) + (Number(max[1]) || 0)) * 0.5;
  return { latitude, longitude };
}

function buildTileRiskData(region, dayIndex, day) {
  if (!day || !Array.isArray(day.tiles)) return [];
  const tilesSeed = makeRng(region.seed * 700 + dayIndex * 43);

  return day.tiles.map((tile, index) => {
    const riskScore = clamp(tile?.value ?? day.riskAvg ?? 0, 0, 1);
    const randomDrift = tilesSeed() * 0.08 - 0.04;
    const thermalAnomaly = clamp((day.signals?.thermal ?? riskScore) * (0.88 + riskScore * 0.16) + randomDrift, 0, 1);
    const vegetationStress = clamp((day.signals?.vegetation ?? riskScore) * (0.84 + riskScore * 0.2) - randomDrift * 0.3, 0, 1);
    const windAmplifier = clamp((day.signals?.wind ?? riskScore) * (0.8 + riskScore * 0.28) + randomDrift * 0.2, 0, 1);
    const humanProximity = clamp((day.signals?.human ?? riskScore) * (0.82 + riskScore * 0.24) + randomDrift * 0.15, 0, 1);
    const spreadProbability = clamp(
      thermalAnomaly * 0.35 +
        vegetationStress * 0.25 +
        windAmplifier * 0.25 +
        humanProximity * 0.15,
      0,
      1
    );
    const center = getTileCenter(tile?.bounds);

    return {
      tileId: `${region.id}-${dayIndex + 1}-${index + 1}`,
      latitude: Number(center.latitude.toFixed(5)),
      longitude: Number(center.longitude.toFixed(5)),
      riskScore: Number(riskScore.toFixed(4)),
      riskCategory: classifyRisk(riskScore),
      thermalAnomaly: Number(thermalAnomaly.toFixed(4)),
      vegetationStress: Number(vegetationStress.toFixed(4)),
      windAmplifier: Number(windAmplifier.toFixed(4)),
      humanProximity: Number(humanProximity.toFixed(4)),
      spreadProbability: Number(spreadProbability.toFixed(4)),
    };
  });
}

function getCurrentRiskData() {
  const dayEntry = regionData[activeRegion.id]?.days?.[activeDay];
  if (!dayEntry) {
    return {
      region: activeRegion?.name || "Unknown Region",
      riskIndex: 0,
      classification: "Unknown",
      forecast: [],
      riskTiles: [],
      timestamp: new Date().toISOString(),
    };
  }

  const windProfile = getWindProfile(activeRegion, activeDay, dayEntry.signals?.wind);
  const forecast = (regionData[activeRegion.id]?.days || []).map((entry, index) => ({
    day: index + 1,
    date: forecastDates[index] ? formatDate(forecastDates[index]) : `Day ${index + 1}`,
    riskIndex: Number((entry?.riskAvg ?? 0).toFixed(4)),
    classification: classifyRisk(entry?.riskAvg ?? 0),
  }));
  const signals = {
    thermal: Number((dayEntry.signals?.thermal || 0).toFixed(4)),
    vegetation: Number((dayEntry.signals?.vegetation || 0).toFixed(4)),
    wind: Number((dayEntry.signals?.wind || 0).toFixed(4)),
    human: Number((dayEntry.signals?.human || 0).toFixed(4)),
  };
  const tileRiskData = buildTileRiskData(activeRegion, activeDay, dayEntry);

  return {
    region: activeRegion.name,
    regionId: activeRegion.id,
    day: activeDay + 1,
    timestamp: new Date().toISOString(),
    riskIndex: Number((dayEntry.riskAvg || 0).toFixed(4)),
    classification: classifyRisk(dayEntry.riskAvg || 0),
    signals,
    factors: signals,
    spreadProbability: Number(
      (
        (dayEntry.signals?.thermal || 0) * 0.35 +
        (dayEntry.signals?.vegetation || 0) * 0.25 +
        (dayEntry.signals?.wind || 0) * 0.25 +
        (dayEntry.signals?.human || 0) * 0.15
      ).toFixed(4)
    ),
    windDirection: windProfile.windDirection,
    windSpeed: windProfile.windSpeed,
    forecast,
    forecast7DaySummary: forecast.slice(0, 7),
    riskTiles: tileRiskData,
    tiles: tileRiskData,
  };
}

function syncCurrentRiskData() {
  window.riskData = getCurrentRiskData();
}

function emitRiskDataUpdate() {
  document.dispatchEvent(
    new CustomEvent("pyroscan:risk-updated", {
      detail: { riskData: window.riskData },
    })
  );
}

function heatColor(value) {
  const normalized = clamp(Number(value) || 0, 0, 1);
  if (normalized <= 0.25) return "#3ddc84";
  if (normalized <= 0.45) return "#9be45b";
  if (normalized <= 0.6) return "#ffc857";
  if (normalized <= 0.8) return "#ff7f50";
  return "#9c1127";
}

function updateHeatLayer() {
  const day = regionData[activeRegion.id].days[activeDay];
  heatLayer.setLatLngs(day.points);
}

function updateZoneLayer() {
  zoneLayer.clearLayers();
  const day = regionData[activeRegion.id].days[activeDay];

  day.tiles.forEach((tile) => {
    const color = heatColor(tile.value);
    L.rectangle(tile.bounds, {
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.28,
      opacity: 0.4,
    }).addTo(zoneLayer);
  });
}

function updateSignals() {
  const day = regionData[activeRegion.id].days[activeDay];
  ui.signalThermal.textContent = `${Math.round(day.signals.thermal * 100)}%`;
  ui.signalVeg.textContent = `${Math.round(day.signals.vegetation * 100)}%`;
  ui.signalWind.textContent = `${Math.round(day.signals.wind * 100)}%`;
  ui.signalHuman.textContent = `${Math.round(day.signals.human * 100)}%`;
}

function updateRegionInfo() {
  const day = regionData[activeRegion.id].days[activeDay];
  const peakDay = regionData[activeRegion.id].peakDay;
  ui.regionName.textContent = activeRegion.name;
  ui.regionRisk.textContent = day.riskAvg.toFixed(2);
  ui.regionTiles.textContent = String(day.highCount);
  ui.regionPeak.textContent = `Day ${peakDay + 1} · ${formatDate(forecastDates[peakDay])}`;
}

function updateDayLabel() {
  ui.dayLabel.textContent = `Day ${activeDay + 1} · ${formatDate(forecastDates[activeDay])}`;
}

function updateChips() {
  const chips = ui.dayChips.querySelectorAll(".chip");
  chips.forEach((chip, index) => {
    chip.classList.toggle("active", index === activeDay);
  });
}

function updateUI() {
  updateHeatLayer();
  updateZoneLayer();
  updateSignals();
  updateRegionInfo();
  updateDayLabel();
  updateChips();
  syncCurrentRiskData();
  emitRiskDataUpdate();
}

function setDay(index) {
  activeDay = clamp(index, 0, 9);
  ui.daySlider.value = activeDay;
  updateUI();
}

function setRegion(region) {
  activeRegion = region;
  if (region.bounds) {
    map.fitBounds(region.bounds, { padding: [80, 80] });
  } else if (region.center) {
    map.setView(region.center, region.zoom || 3);
  }
  renderRegionGroups();
  updateUI();
}

function renderDayChips() {
  ui.dayChips.innerHTML = "";
  forecastDates.forEach((date, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = `Day ${index + 1} · ${formatDate(date)}`;
    chip.addEventListener("click", () => setDay(index));
    ui.dayChips.appendChild(chip);
  });
}

function renderRegionGroups() {
  ui.regionGroups.innerHTML = "";
  const groups = regions.reduce((acc, region) => {
    acc[region.group] = acc[region.group] || [];
    acc[region.group].push(region);
    return acc;
  }, {});

  Object.entries(groups).forEach(([groupName, list]) => {
    const wrapper = document.createElement("div");
    const title = document.createElement("div");
    title.className = "region-group-title";
    title.textContent = groupName;
    wrapper.appendChild(title);

    const listEl = document.createElement("div");
    listEl.className = "region-list";

    list.forEach((region) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "region-btn";
      button.textContent = region.name;
      if (region.id === activeRegion.id) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => setRegion(region));
      listEl.appendChild(button);
    });

    wrapper.appendChild(listEl);
    ui.regionGroups.appendChild(wrapper);
  });

  if (searchRegion) {
    const wrapper = document.createElement("div");
    const title = document.createElement("div");
    title.className = "region-group-title";
    title.textContent = "Search Result";
    wrapper.appendChild(title);

    const listEl = document.createElement("div");
    listEl.className = "region-list";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-btn";
    button.textContent = searchRegion.name;
    if (searchRegion.id === activeRegion.id) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => setRegion(searchRegion));
    listEl.appendChild(button);

    wrapper.appendChild(listEl);
    ui.regionGroups.appendChild(wrapper);
  }
}

function toggleAutoplay() {
  if (autoplayId) {
    clearInterval(autoplayId);
    autoplayId = null;
    ui.autoPlayBtn.textContent = "Auto-play";
    ui.autoPlayBtn.classList.remove("active");
    return;
  }
  ui.autoPlayBtn.textContent = "Pause";
  ui.autoPlayBtn.classList.add("active");
  autoplayId = setInterval(() => {
    const next = (activeDay + 1) % 10;
    setDay(next);
  }, 1500);
}

function toResultItem(item, onClick) {
  const div = document.createElement("div");
  div.className = "result-item";
  div.textContent = item.name;
  div.addEventListener("click", () => onClick(item));
  return div;
}

function showResults(results, statusMessage) {
  ui.searchResults.innerHTML = "";
  if (statusMessage) {
    ui.searchStatus.textContent = statusMessage;
  }
  if (!results.length) {
    ui.searchStatus.textContent = "No matches found. Try a different query.";
    return;
  }
  results.forEach((result) => {
    ui.searchResults.appendChild(
      toResultItem(result, (item) => {
        applySearchRegion(item);
        ui.searchStatus.textContent = `Focused on ${activeRegion.name} with local heatmap.`;
      })
    );
  });
}

async function runSearch(query) {
  if (!query || query.length < 3) {
    showResults([], "Type at least 3 characters to search.");
    return;
  }

  ui.searchStatus.textContent = "Searching live map data...";
  ui.searchResults.innerHTML = "";

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!response.ok) throw new Error("Search error");
    const data = await response.json();
    const results = data.map((item) => ({
      name: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      bounds: item.boundingbox
        ? [
            [Number(item.boundingbox[0]), Number(item.boundingbox[2])],
            [Number(item.boundingbox[1]), Number(item.boundingbox[3])],
          ]
        : null,
    }));

    if (!results.length) {
      throw new Error("No results");
    }

    showResults(results, `Showing ${results.length} result(s).`);
    applySearchRegion(results[0]);
    ui.searchStatus.textContent = `Showing ${results.length} result(s). Focused on ${activeRegion.name}.`;
  } catch (error) {
    const fallback = fallbackPlaces.filter((place) =>
      place.name.toLowerCase().includes(query.toLowerCase())
    );
    const fallbackResults = fallback.length ? fallback : fallbackPlaces.slice(0, 5);
    showResults(
      fallbackResults,
      "Live search unavailable. Showing curated places instead."
    );
    if (fallbackResults.length) {
      applySearchRegion(fallbackResults[0]);
      ui.searchStatus.textContent = `Live search unavailable. Focused on ${activeRegion.name}.`;
    }
  }
}

async function downloadHeatmap() {
  ui.downloadStatus.textContent = "Preparing export...";
  try {
    const canvas = await html2canvas(document.getElementById("map"), {
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `pyroscan-${activeRegion.id}-day-${activeDay + 1}.png`;
    link.click();
    ui.downloadStatus.textContent = "Download started.";
  } catch (error) {
    ui.downloadStatus.textContent =
      "Download failed (map tiles blocked). Try again or use a different zoom.";
  }
}

ui.daySlider.addEventListener("input", (event) => {
  setDay(Number(event.target.value));
});

ui.heatToggle.addEventListener("change", (event) => {
  if (event.target.checked) {
    heatLayer.addTo(map);
  } else {
    map.removeLayer(heatLayer);
  }
});

ui.zoneToggle.addEventListener("change", (event) => {
  if (event.target.checked) {
    zoneLayer.addTo(map);
  } else {
    map.removeLayer(zoneLayer);
  }
});

ui.searchBtn.addEventListener("click", () => runSearch(ui.searchInput.value.trim()));
ui.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch(ui.searchInput.value.trim());
  }
});

ui.autoPlayBtn.addEventListener("click", toggleAutoplay);
ui.downloadBtn.addEventListener("click", downloadHeatmap);

renderDayChips();
renderRegionGroups();
updateUI();

map.on("click", () => {
  if (autoplayId) {
    toggleAutoplay();
  }
});

window.PyroScan = {
  getCurrentRiskData,
  getRiskData: getCurrentRiskData,
  getMapElement: () => document.getElementById("map"),
  getCurrentRegionName: () => activeRegion?.name || "Unknown Region",
  getActiveDay: () => activeDay + 1,
};

const PANEL_INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role='button'], [data-no-drag]";

function panelToNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initSlidePanel(shell) {
  const side = shell.dataset.side === "right" ? "right" : "left";
  const panel = shell.querySelector(".panel");
  const handle = shell.querySelector("[data-panel-handle]");
  const toggles = shell.querySelectorAll("[data-panel-toggle]");

  if (!panel || !handle || toggles.length === 0) {
    return;
  }

  const state = {
    collapsed: shell.classList.contains("is-collapsed"),
    dragging: false,
    startX: 0,
    startOffset: 0,
    currentOffset: 0,
    maxShift: 0,
  };

  function getMaxShift() {
    const rootStyles = getComputedStyle(document.documentElement);
    const peek = panelToNumber(rootStyles.getPropertyValue("--panel-peek"), 56);
    const width = panel.getBoundingClientRect().width;
    return Math.max(width - peek, 0);
  }

  function getCollapsedOffset() {
    return side === "left" ? -state.maxShift : state.maxShift;
  }

  function updateToggleUI() {
    toggles.forEach((button) => {
      button.textContent = state.collapsed ? "Show" : "Hide";
      button.setAttribute("aria-expanded", String(!state.collapsed));
    });
  }

  function applyOffset(offset) {
    state.currentOffset = offset;
    panel.style.transform = `translateX(${offset}px)`;
  }

  function setCollapsed(nextCollapsed) {
    state.maxShift = getMaxShift();
    state.collapsed = nextCollapsed;
    shell.classList.toggle("is-collapsed", nextCollapsed);
    panel.style.removeProperty("transform");
    updateToggleUI();
  }

  function finishDrag() {
    if (!state.dragging) return;

    state.dragging = false;
    shell.classList.remove("is-dragging");
    document.body.classList.remove("is-dragging-panel");
    panel.style.removeProperty("transform");

    const threshold = state.maxShift * 0.45;
    const shouldCollapse =
      side === "left"
        ? state.currentOffset < -threshold
        : state.currentOffset > threshold;

    setCollapsed(shouldCollapse);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(event) {
    if (!state.dragging) return;
    event.preventDefault();

    const delta = event.clientX - state.startX;
    let nextOffset = state.startOffset + delta;

    if (side === "left") {
      nextOffset = Math.max(-state.maxShift, Math.min(0, nextOffset));
    } else {
      nextOffset = Math.min(state.maxShift, Math.max(0, nextOffset));
    }

    applyOffset(nextOffset);
  }

  function onPointerUp() {
    finishDrag();
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (event.target.closest(PANEL_INTERACTIVE_SELECTOR)) return;

    event.preventDefault();
    state.maxShift = getMaxShift();
    state.dragging = true;
    state.startX = event.clientX;
    state.startOffset = state.collapsed ? getCollapsedOffset() : 0;

    shell.classList.add("is-dragging");
    document.body.classList.add("is-dragging-panel");
    applyOffset(state.startOffset);

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function togglePanel() {
    setCollapsed(!state.collapsed);
  }

  toggles.forEach((button) => {
    button.addEventListener("click", togglePanel);
  });

  handle.addEventListener("pointerdown", onPointerDown);

  window.addEventListener("resize", () => {
    state.maxShift = getMaxShift();
    if (state.dragging) return;
    if (state.collapsed) {
      shell.classList.add("is-collapsed");
    }
  });

  updateToggleUI();
}

function initSlidePanels() {
  document.querySelectorAll("[data-panel]").forEach(initSlidePanel);
}

initSlidePanels();
