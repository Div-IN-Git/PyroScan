"""Compatibility helpers for legacy PyroScan pickle models.

These lightweight wrappers were originally pickled from a module named
``predict_server``. Re-introducing the module lets us load those models
without retraining them.
"""

from __future__ import annotations

import math
from typing import Iterable

import numpy as np


class ModelWrapper:
    """Synthetic risk model used by legacy global/local/continent pickles."""

    classes_ = np.array([0, 1], dtype=np.int64)
    n_features_in_ = 14

    _PROFILE_WEIGHTS = {
        "global_model": {
            "heat": 0.23,
            "dryness": 0.22,
            "wind": 0.14,
            "vegetation": 0.11,
            "terrain": 0.08,
            "human": 0.07,
            "hotspot": 0.09,
            "rain": 0.06,
        },
        "continent_model": {
            "heat": 0.24,
            "dryness": 0.21,
            "wind": 0.13,
            "vegetation": 0.11,
            "terrain": 0.10,
            "human": 0.05,
            "hotspot": 0.10,
            "rain": 0.06,
        },
        "local_model": {
            "heat": 0.20,
            "dryness": 0.19,
            "wind": 0.12,
            "vegetation": 0.10,
            "terrain": 0.07,
            "human": 0.12,
            "hotspot": 0.14,
            "rain": 0.06,
        },
    }

    def __init__(
        self,
        model_name: str = "global_model",
        baseline: float = 0.15,
        amplitude: float = 0.6,
        temporal_shift: float = 1.0,
        local_variance: float = 0.1,
        hotspot_strength: float = 0.2,
    ) -> None:
        self.model_name = model_name
        self.baseline = baseline
        self.amplitude = amplitude
        self.temporal_shift = temporal_shift
        self.local_variance = local_variance
        self.hotspot_strength = hotspot_strength

    def predict_proba(self, features: Iterable[Iterable[float]]) -> np.ndarray:
        scores = self._score(np.asarray(features, dtype=np.float32))
        return np.column_stack([1.0 - scores, scores])

    def predict(self, features: Iterable[Iterable[float]]) -> np.ndarray:
        scores = self._score(np.asarray(features, dtype=np.float32))
        return (scores >= 0.5).astype(np.int64)

    def _score(self, matrix: np.ndarray) -> np.ndarray:
        matrix = np.atleast_2d(matrix).astype(np.float32, copy=False)
        if matrix.shape[1] != self.n_features_in_:
            raise ValueError(
                f"{self.model_name} expects {self.n_features_in_} features, "
                f"received {matrix.shape[1]}."
            )

        weights = self._PROFILE_WEIGHTS.get(
            self.model_name, self._PROFILE_WEIGHTS["global_model"]
        )

        ndvi = np.clip(matrix[:, 0], -1.0, 1.0)
        evi = np.clip(matrix[:, 1], -1.0, 1.0)
        temp = matrix[:, 2]
        humidity = np.clip(matrix[:, 3], 0.0, 100.0)
        wind = np.clip(matrix[:, 4], 0.0, None)
        precip_7d = np.clip(matrix[:, 6], 0.0, None)
        slope = np.clip(matrix[:, 7], 0.0, None)
        human_density = np.clip(matrix[:, 10], 0.0, 1.0)
        days_since_rain = np.clip(matrix[:, 11], 0.0, None)
        fuel_moisture = np.clip(matrix[:, 12], 0.0, 100.0)
        fire_history = np.clip(matrix[:, 13], 0.0, None)

        heat = np.clip((temp - 12.0) / 48.0, 0.0, 1.0)
        dryness = np.clip(1.0 - (humidity / 100.0), 0.0, 1.0)
        wind_risk = np.clip(wind / 22.0, 0.0, 1.0)
        vegetation_stress = np.clip(1.0 - ((ndvi + evi) / 2.0 + 0.2), 0.0, 1.0)
        terrain = np.clip(slope / 40.0, 0.0, 1.0)
        rain_deficit = np.clip(days_since_rain / 18.0, 0.0, 1.0)
        fuel_risk = np.clip(fuel_moisture / 100.0, 0.0, 1.0)
        fire_memory = np.clip(fire_history / 12.0, 0.0, 1.0)
        precip_relief = np.clip(precip_7d / 35.0, 0.0, 1.0)

        hotspot = np.clip(
            (fire_memory * 0.6 + human_density * 0.4)
            * (1.0 + self.local_variance)
            * (1.0 + self.hotspot_strength),
            0.0,
            1.0,
        )

        seasonal = 0.5 + 0.5 * np.sin(
            (days_since_rain / 3.0) + self.temporal_shift + (wind_risk * math.pi / 2.0)
        )

        score = (
            self.baseline
            + self.amplitude
            * (
                weights["heat"] * heat
                + weights["dryness"] * dryness
                + weights["wind"] * wind_risk
                + weights["vegetation"] * vegetation_stress
                + weights["terrain"] * terrain
                + weights["human"] * human_density
                + weights["hotspot"] * hotspot
                + weights["rain"] * rain_deficit
            )
            + 0.08 * seasonal
            + 0.06 * fuel_risk
            - 0.10 * precip_relief
        )

        return np.clip(score, 0.0, 1.0)
