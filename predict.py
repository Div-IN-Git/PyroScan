"""PyroScan Predict helpers — sync Flask version"""
from __future__ import annotations
import numpy as np
from datetime import date, timedelta
from data_fetcher import data_fetcher
from tile_processor import tile_processor, Tile
from model_loader import model_loader

def _heuristic(features: np.ndarray) -> np.ndarray:
    f = features
    lst  = np.clip((f[:,2]-10)/50, 0, 1)
    hum  = 1 - np.clip(f[:,3]/100, 0, 1)
    wind = np.clip(f[:,4]/20, 0, 1)
    ndvi = np.clip(1-f[:,0], 0, 1)
    prec = np.clip(1-f[:,6]/50, 0, 1)
    dsr  = np.clip(f[:,11]/14, 0, 1)
    fmc  = np.clip(f[:,12]/100, 0, 1)
    score = lst*0.22 + hum*0.20 + wind*0.15 + ndvi*0.12 + prec*0.12 + dsr*0.10 + fmc*0.09
    noise = np.random.default_rng(42).uniform(-0.04, 0.04, len(score))
    return np.clip(score+noise, 0, 1)

def _get_score(feature_matrix):
    if model_loader.is_loaded():
        try:
            return model_loader.predict(feature_matrix)
        except Exception:
            pass
    return _heuristic(feature_matrix)

def score_tiles_sync(tiles, day_offset=0):
    features_list = [data_fetcher.fetch_features_sync(t.lat, t.lon, day_offset) for t in tiles]
    matrix = np.array([f.to_numpy() for f in features_list])
    scores = _get_score(matrix)
    for tile, score, feat in zip(tiles, scores, features_list):
        tile.classify(float(np.clip(score, 0, 1)))
        tile.factor_breakdown = tile_processor.build_factor_breakdown(feat.__dict__, tile.risk_score/100)
    return tiles

def score_single_tile_sync(zone_id, lat, lon, day_offset=0):
    features = data_fetcher.fetch_features_sync(lat, lon, day_offset)
    matrix = np.array([features.to_numpy()])
    score = float(np.clip(_get_score(matrix)[0], 0, 1))
    tile = Tile(id=zone_id, lat=lat, lon=lon, lat_size=1.0, lon_size=1.0)
    tile.classify(score)
    tile.factor_breakdown = tile_processor.build_factor_breakdown(features.__dict__, score)
    d = tile.to_dict()
    d["raw_features"] = features.__dict__
    return d

def forecast_sync(lat, lon):
    days = []
    for i in range(10):
        features = data_fetcher.fetch_features_sync(lat, lon, i)
        matrix = np.array([features.to_numpy()])
        score = float(np.clip(_get_score(matrix)[0], 0, 1))
        tile = Tile(id=f"fc_{i}", lat=lat, lon=lon, lat_size=1, lon_size=1)
        tile.classify(score)
        days.append({"day": i, "date": (date.today()+timedelta(days=i)).isoformat(),
                     "risk_score": tile.risk_score, "risk_tier": tile.risk_tier.value if tile.risk_tier else None,
                     "color": tile.color})
    return {"lat": lat, "lon": lon, "forecast_days": days, "model_active": model_loader.is_loaded()}
