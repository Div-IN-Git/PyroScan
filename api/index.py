"""
PyroScan API — Vercel Serverless Entry Point
Flask app. Vercel runs this file as the Python function for all /api/* routes.

Path resolution: On Vercel, the working directory is the REPO ROOT.
services/ and routers/ live at repo root, so we add BOTH the api/ dir
and the repo root to sys.path so all imports resolve correctly.
"""

import sys
import os

# ── Path setup ────────────────────────────────────────────────────────────────
# __file__ = /var/task/api/index.py  on Vercel
# repo root = /var/task/
_api_dir  = os.path.dirname(os.path.abspath(__file__))   # .../api/
_repo_root = os.path.dirname(_api_dir)                    # .../  (repo root)

# Insert repo root first so  "import services.x" resolves from repo root
for p in [_repo_root, _api_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from flask import Flask, jsonify, request

try:
    from flask_cors import CORS
    _has_cors = True
except ImportError:
    _has_cors = False

app = Flask(__name__)
if _has_cors:
    CORS(app)

_upload_jobs = {}


# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    try:
        from services.model_loader import model_loader
        return jsonify({
            "status": "ok",
            "version": "1.0.0",
            "model_loaded": model_loader.is_loaded(),
            "model_name": model_loader.model_name,
            "model_state": model_loader.state.value,
        })
    except Exception as e:
        return jsonify({"status": "ok", "version": "1.0.0",
                        "model_loaded": False, "error": str(e)}), 200


# ── Risk tiles ────────────────────────────────────────────────────────────────
@app.route("/api/risk/tiles")
def risk_tiles():
    try:
        min_lat    = float(request.args.get("min_lat", -90))
        max_lat    = float(request.args.get("max_lat",  90))
        min_lon    = float(request.args.get("min_lon", -180))
        max_lon    = float(request.args.get("max_lon",  180))
        day_offset = int(request.args.get("day_offset", 0))
        td         = request.args.get("tile_deg")
        tile_deg   = float(td) if td else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if min_lat >= max_lat or min_lon >= max_lon:
        return jsonify({"error": "Invalid bounding box"}), 400

    from services.tile_processor import tile_processor
    from services.model_loader import model_loader
    from routers.predict import score_tiles_sync

    tiles = tile_processor.generate_grid(min_lat, min_lon, max_lat, max_lon, tile_deg)
    if len(tiles) > 512:
        return jsonify({"error": "Requested area too large — reduce bbox or increase tile_deg"}), 400

    tiles = score_tiles_sync(tiles, day_offset)
    return jsonify({
        "model_active": model_loader.is_loaded(),
        "model_state":  model_loader.state.value,
        "day_offset":   day_offset,
        "tile_count":   len(tiles),
        "tiles":        [t.to_dict() for t in tiles],
    })


# ── Zone detail ───────────────────────────────────────────────────────────────
@app.route("/api/risk/zone/<zone_id>")
def zone_detail(zone_id):
    try:
        lat        = float(request.args.get("lat", 37.5))
        lon        = float(request.args.get("lon", -122.0))
        day_offset = int(request.args.get("day_offset", 0))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    from routers.predict import score_single_tile_sync
    return jsonify(score_single_tile_sync(zone_id, lat, lon, day_offset))


# ── Forecast ──────────────────────────────────────────────────────────────────
@app.route("/api/forecast")
def forecast():
    lat = float(request.args.get("lat", 37.5))
    lon = float(request.args.get("lon", -122.0))
    from routers.predict import forecast_sync
    return jsonify(forecast_sync(lat, lon))


# ── Weather ───────────────────────────────────────────────────────────────────
@app.route("/api/weather/current")
def weather_current():
    lat = float(request.args.get("lat", 37.0))
    lon = float(request.args.get("lon", -122.0))
    from services.data_fetcher import data_fetcher
    data = data_fetcher.fetch_weather_sync(lat, lon)
    return jsonify({"lat": lat, "lon": lon, **data})


# ── Environmental layers ──────────────────────────────────────────────────────
@app.route("/api/layers/vegetation")
def vegetation():
    lat = float(request.args.get("lat", 37.0))
    lon = float(request.args.get("lon", -122.0))
    from services.data_fetcher import data_fetcher
    f = data_fetcher.fetch_features_sync(lat, lon)
    return jsonify({"lat": lat, "lon": lon, "ndvi": f.ndvi, "evi": f.evi})


@app.route("/api/layers/temperature")
def temperature():
    lat = float(request.args.get("lat", 37.0))
    lon = float(request.args.get("lon", -122.0))
    from services.data_fetcher import data_fetcher
    f = data_fetcher.fetch_features_sync(lat, lon)
    return jsonify({"lat": lat, "lon": lon, "land_surface_temp": f.land_surface_temp})


# ── GeoJSON upload ────────────────────────────────────────────────────────────
@app.route("/api/maps/upload", methods=["POST"])
def upload_map():
    import json, uuid
    from services.tile_processor import tile_processor
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file   = request.files["file"]
    job_id = str(uuid.uuid4())[:12]
    try:
        content = file.read().decode("utf-8")
        geojson = json.loads(content)
        bbox    = tile_processor.geojson_to_bbox(geojson)
        _upload_jobs[job_id] = {
            "status": "completed", "bbox": list(bbox), "filename": file.filename
        }
    except Exception as e:
        _upload_jobs[job_id] = {"status": "error", "error": str(e)}
    return jsonify({"job_id": job_id, "status": _upload_jobs[job_id]["status"]})


@app.route("/api/maps/<job_id>/status")
def job_status(job_id):
    if job_id not in _upload_jobs:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"job_id": job_id, **_upload_jobs[job_id]})


# ── Geocoding search ──────────────────────────────────────────────────────────
@app.route("/api/search")
def geocode():
    q = request.args.get("q", "")
    if len(q) < 2:
        return jsonify({"error": "Query too short"}), 422
    import requests as req
    try:
        r = req.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 5},
            headers={"User-Agent": "PyroScan/1.0"},
            timeout=8,
        )
        return jsonify({
            "query":   q,
            "results": [
                {"name": item.get("display_name", ""),
                 "lat":  float(item["lat"]),
                 "lon":  float(item["lon"]),
                 "type": item.get("type", "")}
                for item in r.json()
            ],
        })
    except Exception as e:
        return jsonify({"error": str(e), "results": []}), 503


# ── API index ─────────────────────────────────────────────────────────────────
@app.route("/api/docs")
@app.route("/api")
def api_docs():
    return jsonify({
        "api":       "PyroScan v1.0.0",
        "endpoints": [
            {"method": "GET",  "path": "/api/health"},
            {"method": "GET",  "path": "/api/risk/tiles"},
            {"method": "GET",  "path": "/api/risk/zone/<id>"},
            {"method": "GET",  "path": "/api/forecast"},
            {"method": "GET",  "path": "/api/weather/current"},
            {"method": "GET",  "path": "/api/layers/vegetation"},
            {"method": "GET",  "path": "/api/layers/temperature"},
            {"method": "POST", "path": "/api/maps/upload"},
            {"method": "GET",  "path": "/api/maps/<id>/status"},
            {"method": "GET",  "path": "/api/search"},
        ],
    })


# ── Local dev ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=8000)
