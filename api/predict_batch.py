"""Vercel serverless endpoint for batch fire-risk predictions."""

from __future__ import annotations

from typing import Any, Dict, Tuple

from predict_server import (
    DEFAULT_MODEL_NAME,
    category_from_confidence,
    clamp_day,
    load_models,
)

# Warm cache across invocations.
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


def handler(request):
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

    if request.method != "POST":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json"},
            "body": '{"error":"method not allowed"}',
        }

    try:
        payload = request.get_json(silent=True) or {}
        day = clamp_day(int(payload.get("day", 0)))

        raw_tiles = payload.get("tiles")
        if not isinstance(raw_tiles, list) or not raw_tiles:
            raise ValueError("tiles must be a non-empty array")
        tiles = [_normalize_tile(tile, idx) for idx, tile in enumerate(raw_tiles)]

        model_name, model = _resolve_model(payload.get("model"))
        if model is None:
            raise ValueError("no models available. Add .pkl files to models/")

        if hasattr(model, "predict_tile_records"):
            confidences = model.predict_tile_records(tiles, day)
        elif hasattr(model, "predict_proba"):
            confidences = model.predict_proba([tile["id"] for tile in tiles], day)
        else:
            raise ValueError("model is not inference-capable")

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
            "body": __import__("json").dumps(
                {
                    "ok": True,
                    "model": model_name,
                    "day": day,
                    "count": len(results),
                    "results": results,
                }
            ),
        }

    except Exception as exc:  # pragma: no cover - runtime response path
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": __import__("json").dumps({"ok": False, "error": str(exc)}),
        }
