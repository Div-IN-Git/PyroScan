(function () {
  const config = {
    failRate: 0.15,
    minLatencyMs: 120,
    maxLatencyMs: 360,
  };

  let customPredictor = null;
  const DEFAULT_BACKEND_PATH = "/api/predict_batch";

  function resolveDefaultBackendUrl() {
    const host = window.location?.hostname || "";
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000/predict_batch";
    }
    return `${window.location.origin}${DEFAULT_BACKEND_PATH}`;
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {
      // no-op when storage is unavailable
    }
  }

  function normalizeBackendUrl(value) {
    const text = String(value || "").trim();
    if (!text) return resolveDefaultBackendUrl();
    if (text.includes("YOUR_BACKEND_DOMAIN")) {
      throw new Error("Replace YOUR_BACKEND_DOMAIN with a real backend URL.");
    }
    return text;
  }

  const persistedBackendUrl = readStorage("pyroscan.backendUrl");
  let backendUrl = normalizeBackendUrl(window.__PYROSCAN_BACKEND_URL || persistedBackendUrl || resolveDefaultBackendUrl());
  let backendModel = String(window.__PYROSCAN_BACKEND_MODEL || readStorage("pyroscan.backendModel") || "fire_risk_model").trim() || "fire_risk_model";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function hashUnit(text) {
    let hash = 2166136261;
    const source = String(text);
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000000) / 1000000;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function parseDay(day) {
    const parsed = Number(day);
    if (!Number.isFinite(parsed)) return 0;
    return clamp(Math.round(parsed), 0, 9);
  }

  function normalizeTiles(tiles) {
    if (!Array.isArray(tiles)) return [];
    return tiles
      .filter((tile) => tile && tile.id != null)
      .map((tile) => ({
        id: String(tile.id),
        lat: Number(tile.lat ?? tile.latitude ?? 0),
        lng: Number(tile.lng ?? tile.longitude ?? 0),
      }));
  }

  async function fakePredictTiles(region, day, tiles) {
    const dayIndex = parseDay(day);
    const modelKey = String(region?.id || "region");
    const baseRisk = clamp(Number(region?.baseRisk ?? 0.45), 0, 1);
    const normalizedTiles = normalizeTiles(tiles);

    const latencySpan = Math.max(config.maxLatencyMs - config.minLatencyMs, 0);
    const latency = config.minLatencyMs + Math.round(Math.random() * latencySpan);
    await sleep(latency);

    if (Math.random() < clamp(config.failRate, 0, 1)) {
      throw new Error("Fake ML model failed intentionally.");
    }

    const values = new Map();
    normalizedTiles.forEach((tile) => {
      const spatial = hashUnit(`${modelKey}|spatial|${tile.id}|${Math.round(tile.lat * 4)}|${Math.round(tile.lng * 4)}`);
      const local = hashUnit(`${modelKey}|local|${tile.id}`);
      const temporal = (Math.sin((dayIndex + 1) * 0.72 + tile.lat * 0.05 + tile.lng * 0.03) + 1) * 0.5;
      const seasonal = (Math.cos((dayIndex + 2) * 0.43 + tile.lat * 0.04) + 1) * 0.5;
      const perturbation = (hashUnit(`${modelKey}|noise|${tile.id}|${dayIndex}`) - 0.5) * 0.08;

      const confidence = clamp(
        baseRisk * 0.44 + spatial * 0.23 + temporal * 0.16 + seasonal * 0.10 + local * 0.14 + perturbation,
        0,
        1
      );
      values.set(tile.id, Number(confidence.toFixed(4)));
    });

    return values;
  }

  async function predictTiles(region, day, tiles) {
    const predictor = typeof customPredictor === "function" ? customPredictor : backendPredictTiles;
    return predictor(region, day, tiles);
  }

  async function backendPredictTiles(region, day, tiles) {
    const normalizedTiles = normalizeTiles(tiles).map((tile) => ({
      id: tile.id,
      lat: tile.lat,
      lng: tile.lng,
    }));

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day: parseDay(day),
        model: backendModel,
        region: String(region?.id || "region"),
        tiles: normalizedTiles,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend predictor failed (${response.status})`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    if (!results.length) {
      throw new Error("Backend predictor returned no results.");
    }

    const values = new Map();
    results.forEach((row) => {
      const id = String(row?.tile ?? "");
      const confidence = Number(row?.confidence);
      if (id && Number.isFinite(confidence)) {
        values.set(id, clamp(confidence, 0, 1));
      }
    });

    if (values.size !== normalizedTiles.length) {
      throw new Error("Backend predictor payload missing tile confidences.");
    }
    return values;
  }

  function setPredictor(predictor) {
    customPredictor = typeof predictor === "function" ? predictor : null;
  }

  function resetPredictor() {
    customPredictor = null;
  }

  function configure(options) {
    if (!options || typeof options !== "object") return getConfig();
    if (options.failRate != null) {
      config.failRate = clamp(Number(options.failRate), 0, 1);
    }
    if (options.minLatencyMs != null) {
      config.minLatencyMs = Math.max(0, Number(options.minLatencyMs) || 0);
    }
    if (options.maxLatencyMs != null) {
      config.maxLatencyMs = Math.max(config.minLatencyMs, Number(options.maxLatencyMs) || config.minLatencyMs);
    }
    if (typeof options.backendUrl === "string" && options.backendUrl.trim()) {
      backendUrl = normalizeBackendUrl(options.backendUrl);
      writeStorage("pyroscan.backendUrl", backendUrl);
    }
    if (typeof options.backendModel === "string" && options.backendModel.trim()) {
      backendModel = options.backendModel.trim();
      writeStorage("pyroscan.backendModel", backendModel);
    }
    return getConfig();
  }

  function getConfig() {
    return {
      failRate: config.failRate,
      minLatencyMs: config.minLatencyMs,
      maxLatencyMs: config.maxLatencyMs,
      backendUrl,
      backendModel,
      usingCustomPredictor: typeof customPredictor === "function",
    };
  }

  window.predictTiles = predictTiles;
  window.PyroScanML = {
    predictTiles,
    setPredictor,
    resetPredictor,
    configure,
    getConfig,
  };
})();
