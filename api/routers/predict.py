"""Compatibility wrapper exposing prediction helpers under ``routers.predict``."""

from api.services.predict import (
    _heuristic_scores,
    forecast_sync,
    score_single_tile_sync,
    score_tiles_sync,
)

__all__ = [
    "_heuristic_scores",
    "forecast_sync",
    "score_single_tile_sync",
    "score_tiles_sync",
]
