# api/services/feature_engineering.py

import numpy as np
import pandas as pd

def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # NDMI calculation
    if "nir" in df.columns and "swir" in df.columns:
        df["ndmi"] = (df["nir"] - df["swir"]) / (df["nir"] + df["swir"] + 1e-6)
    else:
        # fallback if raw bands not available
        df["ndmi"] = 0.0

    return df