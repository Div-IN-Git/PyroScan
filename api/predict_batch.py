"""Vercel serverless endpoint for batch fire-risk predictions."""

import json
import os
import pickle
from http.server import BaseHTTPRequestHandler

# ============================================================================
# Model Loading & Utilities
# ============================================================================

DEFAULT_MODEL_NAME = "fire_risk_model"

def clamp_day(day):
    """Clamp day to valid range 0-9."""
    return max(0, min(9, int(day)))

def category_from_confidence(confidence):
    """Convert confidence score to risk category."""
    if confidence < 0.3:
        return "low"
    elif confidence < 0.5:
        return "moderate"
    elif confidence < 0.7:
        return "high"
    else:
        return "extreme"

def load_models(models_dir="models"):
    """Load all .pkl model files from the models directory."""
    models = {}
    if not os.path.isdir(models_dir):
        return models
    
    for filename in os.listdir(models_dir):
        if filename.endswith(".pkl"):
            model_name = filename[:-4]
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
    _MODELS = load_models("models")
    return _MODELS

def _resolve_model(requested):
    models = _get_models()
    name = str(requested or "").strip() or DEFAULT_MODEL_NAME
    if name.endswith(".pkl"):
        name = name[:-4]
    return name, models.get(name)

def _normalize_tile(tile, index):
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
# Vercel Handler Class - Must inherit from BaseHTTPRequestHandler
# ============================================================================

class handler(BaseHTTPRequestHandler):
    """Vercel serverless function handler."""
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests for fire risk prediction."""
        try:
            # Read and parse request body
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8")) if body else {}
            
            day = clamp_day(int(payload.get("day", 0)))

            # Validate tiles
            raw_tiles = payload.get("tiles")
            if not isinstance(raw_tiles, list) or not raw_tiles:
                raise ValueError("tiles must be a non-empty array")
            tiles = [_normalize_tile(tile, idx) for idx, tile in enumerate(raw_tiles)]

            # Load model
            model_name, model = _resolve_model(payload.get("model"))

            # Run prediction (or return grey-state placeholders when no model exists)
            results = []
            if model is None:
                results = [
                    {
                        "tile": tile["id"],
                        "confidence": None,
                        "category": "safe",
                    }
                    for tile in tiles
                ]
            else:
                if hasattr(model, "predict_tile_records"):
                    confidences = model.predict_tile_records(tiles, day)
                elif hasattr(model, "predict_proba"):
                    confidences = model.predict_proba([tile["id"] for tile in tiles], day)
                else:
                    raise ValueError("model is not inference-capable")

                for tile, confidence in zip(tiles, confidences):
                    score = max(0.0, min(1.0, float(confidence)))
                    results.append({
                        "tile": tile["id"],
                        "confidence": round(score, 4),
                        "category": category_from_confidence(score),
                    })

            response_data = {
                "ok": True,
                "model": model_name if model is not None else None,
                "requested_model": model_name,
                "day": day,
                "count": len(results),
                "results": results,
            }
            
            # Send successful response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode("utf-8"))

        except Exception as exc:
            # Send error response
            error_data = {"ok": False, "error": str(exc)}
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(error_data).encode("utf-8"))
    
    def do_GET(self):
        """Handle GET requests (not supported, return 405)."""
        self.send_response(405)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "method not allowed"}).encode("utf-8"))
