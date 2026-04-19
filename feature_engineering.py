"""
PyroScan Feature Engineering
=============================
Single source of truth for all feature transformations.

Imported by:
  - train_model.py        (training)
  - api/routers/predict.py (inference)

NEVER duplicate this logic. Any change here applies to both paths automatically.
"""

from __future__ import annotations
import numpy as np
import pandas as pd

RAW_FEATURE_NAMES = [
    "ndvi",
    "evi",
    "land_surface_temp",
    "relative_humidity",
    "wind_speed",
    "wind_direction",
    "precipitation_7d",
    "slope",
    "aspect",
    "elevation",
    "human_density_index",
    "days_since_last_rain",
    "fuel_moisture_code",
    "historical_fire_count",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add 6 derived features to a raw 14-column DataFrame.

    Input:  DataFrame with columns == RAW_FEATURE_NAMES (any order is fine,
            columns are selected by name not position)
    Output: DataFrame with 20 columns in fixed order.
            Column order is always: raw features (14) + derived (6).
    """
    out = df[RAW_FEATURE_NAMES].copy()

    # 1. Temp/humidity ratio — spikes when hot and dry simultaneously
    out["temp_humidity_ratio"] = out["land_surface_temp"] / (out["relative_humidity"] + 1e-6)

    # 2. Dryness index — composite of vegetation dryness, rain deficit, temperature
    ndvi_dry   = np.clip(1 - out["ndvi"], 0, 1)
    precip_dry = np.clip(1 - out["precipitation_7d"] / 50.0, 0, 1)
    temp_norm  = np.clip((out["land_surface_temp"] - 10) / 50.0, 0, 1)
    out["dryness_index"] = ndvi_dry * 0.4 + precip_dry * 0.35 + temp_norm * 0.25

    # 3. Wind × temperature interaction — fast-spreading conditions
    out["wind_temp_interaction"] = out["wind_speed"] * out["land_surface_temp"]

    # 4. Drought × wind compound — prolonged dryness amplified by wind
    out["drought_wind"] = out["days_since_last_rain"] * (1 + out["wind_speed"] / 10.0)

    # 5. Slope fire spread index — fire climbs steep slopes faster
    slope_rad = np.radians(out["slope"])
    out["slope_fire_index"] = np.sin(slope_rad) * out["wind_speed"]

    # 6. Solar exposure from aspect — south-facing slopes (180°) are driest
    aspect_rad = np.radians(out["aspect"])
    out["solar_exposure"] = (1.0 - np.cos(aspect_rad - np.pi)) / 2.0

    return out


def engineer_single(raw_array: np.ndarray) -> np.ndarray:
    """
    Engineer features for a single row or batch (numpy interface).

    Input:  np.ndarray  shape (N, 14)  — must match RAW_FEATURE_NAMES order
    Output: np.ndarray  shape (N, 20)  — ready for scaler + model

    This is the fast path used in the API hot loop.
    """
    df = pd.DataFrame(raw_array, columns=RAW_FEATURE_NAMES)
    engineered = engineer_features(df)
    return engineered.values.astype(np.float32)


def get_feature_names() -> list[str]:
    """Return the full 20-feature name list after engineering. Used for validation."""
    dummy = pd.DataFrame([np.zeros(14)], columns=RAW_FEATURE_NAMES)
    return list(engineer_features(dummy).columns)
