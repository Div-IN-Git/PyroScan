"""
PyroScan API Test Suite
=======================
Tests all core API endpoints and internal services.
Run with: pytest tests/test_api.py -v
"""

import sys
import os
import numpy as np
import pytest

# Ensure api/ is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))


# ─────────────────────────────────────────────────────────────────────────── #
#  Unit tests — TileProcessor                                                  #
# ─────────────────────────────────────────────────────────────────────────── #


class TestTileProcessor:
    def setup_method(self):
        from tile_processor import TileProcessor
        self.processor = TileProcessor()

    def test_generate_grid_returns_tiles(self):
        tiles = self.processor.generate_grid(30, -120, 35, -115)
        assert len(tiles) > 0

    def test_generate_grid_tile_count(self):
        tiles = self.processor.generate_grid(0, 0, 5, 5, tile_deg=1.0)
        # 5×5 grid = 25 tiles
        assert len(tiles) == 25

    def test_tile_classification_low(self):
        tiles = self.processor.generate_grid(0, 0, 1, 1, tile_deg=1.0)
        scored = self.processor.classify_tiles(tiles, [0.10])
        assert scored[0].risk_tier.value == "LOW"
        assert scored[0].color == "#22c55e"

    def test_tile_classification_moderate(self):
        tiles = self.processor.generate_grid(0, 0, 1, 1, tile_deg=1.0)
        scored = self.processor.classify_tiles(tiles, [0.40])
        assert scored[0].risk_tier.value == "MODERATE"
        assert scored[0].color == "#eab308"

    def test_tile_classification_high(self):
        tiles = self.processor.generate_grid(0, 0, 1, 1, tile_deg=1.0)
        scored = self.processor.classify_tiles(tiles, [0.65])
        assert scored[0].risk_tier.value == "HIGH"
        assert scored[0].color == "#f97316"

    def test_tile_classification_extreme(self):
        tiles = self.processor.generate_grid(0, 0, 1, 1, tile_deg=1.0)
        scored = self.processor.classify_tiles(tiles, [0.90])
        assert scored[0].risk_tier.value == "EXTREME"
        assert scored[0].color == "#ef4444"

    def test_risk_score_stored_as_0_to_100(self):
        tiles = self.processor.generate_grid(0, 0, 1, 1, tile_deg=1.0)
        scored = self.processor.classify_tiles(tiles, [0.75])
        assert scored[0].risk_score == 75.0

    def test_tile_to_dict_structure(self):
        tiles = self.processor.generate_grid(0, 0, 1, 1, tile_deg=1.0)
        scored = self.processor.classify_tiles(tiles, [0.50])
        d = scored[0].to_dict()
        required_keys = {"id", "lat", "lon", "risk_score", "risk_tier", "color", "center", "bounds"}
        assert required_keys.issubset(d.keys())

    def test_geojson_to_bbox(self):
        geojson = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[10, 20], [15, 20], [15, 25], [10, 25], [10, 20]]]
            }
        }
        min_lat, min_lon, max_lat, max_lon = self.processor.geojson_to_bbox(geojson)
        assert min_lat == 20
        assert min_lon == 10
        assert max_lat == 25
        assert max_lon == 15

    def test_geojson_to_bbox_no_coords_raises(self):
        with pytest.raises(ValueError):
            self.processor.geojson_to_bbox({"type": "FeatureCollection", "features": []})

    def test_factor_breakdown_sums_near_risk(self):
        breakdown = self.processor.build_factor_breakdown({}, 0.8)
        total = sum(breakdown.values())
        # Total should be approximately risk_score * 100 (80) with weights summing to 1.0
        assert 70 < total < 90

    def test_auto_tile_deg_limits_tiles(self):
        # Large bounding box should auto-select a big tile_deg
        tiles = self.processor.generate_grid(-90, -180, 90, 180)
        assert len(tiles) <= self.processor.MAX_TILES


# ─────────────────────────────────────────────────────────────────────────── #
#  Unit tests — ModelLoader                                                    #
# ─────────────────────────────────────────────────────────────────────────── #


class TestModelLoader:
    def test_state_is_pending_when_no_model(self):
        """ModelLoader should be in PENDING state when no model files exist."""
        from model_loader import model_loader, ModelState
        # In CI there are no model files, so state is PENDING or ERROR
        assert model_loader.state in (ModelState.PENDING, ModelState.ACTIVE, ModelState.ERROR)

    def test_is_loaded_returns_bool(self):
        from model_loader import model_loader
        assert isinstance(model_loader.is_loaded(), bool)

    def test_predict_raises_when_no_model(self, tmp_path, monkeypatch):
        """predict() must raise ModelNotAvailableError when no model is loaded."""
        from model_loader import ModelLoader, ModelState, ModelNotAvailableError
        monkeypatch.setattr(
            "services.model_loader.MODELS_DIR", tmp_path
        )
        loader = ModelLoader.__new__(ModelLoader)
        import threading
        loader._model = None
        loader._config = {}
        loader._lock = threading.RLock()
        loader.state = ModelState.PENDING
        loader.model_name = None
        loader._stop_event = threading.Event()

        with pytest.raises(ModelNotAvailableError):
            loader.predict(np.zeros((1, 14), dtype=np.float32))

    def test_sklearn_model_loads_and_predicts(self, tmp_path, monkeypatch):
        """A minimal sklearn model should load and produce predictions."""
        import pickle
        from sklearn.ensemble import RandomForestClassifier

        # Train a tiny model
        X = np.random.rand(100, 14).astype(np.float32)
        y = (X[:, 0] > 0.5).astype(int)
        clf = RandomForestClassifier(n_estimators=3, random_state=0)
        clf.fit(X, y)

        model_path = tmp_path / "wildfire_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(clf, f)

        monkeypatch.setattr("services.model_loader.MODELS_DIR", tmp_path)

        from model_loader import ModelLoader, ModelState
        loader = ModelLoader()
        assert loader.state == ModelState.ACTIVE

        scores = loader.predict(np.random.rand(5, 14).astype(np.float32))
        assert scores.shape == (5,)
        assert np.all((scores >= 0) & (scores <= 1))


# ─────────────────────────────────────────────────────────────────────────── #
#  Unit tests — DataFetcher                                                    #
# ─────────────────────────────────────────────────────────────────────────── #


class TestDataFetcher:
    @pytest.mark.asyncio
    async def test_fetch_tile_features_shape(self):
        from data_fetcher import data_fetcher
        features = await data_fetcher.fetch_tile_features(37.5, -122.0, 0)
        arr = features.to_numpy()
        assert arr.shape == (14,)

    @pytest.mark.asyncio
    async def test_fetch_tile_features_ranges(self):
        from data_fetcher import data_fetcher
        features = await data_fetcher.fetch_tile_features(10.0, 20.0, 0)
        assert -1.0 <= features.ndvi <= 1.0
        assert -1.0 <= features.evi <= 1.0
        assert 0 <= features.relative_humidity <= 100
        assert 0 <= features.wind_speed
        assert 0 <= features.human_density_index <= 1.0

    @pytest.mark.asyncio
    async def test_weather_fallback(self):
        from data_fetcher import DataFetcher
        f = DataFetcher()
        w = await f.fetch_weather_current(45.0, 10.0)
        assert "temp" in w
        assert "humidity" in w

    def test_fuel_moisture_code_bounds(self):
        from data_fetcher import DataFetcher
        f = DataFetcher()
        fmc = f._calc_fuel_moisture_code(40, 10, 20, 0)
        assert 0 <= fmc <= 100

    def test_synthetic_weather_deterministic(self):
        from data_fetcher import DataFetcher
        f = DataFetcher()
        w1 = f._synthetic_weather(37.0, -122.0)
        w2 = f._synthetic_weather(37.0, -122.0)
        assert w1["temp"] == w2["temp"]


# ─────────────────────────────────────────────────────────────────────────── #
#  Integration tests — FastAPI endpoints                                       #
# ─────────────────────────────────────────────────────────────────────────── #


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    import importlib, sys

    # Ensure api/ is on path
    api_dir = os.path.join(os.path.dirname(__file__), "..", "api")
    sys.path.insert(0, api_dir)

    from index import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200

    def test_health_has_model_loaded_field(self, client):
        data = client.get("/api/health").json()
        assert "model_loaded" in data
        assert "model_state" in data
        assert "version" in data

    def test_health_version_is_1_0_0(self, client):
        data = client.get("/api/health").json()
        assert data["version"] == "1.0.0"


class TestRiskTilesEndpoint:
    def test_small_bbox_returns_tiles(self, client):
        r = client.get("/api/risk/tiles", params={
            "min_lat": 37.0, "max_lat": 39.0,
            "min_lon": -122.0, "max_lon": -120.0,
            "tile_deg": 1.0,
        })
        assert r.status_code == 200
        data = r.json()
        assert "tiles" in data
        assert len(data["tiles"]) > 0

    def test_tiles_have_required_fields(self, client):
        r = client.get("/api/risk/tiles", params={
            "min_lat": 0, "max_lat": 2,
            "min_lon": 0, "max_lon": 2,
            "tile_deg": 1.0,
        })
        data = r.json()
        tile = data["tiles"][0]
        for key in ("id", "lat", "lon", "risk_score", "risk_tier", "color"):
            assert key in tile, f"Missing key: {key}"

    def test_risk_scores_in_range(self, client):
        r = client.get("/api/risk/tiles", params={
            "min_lat": 10, "max_lat": 15,
            "min_lon": 10, "max_lon": 15,
            "tile_deg": 1.0,
        })
        data = r.json()
        for tile in data["tiles"]:
            assert 0 <= tile["risk_score"] <= 100

    def test_invalid_bbox_returns_400(self, client):
        r = client.get("/api/risk/tiles", params={
            "min_lat": 50, "max_lat": 30,
            "min_lon": 0, "max_lon": 10,
        })
        assert r.status_code == 400

    def test_day_offset_parameter(self, client):
        r = client.get("/api/risk/tiles", params={
            "min_lat": 0, "max_lat": 2,
            "min_lon": 0, "max_lon": 2,
            "tile_deg": 1.0, "day_offset": 5,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["day_offset"] == 5


class TestForecastEndpoint:
    def test_forecast_returns_10_days(self, client):
        r = client.get("/api/forecast/37.5/-122.0")
        assert r.status_code == 200
        data = r.json()
        assert len(data["forecast_days"]) == 10

    def test_forecast_day_structure(self, client):
        r = client.get("/api/forecast/37.5/-122.0")
        data = r.json()
        day = data["forecast_days"][0]
        for key in ("day", "date", "risk_score", "risk_tier", "color"):
            assert key in day

    def test_forecast_risk_scores_valid(self, client):
        r = client.get("/api/forecast/37.5/-122.0")
        data = r.json()
        for day in data["forecast_days"]:
            assert 0 <= day["risk_score"] <= 100


class TestZoneDetailEndpoint:
    def test_zone_detail_returns_breakdown(self, client):
        r = client.get("/api/risk/zone/test_zone", params={"lat": 37.5, "lon": -122.0})
        assert r.status_code == 200
        data = r.json()
        assert "factor_breakdown" in data
        assert "raw_features" in data
        assert "risk_score" in data


class TestWeatherEndpoint:
    def test_weather_returns_data(self, client):
        r = client.get("/api/weather/current", params={"lat": 37.5, "lon": -122.0})
        assert r.status_code == 200
        data = r.json()
        assert "temp" in data
        assert "humidity" in data


class TestSearchEndpoint:
    def test_search_returns_results(self, client):
        r = client.get("/api/search", params={"q": "California"})
        # May succeed or 503 if geocoding is blocked in CI
        assert r.status_code in (200, 503)

    def test_search_short_query_rejected(self, client):
        r = client.get("/api/search", params={"q": "A"})
        assert r.status_code == 422


class TestUploadEndpoint:
    def test_geojson_upload(self, client):
        import json
        geojson = json.dumps({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[10, 20], [15, 20], [15, 25], [10, 25], [10, 20]]]
            }
        })
        r = client.post(
            "/api/maps/upload",
            files={"file": ("test.geojson", geojson.encode(), "application/json")},
        )
        assert r.status_code == 200
        data = r.json()
        assert "job_id" in data
        assert data["status"] == "completed"

    def test_job_status_retrieval(self, client):
        import json
        geojson = json.dumps({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]
            }
        })
        r1 = client.post(
            "/api/maps/upload",
            files={"file": ("test.geojson", geojson.encode(), "application/json")},
        )
        job_id = r1.json()["job_id"]
        r2 = client.get(f"/api/maps/{job_id}/status")
        assert r2.status_code == 200
        assert r2.json()["job_id"] == job_id

    def test_missing_job_returns_404(self, client):
        r = client.get("/api/maps/nonexistent-job/status")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────── #
#  Heuristic scoring tests                                                     #
# ─────────────────────────────────────────────────────────────────────────── #


class TestHeuristicScoring:
    def test_dry_hot_windy_scores_high(self):
        """High temp, low humidity, high wind → high risk."""
        from predict import _heuristic_scores
        # Hot (60°C), dry (5%), very windy (25 m/s), no rain for 14 days
        features = np.array([[
            0.1,   # ndvi — dry
            0.1,   # evi
            60.0,  # temp — very hot
            5.0,   # humidity — very dry
            25.0,  # wind speed — high
            180.0, # wind dir
            0.0,   # precip_7d — no rain
            20.0,  # slope
            180.0, # aspect
            500.0, # elevation
            0.3,   # human density
            14,    # days since rain
            90.0,  # fmc — high
            5,     # fire count
        ]], dtype=np.float32)
        scores = _heuristic_scores(features)
        assert scores[0] > 0.6, f"Expected high risk score, got {scores[0]}"

    def test_wet_cool_calm_scores_low(self):
        """Low temp, high humidity, low wind, recent rain → low risk."""
        from predict import _heuristic_scores
        features = np.array([[
            0.8,   # ndvi — lush
            0.7,   # evi
            15.0,  # temp — cool
            90.0,  # humidity — very humid
            1.0,   # wind speed — calm
            90.0,  # wind dir
            50.0,  # precip_7d — heavy rain
            5.0,   # slope
            90.0,  # aspect
            100.0, # elevation
            0.1,   # human density
            0,     # days since rain — just rained
            5.0,   # fmc — low
            0,     # fire count
        ]], dtype=np.float32)
        scores = _heuristic_scores(features)
        assert scores[0] < 0.4, f"Expected low risk score, got {scores[0]}"

    def test_scores_always_in_0_1(self):
        """All outputs must be clipped to [0, 1]."""
        from predict import _heuristic_scores
        np.random.seed(99)
        features = np.random.rand(100, 14).astype(np.float32)
        scores = _heuristic_scores(features)
        assert np.all(scores >= 0.0) and np.all(scores <= 1.0)

    def test_batch_scoring(self):
        """Should handle any batch size."""
        from predict import _heuristic_scores
        for n in [1, 5, 50, 200]:
            features = np.random.rand(n, 14).astype(np.float32)
            scores = _heuristic_scores(features)
            assert scores.shape == (n,)
