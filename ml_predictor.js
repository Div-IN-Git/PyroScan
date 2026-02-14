(function () {
  const config = {
    failRate: 0.15,
    minLatencyMs: 120,
    maxLatencyMs: 360,
  };

  let customPredictor = null;

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
    const predictor = typeof customPredictor === "function" ? customPredictor : fakePredictTiles;
    return predictor(region, day, tiles);
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
    return getConfig();
  }

  function getConfig() {
    return {
      failRate: config.failRate,
      minLatencyMs: config.minLatencyMs,
      maxLatencyMs: config.maxLatencyMs,
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
