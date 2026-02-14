#!/usr/bin/env python3
"""PyroScan deterministic fake prediction backend.

This server provides tile/day confidence values for the existing frontend.
It is intentionally model-lite: pickled ModelWrapper objects stand in for real
ML models while preserving deterministic behavior for demos.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import pickle
import re
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from flask import Flask, jsonify, request
except Exception:  # pragma: no cover - handled at runtime
    Flask = None  # type: ignore[assignment]
    jsonify = None  # type: ignore[assignment]
    request = None  # type: ignore[assignment]

try:
    import numpy as np  # Optional, not required for MVP behavior.
except Exception:  # pragma: no cover - optional dependency
    np = None  # type: ignore[assignment]

# Ensure pickles always resolve ModelWrapper as predict_server.ModelWrapper.
sys.modules.setdefault("predict_server", sys.modules[__name__])

DAY_MIN = 0
DAY_MAX = 9
DEFAULT_MODEL_NAME = "fire_risk_model"
TILE_PATTERN = re.compile(r"^(?P<z>\d+)\/(?P<x>\d+)\/(?P<y>\d+)$")

# Explicit threshold mapping expected by the frontend.
RISK_THRESHOLDS = (
    ("safe", 0.00, 0.20),      # [0.00, 0.20)
    ("guarded", 0.20, 0.40),   # [0.20, 0.40)
    ("elevated", 0.40, 0.60),  # [0.40, 0.60)
    ("high", 0.60, 0.80),      # [0.60, 0.80)
    ("extreme", 0.80, 1.01),   # [0.80, 1.00]
)


def clamp_day(value: int) -> int:
    """Clamp day index to [0, 9]."""
    return max(DAY_MIN, min(DAY_MAX, int(value)))


def parse_day(value: Any) -> int:
    """Parse day from request payload and clamp to valid range."""
    if value is None or value == "":
        return DAY_MIN
    try:
        day = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("day must be an integer between 0 and 9") from exc
    return clamp_day(day)


def parse_tile_id(tile_id: str) -> Tuple[int, int, int]:
    """Validate and parse tile id in z/x/y format."""
    if not isinstance(tile_id, str):
        raise ValueError("tile must be a string in 'z/x/y' format")

    tile = tile_id.strip()
    match = TILE_PATTERN.match(tile)
    if not match:
        raise ValueError("tile must match format 'z/x/y' with integer components")

    z = int(match.group("z"))
    x = int(match.group("x"))
    y = int(match.group("y"))

    if z < 0:
        raise ValueError("z must be >= 0")
    max_index = (1 << z) - 1
    if x < 0 or y < 0:
        raise ValueError("x and y must be >= 0")
    if x > max_index or y > max_index:
        raise ValueError(f"x and y must be <= {max_index} for z={z}")

    return z, x, y


def category_from_confidence(confidence: Optional[float]) -> str:
    """Map confidence to frontend category labels."""
    if confidence is None:
        return "safe"

    c = max(0.0, min(1.0, float(confidence)))
    for label, lower, upper in RISK_THRESHOLDS:
        if lower <= c < upper:
            return label
    return "extreme"


def _hash_unit(*parts: Any) -> float:
    """Stable hash -> float in [0, 1)."""
    text = "|".join(str(part) for part in parts)
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    value = int.from_bytes(digest[:8], byteorder="big", signed=False)
    return value / float(2**64 - 1)


@dataclass
class ModelWrapper:
    """Deterministic fake model with a predict_proba interface.

    The output blends:
    - coarse spatial signal (neighbor correlation)
    - fine spatial signal (tile uniqueness)
    - temporal wave (day progression)
    - small deterministic noise (model/day specific)
    """

    model_name: str
    baseline: float
    amplitude: float
    temporal_shift: float
    local_variance: float
    hotspot_strength: float

    def _tile_signal(self, tile_id: str, day: int) -> float:
        z, x, y = parse_tile_id(tile_id)
        day = clamp_day(day)

        denom = float(1 << z)
        nx = x / denom
        ny = y / denom

        # Coarse block hash drives local neighborhood coherence.
        coarse = _hash_unit(self.model_name, "coarse", z, x // 3, y // 3, day // 2)
        # Fine tile hash gives per-tile distinction.
        fine = _hash_unit(self.model_name, "fine", z, x, y)

        # Simple smooth wave for day-to-day movement of risk.
        temporal_wave = (math.sin((day + self.temporal_shift) * 0.67 + nx * 5.8 + ny * 4.1) + 1.0) * 0.5

        # Equatorial bias: many wildfire regions cluster in warmer belts.
        equatorial_bias = 1.0 - abs((ny * 2.0) - 1.0)

        # Moving hotspot center creates realistic drifting "peak zones".
        hotspot_x = (_hash_unit(self.model_name, "hotspot-x") + 0.08 * day) % 1.0
        hotspot_y = (_hash_unit(self.model_name, "hotspot-y") + 0.05 * day) % 1.0
        distance = math.hypot(nx - hotspot_x, ny - hotspot_y)
        hotspot = max(0.0, 1.0 - distance * 2.2)

        # Deterministic but day-varying micro-noise.
        daily_noise = (_hash_unit(self.model_name, "noise", z, x, y, day) - 0.5) * self.local_variance

        raw = (
            self.baseline
            + self.amplitude
            * (
                0.33 * coarse
                + 0.17 * fine
                + 0.24 * temporal_wave
                + 0.16 * equatorial_bias
                + self.hotspot_strength * hotspot
            )
            + daily_noise
        )
        return max(0.0, min(1.0, raw))

    def predict_proba(self, tile_ids: Sequence[str], day: int) -> List[float]:
        """Return confidence list in [0.0, 1.0]."""
        d = clamp_day(day)

        # Optional vectorized path when numpy is available.
        if np is not None and isinstance(tile_ids, np.ndarray):  # pragma: no cover
            tile_iter: Iterable[str] = tile_ids.tolist()
        else:
            tile_iter = tile_ids

        return [self._tile_signal(tile_id, d) for tile_id in tile_iter]

    def predict(self, tile_id: str, day: int) -> float:
        """Single-tile prediction helper."""
        return self.predict_proba([tile_id], day)[0]


# Force stable module path inside pickles.
ModelWrapper.__module__ = "predict_server"


@dataclass
class SklearnModelAdapter:
    """Adapter for sklearn-like estimators persisted in .pkl files."""

    model_name: str
    estimator: Any
    feature_names: Sequence[str]

    def _feature_value(self, feature_name: str, tile: Dict[str, Any], day: int) -> float:
        name = feature_name.lower()

        # 1) Use real feature directly if caller provided it
        if name in tile and tile[name] is not None:
            try:
                return float(tile[name])
            except (TypeError, ValueError):
                pass

        # 2) Backward-compatible fallback (existing synthetic behavior)
        lat = float(tile.get("lat", 0.0) or 0.0)
        lng = float(tile.get("lng", 0.0) or 0.0)
        tile_id = str(tile.get("id", ""))

        base = _hash_unit(self.model_name, name, tile_id, day, round(lat, 3), round(lng, 3))

        if name == "slope":
            return abs(math.sin(math.radians(lat * 2.3)) * 35.0) + base * 8.0
        if name == "aspect":
            return ((math.degrees(math.atan2(lat + 1e-6, lng + 1e-6)) + 360.0) % 360.0)
        if name == "roads":
            return max(0.0, min(100.0, (1.0 - base) * 55.0 + abs(lat) * 0.3))
        if name == "landcover":
            return float(int(base * 9.999))
        if name == "ndvi":
            return max(0.0, min(1.0, 0.2 + 0.65 * (math.cos(math.radians(lat)) ** 2) - base * 0.12))
        if name == "ndmi":
            return max(-1.0, min(1.0, -0.2 + 0.75 * math.sin(math.radians(lng * 0.7)) + (base - 0.5) * 0.2))
        if name == "lst":
            seasonal = math.sin((day + 1) * 0.62 + lat * 0.04)
            return max(0.0, min(70.0, 18.0 + abs(lat) * 0.25 + 18.0 * seasonal + base * 6.0))
        if name == "weather":
            return max(0.0, min(1.0, 0.25 + 0.55 * math.sin(day * 0.7 + lng * 0.03) + (base - 0.5) * 0.2))

        return base


    def predict_tile_records(self, tiles: Sequence[Dict[str, Any]], day: int) -> List[float]:
        rows: List[List[float]] = []
        for tile in tiles:
            rows.append([self._feature_value(name, tile, day) for name in self.feature_names])

        if np is not None:
            matrix: Any = np.asarray(rows, dtype=float)
        else:
            matrix = rows

        if hasattr(self.estimator, "predict_proba"):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                proba = self.estimator.predict_proba(matrix)
            if np is not None:
                return [float(v) for v in proba[:, -1].tolist()]
            return [float(row[-1]) for row in proba]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            preds = self.estimator.predict(matrix)
        if np is not None and hasattr(preds, "tolist"):
            preds = preds.tolist()
        return [max(0.0, min(1.0, float(v))) for v in preds]


def _coerce_loaded_model(name: str, obj: Any) -> Any:
    """Normalize loaded pickle object into an inference-capable model."""
    if hasattr(obj, "predict_proba") and hasattr(obj, "predict"):
        if hasattr(obj, "feature_names_in_"):
            features = [str(v) for v in getattr(obj, "feature_names_in_", [])]
            if features:
                return SklearnModelAdapter(name, obj, features)
        return obj

    if isinstance(obj, dict):
        estimator = obj.get("model")
        features = obj.get("features")
        if estimator is not None and hasattr(estimator, "predict"):
            feature_names = [str(v) for v in (features or getattr(estimator, "feature_names_in_", []) or [])]
            if not feature_names:
                feature_count = int(getattr(estimator, "n_features_in_", 0) or 0)
                feature_names = [f"feature_{i}" for i in range(feature_count)]
            return SklearnModelAdapter(name, estimator, feature_names)
    return None


def generate_fake_models(models_dir: Path | str = "models") -> Dict[str, Path]:
    """Write deterministic fake model pickles for demo usage."""
    out_dir = Path(models_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    models = {
        "global_model": ModelWrapper(
            model_name="global_model",
            baseline=0.10,
            amplitude=0.62,
            temporal_shift=0.8,
            local_variance=0.08,
            hotspot_strength=0.20,
        ),
        "continent_model": ModelWrapper(
            model_name="continent_model",
            baseline=0.16,
            amplitude=0.66,
            temporal_shift=1.9,
            local_variance=0.11,
            hotspot_strength=0.24,
        ),
        "local_model": ModelWrapper(
            model_name="local_model",
            baseline=0.21,
            amplitude=0.70,
            temporal_shift=3.1,
            local_variance=0.14,
            hotspot_strength=0.28,
        ),
    }

    paths: Dict[str, Path] = {}
    for name, model in models.items():
        path = out_dir / f"{name}.pkl"
        with path.open("wb") as fp:
            pickle.dump(model, fp, protocol=pickle.HIGHEST_PROTOCOL)
        paths[name] = path
    return paths


def load_models(models_dir: Path | str = "models") -> Dict[str, ModelWrapper]:
    """Load all .pkl models from disk."""
    directory = Path(models_dir)
    if not directory.exists() or not directory.is_dir():
        return {}

    loaded: Dict[str, ModelWrapper] = {}
    for path in sorted(directory.glob("*.pkl")):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                with path.open("rb") as fp:
                    obj = pickle.load(fp)

            normalized = _coerce_loaded_model(path.stem, obj)
            if normalized is not None:
                loaded[path.stem] = normalized
        except Exception:
            continue
    return loaded


def _error_response(message: str, status_code: int = 400):
    payload = {"error": message}
    return jsonify(payload), status_code


def create_app(models_dir: Path | str = "models"):
    """Create Flask app with prediction endpoints."""
    if Flask is None:
        raise RuntimeError("Flask is required to run the API. Install with: pip install flask")

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    state = {
        "models_dir": Path(models_dir),
        "models": load_models(models_dir),
    }

    def resolve_model(requested: Optional[str]) -> Tuple[str, Optional[ModelWrapper]]:
        raw = (requested or DEFAULT_MODEL_NAME).strip()
        name = raw[:-4] if raw.endswith(".pkl") else raw
        return name, state["models"].get(name)

    def prediction_payload(tile_id: str, day: int, requested_model: str) -> Dict[str, Any]:
        model_name, model = resolve_model(requested_model)
        if model is None:
            return {
                "tile": tile_id,
                "day": day,
                "model": None,
                "requested_model": model_name,
                "confidence": None,
                "category": "safe",
            }
        if isinstance(model, SklearnModelAdapter):
            confidence = model.predict_tile_records([{"id": tile_id}], day)[0]
        else:
            confidence = model.predict(tile_id, day)
        return {
            "tile": tile_id,
            "day": day,
            "model": model_name,
            "confidence": round(float(confidence), 6),
            "category": category_from_confidence(confidence),
        }

    @app.after_request
    def add_cors_headers(response):  # type: ignore[override]
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return response

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify(
            {
                "status": "ok",
                "models_loaded": len(state["models"]),
                "models": sorted(state["models"].keys()),
                "models_dir": str(state["models_dir"]),
            }
        )

    @app.route("/models", methods=["GET"])
    def list_models():
        return jsonify({"models": sorted(state["models"].keys())})

    @app.route("/predict", methods=["GET", "OPTIONS"])
    def predict():
        if request.method == "OPTIONS":
            return "", 204

        tile_id = request.args.get("tile", type=str)
        if not tile_id:
            return _error_response("tile query param is required (format: z/x/y)")
        try:
            parse_tile_id(tile_id)
        except ValueError as exc:
            return _error_response(str(exc))

        try:
            day = parse_day(request.args.get("day", DAY_MIN))
        except ValueError as exc:
            return _error_response(str(exc))

        requested_model = request.args.get("model", DEFAULT_MODEL_NAME)
        return jsonify(prediction_payload(tile_id, day, requested_model))

    @app.route("/predict_batch", methods=["POST", "OPTIONS"])
    def predict_batch():
        if request.method == "OPTIONS":
            return "", 204

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return _error_response("JSON body is required")

        raw_tiles = payload.get("tiles")
        if not isinstance(raw_tiles, list) or not raw_tiles:
            return _error_response("tiles must be a non-empty array")

        tiles: List[Dict[str, Any]] = []
        for idx, item in enumerate(raw_tiles):
            if isinstance(item, str):
                tiles.append({"id": item})
                continue

            if isinstance(item, dict):
                tile_id = str(item.get("id") or f"tile-{idx}")
                tile: Dict[str, Any] = {
                    "id": tile_id,
                    "lat": float(item.get("lat", 0.0) or 0.0),
                    "lng": float(item.get("lng", 0.0) or 0.0),
                    "bbox": item.get("bbox"),
                }

                # Preserve any real model features sent by client
                for key in ("slope", "aspect", "roads", "landcover", "ndvi", "ndmi", "lst", "weather"):
                    if key in item:
                        tile[key] = item.get(key)

                tiles.append(tile)
                continue

            return _error_response("tiles entries must be strings or objects")


        try:
            day = parse_day(payload.get("day", DAY_MIN))
        except ValueError as exc:
            return _error_response(str(exc))

        requested_model = payload.get("model", DEFAULT_MODEL_NAME)
        model_name, model = resolve_model(str(requested_model))

        if model is None:
            results = [
                {
                    "tile": tile["id"],
                    "day": day,
                    "model": None,
                    "requested_model": model_name,
                    "confidence": None,
                    "category": "safe",
                }
                for tile in tiles
            ]
            return jsonify(
                {
                    "day": day,
                    "model": None,
                    "requested_model": model_name,
                    "count": len(results),
                    "results": results,
                }
            )

        if isinstance(model, SklearnModelAdapter):
            confidences = model.predict_tile_records(tiles, day)
        else:
            tile_ids = [str(tile.get("id", "")) for tile in tiles]
            confidences = model.predict_proba(tile_ids, day)
        results = []
        for tile, confidence in zip(tiles, confidences):
            results.append(
                {
                    "tile": tile["id"],
                    "day": day,
                    "model": model_name,
                    "confidence": round(float(confidence), 6),
                    "category": category_from_confidence(confidence),
                }
            )
        return jsonify(
            {
                "day": day,
                "model": model_name,
                "count": len(results),
                "results": results,
            }
        )

    @app.route("/", methods=["GET"])
    def index():
        return jsonify(
            {
                "service": "PyroScan Prediction API",
                "endpoints": ["/health", "/models", "/predict", "/predict_batch"],
                "thresholds": list(RISK_THRESHOLDS),
            }
        )

    return app


def cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PyroScan fake prediction backend")
    parser.add_argument("--gen-models", action="store_true", help="Generate fake deterministic .pkl model files")
    parser.add_argument("--run", action="store_true", help="Run the HTTP server")
    parser.add_argument("--models-dir", default="models", help="Directory containing model .pkl files")
    parser.add_argument("--host", default="127.0.0.1", help="Host bind address")
    parser.add_argument("--port", default=8000, type=int, help="Port number")
    return parser.parse_args()


def main() -> None:
    args = cli()
    did_action = False

    if args.gen_models:
        generated = generate_fake_models(args.models_dir)
        print("Generated fake models:")
        for name, path in generated.items():
            print(f"  - {name}: {path}")
        did_action = True

    if args.run or not did_action:
        app = create_app(args.models_dir)
        loaded = load_models(args.models_dir)
        print(f"Starting server on http://{args.host}:{args.port}")
        print(f"Loaded models ({len(loaded)}): {', '.join(sorted(loaded)) or '(none)'}")
        app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
