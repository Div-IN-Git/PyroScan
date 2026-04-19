"""PyroScan prediction helpers."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from api.services.data_fetcher import data_fetcher
from api.services.model_loader import model_loader
from api.services.tile_processor import Tile, tile_processor


def _heuristic_scores(features: np.ndarray) -> np.ndarray:
    matrix = np.atleast_2d(np.asarray(features, dtype=np.float32))
    lst = np.clip((matrix[:, 2] - 10.0) / 50.0, 0.0, 1.0)
    humidity = 1.0 - np.clip(matrix[:, 3] / 100.0, 0.0, 1.0)
    wind = np.clip(matrix[:, 4] / 20.0, 0.0, 1.0)
    ndvi = np.clip(1.0 - matrix[:, 0], 0.0, 1.0)
    precipitation = np.clip(1.0 - matrix[:, 6] / 50.0, 0.0, 1.0)
    days_since_rain = np.clip(matrix[:, 11] / 14.0, 0.0, 1.0)
    fuel_moisture = np.clip(matrix[:, 12] / 100.0, 0.0, 1.0)
    fire_history = np.clip(matrix[:, 13] / 12.0, 0.0, 1.0)
    score = (
        lst * 0.22
        + humidity * 0.20
        + wind * 0.15
        + ndvi * 0.12
        + precipitation * 0.12
        + days_since_rain * 0.10
        + fuel_moisture * 0.07
        + fire_history * 0.02
    )
    noise = np.random.default_rng(42).uniform(-0.04, 0.04, len(score))
    return np.clip(score + noise, 0.0, 1.0)


def _get_score(feature_matrix: np.ndarray) -> np.ndarray:
    if model_loader.is_loaded():
        try:
            return model_loader.predict(feature_matrix)
        except Exception:
            pass
    return _heuristic_scores(feature_matrix)


def score_tiles_sync(tiles, day_offset: int = 0):
    features_list = [data_fetcher.fetch_features_sync(t.lat, t.lon, day_offset) for t in tiles]
    matrix = np.array([feature_row.to_numpy() for feature_row in features_list], dtype=np.float32)
    scores = _get_score(matrix)
    for tile, score, feature_row in zip(tiles, scores, features_list):
        tile.classify(float(np.clip(score, 0.0, 1.0)))
        tile.factor_breakdown = tile_processor.build_factor_breakdown(
            feature_row.__dict__, tile.risk_score / 100
        )
    return tiles


def score_single_tile_sync(zone_id, lat, lon, day_offset: int = 0):
    features = data_fetcher.fetch_features_sync(lat, lon, day_offset)
    matrix = np.array([features.to_numpy()], dtype=np.float32)
    score = float(np.clip(_get_score(matrix)[0], 0.0, 1.0))
    tile = Tile(id=zone_id, lat=lat, lon=lon, lat_size=1.0, lon_size=1.0)
    tile.classify(score)
    tile.factor_breakdown = tile_processor.build_factor_breakdown(features.__dict__, score)
    payload = tile.to_dict()
    payload["raw_features"] = features.__dict__
    payload["model_names"] = model_loader.model_names
    return payload


def forecast_sync(lat, lon):
    days = []
    for offset in range(10):
        features = data_fetcher.fetch_features_sync(lat, lon, offset)
        matrix = np.array([features.to_numpy()], dtype=np.float32)
        score = float(np.clip(_get_score(matrix)[0], 0.0, 1.0))
        tile = Tile(id=f"fc_{offset}", lat=lat, lon=lon, lat_size=1, lon_size=1)
        tile.classify(score)
        days.append(
            {
                "day": offset,
                "date": (date.today() + timedelta(days=offset)).isoformat(),
                "risk_score": tile.risk_score,
                "risk_tier": tile.risk_tier.value if tile.risk_tier else None,
                "color": tile.color,
            }
        )

    return {
        "lat": lat,
        "lon": lon,
        "forecast_days": days,
        "model_active": model_loader.is_loaded(),
        "model_names": model_loader.model_names,
    }
