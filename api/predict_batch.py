"""Vercel serverless endpoint for batch fire-risk predictions."""

from __future__ import annotations

import json
import os
import pickle
from typing import Any, Dict, List, Tuple

# ============================================================================
# Model Loading & Utilities (inlined from predict_server.py)
# ============================================================================

DEFAULT_MODEL_NAME = "fire_risk_model"

def clamp_day(day: int) -> int:
    """Clamp day to valid range 0-9."""
    return max(0, min(9, int(day)))

def category_from_confidence(confidence: float) -> str:
    """Convert confidence score to risk category."""
    if confidence < 0.3:
        return "low"
    elif confidence < 0.5:
        return "moderate"
    elif confidence < 0.7:
        return "high"
    else:
        return "extreme"

def load_models(models_dir: str = "models") -> Dict[str, Any]:
    """Load all .pkl model files from the models directory."""
    models = {}
    if not os.path.isdir(models_dir):
        return models
    
    for filename in os.listdir(models_dir):
        if filename.endswith(".pkl"):
            model_name = filename[:-4]  # Remove .pkl extension
            filepath = os.path.join(models_dir, filename)
            try:
                with open(filepath, "rb") as f:
                    models[model_name] = pickle.load(f)
            except Exception as e:
                print(f"Failed to load {filename}: {e}")
    
    return models

# Warm cache across invocations
_MODELS = None

def _get_models():
    global _MODELS
    if _MODELS is None:
        _MODELS = load_models("models")
    return _MODELS

def _resolve_model(requested: str | None) -> Tuple[str, Any]:
    models = _get_models()
    name = str(requested or "").strip() or DEFAULT_MODEL_NAME
    model = models.get(name)
    if model is None:
        fallback = models.get(DEFAULT_MODEL_NAME)
        if fallback is not None:
            return DEFAULT_MODEL_NAME, fallback
        if models:
            first = sorted(models)[0]
            return first, models[first]
    return name, model

def _normalize_tile(tile: Dict[str, Any], index: int) -> Dict[str, Any]:
    tile_id = tile.get("id") or tile.get("tile")
    if tile_id is None or str(tile_id).strip() == "":
        raise ValueError(f"tiles[{index}].id is required")

    normalized = {
        "id": str(tile_id),
        "lat": float(tile.get("lat", tile.get("latitude", 0.0)) or 0.0),
        "lng": float(tile.get("lng", tile.get("longitude", 0.0)) or 0.0),
    }

    for key, value in tile.items():
        if key not in normalized:
            normalized[key] = value
    return normalized

# ============================================================================
# Vercel Handler
# ============================================================================

def handler(request):
    """Vercel serverless function handler."""
    
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": "",
        }

    # Only allow POST
    if request.method != "POST":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "method not allowed"}),
        }

    try:
        # Parse request body
        payload = request.get_json(silent=True) or {}
        day = clamp_day(int(payload.get("day", 0)))

        # Validate tiles
        raw_tiles = payload.get("tiles")
        if not isinstance(raw_tiles, list) or not raw_tiles:
            raise ValueError("tiles must be a non-empty array")
        tiles = [_normalize_tile(tile, idx) for idx, tile in enumerate(raw_tiles)]

        # Load model
        model_name, model = _resolve_model(payload.get("model"))
        if model is None:
            raise ValueError("no models available. Add .pkl files to models/")

        # Run prediction
        if hasattr(model, "predict_tile_records"):
            confidences = model.predict_tile_records(tiles, day)
        elif hasattr(model, "predict_proba"):
            confidences = model.predict_proba([tile["id"] for tile in tiles], day)
        else:
            raise ValueError("model is not inference-capable")

        # Format results
        results = []
        for tile, confidence in zip(tiles, confidences):
            score = max(0.0, min(1.0, float(confidence)))
            results.append(
                {
                    "tile": tile["id"],
                    "confidence": round(score, 4),
                    "category": category_from_confidence(score),
                }
            )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "ok": True,
                    "model": model_name,
                    "day": day,
                    "count": len(results),
                    "results": results,
                }
            ),
        }

    except Exception as exc:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"ok": False, "error": str(exc)}),
        }
