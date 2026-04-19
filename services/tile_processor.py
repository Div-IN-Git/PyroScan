"""
PyroScan TileProcessor
======================
Generates geographic tile grids from bounding boxes,
classifies risk scores into 4-tier colour bands, and
handles GeoJSON ingestion from user uploads.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple


class RiskTier(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    EXTREME = "EXTREME"


RISK_THRESHOLDS = [
    (0.25, RiskTier.LOW),
    (0.50, RiskTier.MODERATE),
    (0.75, RiskTier.HIGH),
    (1.01, RiskTier.EXTREME),
]

TIER_COLORS = {
    RiskTier.LOW:      "#22c55e",   # green-500
    RiskTier.MODERATE: "#eab308",   # yellow-500
    RiskTier.HIGH:     "#f97316",   # orange-500
    RiskTier.EXTREME:  "#ef4444",   # red-500
}


@dataclass
class Tile:
    id: str
    lat: float
    lon: float
    lat_size: float   # degrees
    lon_size: float   # degrees
    risk_score: Optional[float] = None
    risk_tier: Optional[RiskTier] = None
    color: Optional[str] = None
    factor_breakdown: dict = field(default_factory=dict)

    def classify(self, score: float):
        self.risk_score = round(score * 100, 1)   # store as 0–100
        for threshold, tier in RISK_THRESHOLDS:
            if score <= threshold:
                self.risk_tier = tier
                self.color = TIER_COLORS[tier]
                break

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "lat": self.lat,
            "lon": self.lon,
            "lat_size": self.lat_size,
            "lon_size": self.lon_size,
            "risk_score": self.risk_score,
            "risk_tier": self.risk_tier.value if self.risk_tier else None,
            "color": self.color,
            "center": [self.lat, self.lon],
            "bounds": [
                [self.lat - self.lat_size / 2, self.lon - self.lon_size / 2],
                [self.lat + self.lat_size / 2, self.lon + self.lon_size / 2],
            ],
            "factor_breakdown": self.factor_breakdown,
        }


class TileProcessor:
    """
    Generates and classifies tile grids.

    Grid resolution ~ 1° × 1° at default zoom (≈110 km tiles).
    Finer grids are used when bbox is small.
    """

    DEFAULT_TILE_DEG = 1.0    # degrees per tile side
    MIN_TILES = 4
    MAX_TILES = 256

    def generate_grid(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        tile_deg: Optional[float] = None,
    ) -> List[Tile]:
        """Generate a grid of tiles covering the bounding box."""
        lat_span = max_lat - min_lat
        lon_span = max_lon - min_lon

        if tile_deg is None:
            # Auto-choose resolution to stay within MAX_TILES
            tile_deg = max(
                self.DEFAULT_TILE_DEG,
                math.sqrt((lat_span * lon_span) / self.MAX_TILES),
            )

        tiles: List[Tile] = []
        lat = min_lat + tile_deg / 2
        while lat < max_lat:
            lon = min_lon + tile_deg / 2
            while lon < max_lon:
                tiles.append(
                    Tile(
                        id=str(uuid.uuid4())[:8],
                        lat=round(lat, 6),
                        lon=round(lon, 6),
                        lat_size=tile_deg,
                        lon_size=tile_deg,
                    )
                )
                lon += tile_deg
            lat += tile_deg

        return tiles

    def classify_tiles(
        self,
        tiles: List[Tile],
        scores: list,  # list of float 0–1
    ) -> List[Tile]:
        """Attach risk scores and tier classifications to tiles."""
        for tile, score in zip(tiles, scores):
            tile.classify(float(score))
        return tiles

    def build_factor_breakdown(
        self,
        features_dict: dict,
        risk_score: float,
    ) -> dict:
        """
        Build a per-factor contribution breakdown.
        Uses simple linear attribution based on feature importance heuristics.
        In production this would use SHAP values.
        """
        weights = {
            "Land Surface Temperature": 0.20,
            "Relative Humidity":        0.18,
            "Wind Speed":               0.14,
            "NDVI Vegetation Index":    0.13,
            "Days Since Last Rain":     0.12,
            "Fuel Moisture Code":       0.10,
            "Slope":                    0.07,
            "Human Density Index":      0.06,
        }
        breakdown = {}
        for factor, weight in weights.items():
            contribution = round(risk_score * weight * 100, 1)
            breakdown[factor] = contribution
        return breakdown

    @staticmethod
    def geojson_to_bbox(geojson: dict) -> Tuple[float, float, float, float]:
        """Extract bounding box (min_lat, min_lon, max_lat, max_lon) from GeoJSON."""
        coords: List[Tuple[float, float]] = []

        def extract_coords(obj):
            if isinstance(obj, list):
                if obj and isinstance(obj[0], (int, float)):
                    coords.append((obj[1], obj[0]))  # [lon, lat] → (lat, lon)
                else:
                    for item in obj:
                        extract_coords(item)
            elif isinstance(obj, dict):
                if "coordinates" in obj:
                    extract_coords(obj["coordinates"])
                elif "geometry" in obj:
                    extract_coords(obj["geometry"])
                elif "features" in obj:
                    for feat in obj["features"]:
                        extract_coords(feat)

        extract_coords(geojson)
        if not coords:
            raise ValueError("No coordinates found in GeoJSON")

        lats = [c[0] for c in coords]
        lons = [c[1] for c in coords]
        return min(lats), min(lons), max(lats), max(lons)


tile_processor = TileProcessor()
