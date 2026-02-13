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

function generateRegionDay(region, dayIndex) {
  const rng = makeRng(region.seed * 1000 + dayIndex * 97);
  const factor = dayFactor(region, dayIndex);
  const points = [];
  const tiles = [];
  const [minLat, minLng] = region.bounds[0];
  const [maxLat, maxLng] = region.bounds[1];
  const rows = region.grid?.rows || 5;
  const cols = region.grid?.cols || 7;

  for (let i = 0; i < region.pointCount; i += 1) {
    const lat = minLat + (maxLat - minLat) * rng();
    const lng = minLng + (maxLng - minLng) * rng();
    let intensity = region.baseRisk * (0.55 + rng() * 0.6);
    intensity += hotspotBoost(lat, lng, region.hotspots);
    intensity *= factor;
    intensity = clamp(intensity, 0, 1);
    points.push([lat, lng, intensity]);
  }

  const latStep = (maxLat - minLat) / rows;
  const lngStep = (maxLng - minLng) / cols;
  let riskSum = 0;
  let highCount = 0;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const tileMinLat = minLat + r * latStep;
      const tileMinLng = minLng + c * lngStep;
      const tileMaxLat = tileMinLat + latStep;
      const tileMaxLng = tileMinLng + lngStep;
      const centerLat = tileMinLat + latStep * 0.5;
      const centerLng = tileMinLng + lngStep * 0.5;

      let value = region.baseRisk * (0.6 + rng() * 0.5);
      value += hotspotBoost(centerLat, centerLng, region.hotspots);
      value *= factor;
      value = clamp(value, 0, 1);
      riskSum += value;
      if (value > 0.75) highCount += 1;

      tiles.push({
        bounds: [
          [tileMinLat, tileMinLng],
          [tileMaxLat, tileMaxLng],
        ],
        value,
      });
    }
  }

  const riskAvg = riskSum / tiles.length;
  const signalRng = makeRng(region.seed * 100 + dayIndex * 113);
  const signals = {
    thermal: clamp(0.45 + riskAvg * 0.55 + signalRng() * 0.2 - 0.08, 0, 1),
    vegetation: clamp(0.35 + riskAvg * 0.6 + signalRng() * 0.18 - 0.05, 0, 1),
    wind: clamp(0.25 + riskAvg * 0.7 + signalRng() * 0.22 - 0.08, 0, 1),
    human: clamp(0.28 + riskAvg * 0.55 + signalRng() * 0.25 - 0.07, 0, 1),
  };

  return { points, tiles, riskAvg, highCount, signals };
}

function buildRegionData() {
  regions.forEach((region) => {
    const days = [];
    for (let i = 0; i < 10; i += 1) {
      days.push(generateRegionDay(region, i));
    }
    let peakDay = 0;
    days.forEach((day, index) => {
      if (day.riskAvg > days[peakDay].riskAvg) {
        peakDay = index;
      }
    });
    regionData[region.id] = { days, peakDay };
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
  leftPanel: document.querySelector(".left-panel"),
  rightPanel: document.querySelector(".right-panel"),
  leftPanelToggle: document.getElementById("leftPanelToggle"),
  rightPanelToggle: document.getElementById("rightPanelToggle"),
};

let activeRegion = regions[0];
let activeDay = 0;
let autoplayId = null;

function heatColor(value) {
  if (value <= 0.25) return "#3ddc84";
  if (value <= 0.45) return "#9be45b";
  if (value <= 0.6) return "#ffc857";
  if (value <= 0.8) return "#ff7f50";
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

function togglePanel(panel, toggleButton) {
  if (!panel || !toggleButton) return;
  const collapsed = panel.classList.toggle("is-collapsed");
  toggleButton.textContent = collapsed ? "❯" : "❮";
  toggleButton.setAttribute("aria-expanded", String(!collapsed));
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
        if (item.bounds) {
          map.fitBounds(item.bounds, { padding: [80, 80] });
        } else {
          map.setView([item.lat, item.lon], item.zoom || 6);
        }
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
  } catch (error) {
    const fallback = fallbackPlaces.filter((place) =>
      place.name.toLowerCase().includes(query.toLowerCase())
    );
    showResults(
      fallback.length ? fallback : fallbackPlaces.slice(0, 5),
      "Live search unavailable. Showing curated places instead."
    );
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
ui.leftPanelToggle.addEventListener("click", () => togglePanel(ui.leftPanel, ui.leftPanelToggle));
ui.rightPanelToggle.addEventListener("click", () => togglePanel(ui.rightPanel, ui.rightPanelToggle));

renderDayChips();
renderRegionGroups();
updateUI();

map.on("click", () => {
  if (autoplayId) {
    toggleAutoplay();
  }
});
