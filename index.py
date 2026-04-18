"""
PyroScan API — Flask entry point
Compatible with Vercel Python serverless runtime.
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

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

# ── Health ────────────────────────────────────────────────────────────────── #
@app.route("/api/health")
def health():
    from model_loader import model_loader
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "model_loaded": model_loader.is_loaded(),
        "model_name": model_loader.model_name,
        "model_state": model_loader.state.value,
    })

# ── Risk tiles ─────────────────────────────────────────────────────────────── #
@app.route("/api/risk/tiles")
def risk_tiles():
    try:
        min_lat = float(request.args.get("min_lat", -90))
        max_lat = float(request.args.get("max_lat",  90))
        min_lon = float(request.args.get("min_lon", -180))
        max_lon = float(request.args.get("max_lon",  180))
        day_offset = int(request.args.get("day_offset", 0))
        td = request.args.get("tile_deg")
        tile_deg = float(td) if td else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if min_lat >= max_lat or min_lon >= max_lon:
        return jsonify({"error": "Invalid bounding box"}), 400

    from tile_processor import tile_processor
    from model_loader import model_loader
    from predict import score_tiles_sync

    tiles = tile_processor.generate_grid(min_lat, min_lon, max_lat, max_lon, tile_deg)
    if len(tiles) > 512:
        return jsonify({"error": "Requested area too large"}), 400

    tiles = score_tiles_sync(tiles, day_offset)
    return jsonify({
        "model_active": model_loader.is_loaded(),
        "model_state": model_loader.state.value,
        "day_offset": day_offset,
        "tile_count": len(tiles),
        "tiles": [t.to_dict() for t in tiles],
    })

# ── Zone detail ────────────────────────────────────────────────────────────── #
@app.route("/api/risk/zone/<zone_id>")
def zone_detail(zone_id):
    try:
        lat = float(request.args.get("lat", 37.5))
        lon = float(request.args.get("lon", -122.0))
        day_offset = int(request.args.get("day_offset", 0))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    from predict import score_single_tile_sync
    return jsonify(score_single_tile_sync(zone_id, lat, lon, day_offset))

# ── Forecast ───────────────────────────────────────────────────────────────── #
@app.route("/api/forecast")
def forecast():
    lat = float(request.args.get("lat", 37.5))
    lon = float(request.args.get("lon", -122.0))
    from predict import forecast_sync
    return jsonify(forecast_sync(lat, lon))

# ── Weather ────────────────────────────────────────────────────────────────── #
@app.route("/api/weather/current")
def weather_current():
    lat = float(request.args.get("lat", 37.0))
    lon = float(request.args.get("lon", -122.0))
    from data_fetcher import data_fetcher
    data = data_fetcher.fetch_weather_sync(lat, lon)
    return jsonify({"lat": lat, "lon": lon, **data})

# ── Layers ─────────────────────────────────────────────────────────────────── #
@app.route("/api/layers/vegetation")
def vegetation():
    lat = float(request.args.get("lat", 37.0))
    lon = float(request.args.get("lon", -122.0))
    from data_fetcher import data_fetcher
    f = data_fetcher.fetch_features_sync(lat, lon)
    return jsonify({"lat": lat, "lon": lon, "ndvi": f.ndvi, "evi": f.evi})

@app.route("/api/layers/temperature")
def temperature():
    lat = float(request.args.get("lat", 37.0))
    lon = float(request.args.get("lon", -122.0))
    from data_fetcher import data_fetcher
    f = data_fetcher.fetch_features_sync(lat, lon)
    return jsonify({"lat": lat, "lon": lon, "land_surface_temp": f.land_surface_temp})

# ── Upload ─────────────────────────────────────────────────────────────────── #
@app.route("/api/maps/upload", methods=["POST"])
def upload_map():
    import json, uuid
    from tile_processor import tile_processor
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    job_id = str(uuid.uuid4())[:12]
    try:
        content = file.read().decode("utf-8")
        geojson = json.loads(content)
        bbox = tile_processor.geojson_to_bbox(geojson)
        _upload_jobs[job_id] = {"status": "completed", "bbox": list(bbox), "filename": file.filename}
    except Exception as e:
        _upload_jobs[job_id] = {"status": "error", "error": str(e)}
    return jsonify({"job_id": job_id, "status": _upload_jobs[job_id]["status"]})

@app.route("/api/maps/<job_id>/status")
def job_status(job_id):
    if job_id not in _upload_jobs:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"job_id": job_id, **_upload_jobs[job_id]})

# ── Search ─────────────────────────────────────────────────────────────────── #
@app.route("/api/search")
def geocode():
    q = request.args.get("q", "")
    if len(q) < 2:
        return jsonify({"error": "Query too short"}), 422
    import requests as req
    try:
        r = req.get("https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 5},
            headers={"User-Agent": "PyroScan/1.0"}, timeout=8)
        results = r.json()
        return jsonify({"query": q, "results": [
            {"name": item.get("display_name",""), "lat": float(item["lat"]),
             "lon": float(item["lon"]), "type": item.get("type","")}
            for item in results]})
    except Exception as e:
        return jsonify({"error": str(e), "results": []}), 503

# ── API docs ───────────────────────────────────────────────────────────────── #
@app.route("/api/docs")
def docs():
    return jsonify({"api": "PyroScan v1.0.0", "endpoints": [
        {"method": "GET",  "path": "/api/health",              "description": "API status and model state"},
        {"method": "GET",  "path": "/api/risk/tiles",          "description": "Risk tiles (min_lat, max_lat, min_lon, max_lon, day_offset, tile_deg)"},
        {"method": "GET",  "path": "/api/risk/zone/<id>",      "description": "Zone detail with factor breakdown"},
        {"method": "GET",  "path": "/api/forecast/<lat>/<lon>","description": "10-day probabilistic forecast"},
        {"method": "GET",  "path": "/api/weather/current",     "description": "Current weather"},
        {"method": "GET",  "path": "/api/layers/vegetation",   "description": "NDVI/EVI layer"},
        {"method": "GET",  "path": "/api/layers/temperature",  "description": "Land surface temperature"},
        {"method": "POST", "path": "/api/maps/upload",         "description": "Upload GeoJSON"},
        {"method": "GET",  "path": "/api/maps/<id>/status",    "description": "Upload job status"},
        {"method": "GET",  "path": "/api/search",              "description": "Geocode place name"},
    ]})

if __name__ == "__main__":
    app.run(debug=True, port=8000)
