"""PyroScan model loading and ensemble inference."""

from __future__ import annotations

import json
import logging
import threading
import warnings
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger("pyroscan.model_loader")

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
SUPPORTED_EXTENSIONS = {".pkl", ".pt", ".onnx", ".h5"}


class ModelState(str, Enum):
    PENDING = "MODEL_PENDING"
    LOADING = "MODEL_LOADING"
    ACTIVE = "MODEL_ACTIVE"
    ERROR = "MODEL_ERROR"


class ModelNotAvailableError(Exception):
    pass


@dataclass
class LoadedModel:
    name: str
    path: Path
    backend: str
    model: Any
    feature_names: tuple[str, ...] = ()


class ModelLoader:
    def __init__(self) -> None:
        self._models: list[LoadedModel] = []
        self._errors: dict[str, str] = {}
        self._config: dict[str, Any] = {}
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self.state = ModelState.PENDING
        self.model_name: Optional[str] = None
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._scan()
        watcher = threading.Thread(
            target=self._poll,
            daemon=True,
            name="ModelWatcher",
        )
        watcher.start()

    def is_loaded(self) -> bool:
        return self.state == ModelState.ACTIVE and bool(self._models)

    @property
    def model_names(self) -> list[str]:
        return [entry.name for entry in self._models]

    @property
    def load_errors(self) -> dict[str, str]:
        return dict(self._errors)

    def describe(self) -> list[dict[str, Any]]:
        return [
            {
                "name": entry.name,
                "backend": entry.backend,
                "path": str(entry.path.relative_to(MODELS_DIR.parent)),
                "feature_names": list(entry.feature_names),
            }
            for entry in self._models
        ]

    def predict(self, features: np.ndarray) -> np.ndarray:
        matrix = np.atleast_2d(np.asarray(features, dtype=np.float32))
        with self._lock:
            if not self.is_loaded():
                raise ModelNotAvailableError(
                    "No compatible models are loaded. Check the /models folder."
                )

            predictions = []
            weights = []
            for entry in self._models:
                adapted = self._adapt_features(matrix, entry.feature_names)
                raw = self._infer(entry, adapted)
                predictions.append(np.clip(raw, 0.0, 1.0))
                weights.append(self._weight(entry))

        if len(predictions) == 1:
            return predictions[0]

        stacked = np.vstack(predictions)
        return np.average(stacked, axis=0, weights=np.asarray(weights, dtype=np.float32))

    def _scan(self) -> None:
        with self._lock:
            self.state = ModelState.LOADING
            self._config = self._load_config()
            candidates = sorted(
                path for path in MODELS_DIR.iterdir() if path.suffix.lower() in SUPPORTED_EXTENSIONS
            )

            if not candidates:
                self._models = []
                self._errors = {}
                self.model_name = None
                self.state = ModelState.PENDING
                return

            loaded: list[LoadedModel] = []
            errors: dict[str, str] = {}
            for path in candidates:
                try:
                    loaded.append(self._load_candidate(path))
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.exception("Failed to load model %s", path.name)
                    errors[path.name] = str(exc)

            self._models = loaded
            self._errors = errors
            self.model_name = ", ".join(entry.name for entry in loaded) if loaded else None
            self.state = ModelState.ACTIVE if loaded else ModelState.ERROR

    def _load_config(self) -> dict[str, Any]:
        cfg = MODELS_DIR / "model_config.json"
        if not cfg.exists():
            return {}
        try:
            with cfg.open() as handle:
                return json.load(handle)
        except Exception:  # pragma: no cover - best effort config loading
            logger.warning("Could not parse model_config.json", exc_info=True)
            return {}

    def _load_candidate(self, path: Path) -> LoadedModel:
        ext = path.suffix.lower()
        if ext == ".pkl":
            import pickle

            with path.open("rb") as handle:
                with warnings.catch_warnings():
                    warnings.filterwarnings(
                        "ignore",
                        message="Trying to unpickle estimator .* from version .*",
                    )
                    obj = pickle.load(handle)

            feature_names: tuple[str, ...] = ()
            backend = "pickle"
            model = obj
            if isinstance(obj, dict) and "model" in obj:
                model = obj["model"]
                backend = "sklearn-bundle"
                raw_names = obj.get("feature_names") or getattr(model, "feature_names_in_", ())
                feature_names = self._normalise_feature_names(raw_names)
            else:
                feature_names = self._normalise_feature_names(
                    getattr(model, "feature_names_in_", ())
                )

            return LoadedModel(
                name=path.stem,
                path=path,
                backend=backend,
                model=model,
                feature_names=feature_names,
            )

        if ext == ".pt":
            import torch

            model = torch.jit.load(str(path), map_location="cpu")
            return LoadedModel(name=path.stem, path=path, backend="torchscript", model=model)

        if ext == ".onnx":
            import onnxruntime as ort

            model = ort.InferenceSession(str(path))
            return LoadedModel(name=path.stem, path=path, backend="onnx", model=model)

        if ext == ".h5":
            import tensorflow as tf

            model = tf.keras.models.load_model(str(path))
            return LoadedModel(name=path.stem, path=path, backend="keras", model=model)

        raise ValueError(f"Unsupported model format: {path.suffix}")

    def _normalise_feature_names(self, raw_names: Any) -> tuple[str, ...]:
        if raw_names is None:
            return ()
        if isinstance(raw_names, np.ndarray):
            return tuple(str(item) for item in raw_names.tolist())
        if isinstance(raw_names, (list, tuple)):
            return tuple(str(item) for item in raw_names)
        return ()

    def _weight(self, entry: LoadedModel) -> float:
        if entry.backend == "sklearn-bundle":
            return 1.25
        if entry.name == "local_model":
            return 1.05
        return 1.0

    def _infer(self, entry: LoadedModel, features: np.ndarray) -> np.ndarray:
        model = entry.model
        if entry.backend in {"pickle", "sklearn-bundle"}:
            if hasattr(model, "predict_proba"):
                with warnings.catch_warnings():
                    warnings.filterwarnings(
                        "ignore",
                        message="X does not have valid feature names, but .*",
                    )
                    raw = np.asarray(model.predict_proba(features))
                return raw[:, 1] if raw.ndim == 2 else raw.reshape(-1)
            if hasattr(model, "predict"):
                with warnings.catch_warnings():
                    warnings.filterwarnings(
                        "ignore",
                        message="X does not have valid feature names, but .*",
                    )
                    raw = np.asarray(model.predict(features))
                if raw.ndim == 2:
                    return raw[:, 1] if raw.shape[1] > 1 else raw.reshape(-1)
                return raw.reshape(-1)
            raise ValueError(f"Pickle model {entry.name} has no predict interface.")

        if entry.backend == "torchscript":
            import torch

            with torch.no_grad():
                output = model(torch.tensor(features, dtype=torch.float32))
            return np.asarray(output).reshape(-1).astype(float)

        if entry.backend == "onnx":
            input_name = model.get_inputs()[0].name
            output = model.run(None, {input_name: features.astype(np.float32)})[0]
            return np.asarray(output).reshape(-1).astype(float)

        if entry.backend == "keras":
            return np.asarray(model.predict(features.astype(np.float32), verbose=0)).reshape(-1)

        raise ValueError(f"No inference path for backend {entry.backend!r}")

    def _adapt_features(self, features: np.ndarray, feature_names: tuple[str, ...]) -> np.ndarray:
        if not feature_names:
            return features

        ndvi = np.clip(features[:, 0], -1.0, 1.0)
        evi = np.clip(features[:, 1], -1.0, 1.0)
        temp = features[:, 2]
        humidity = np.clip(features[:, 3], 0.0, 100.0)
        wind = np.clip(features[:, 4], 0.0, None)
        precip_7d = np.clip(features[:, 6], 0.0, None)
        slope = np.clip(features[:, 7], 0.0, None)
        aspect = np.clip(features[:, 8], 0.0, 360.0)
        elevation = np.clip(features[:, 9], 0.0, None)
        human_density = np.clip(features[:, 10], 0.0, 1.0)
        days_since_rain = np.clip(features[:, 11], 0.0, None)
        fuel_moisture = np.clip(features[:, 12], 0.0, 100.0)
        fire_history = np.clip(features[:, 13], 0.0, None)

        weather = np.clip(
            ((temp - 10.0) / 45.0) * 0.45
            + (1.0 - humidity / 100.0) * 0.35
            + np.clip(wind / 25.0, 0.0, 1.0) * 0.20,
            0.0,
            1.0,
        )
        ndmi = np.clip((ndvi * 0.45) + (evi * 0.20) + (humidity / 100.0) * 0.35, -1.0, 1.0)
        roads = np.clip(human_density * 1.2 + (fire_history / 20.0), 0.0, 1.0)
        landcover = np.select(
            [
                ndvi < 0.10,
                ndvi < 0.25,
                ndvi < 0.45,
                ndvi < 0.65,
            ],
            [5.0, 4.0, 3.0, 2.0],
            default=1.0,
        )

        derived = {
            "ndvi": ndvi,
            "evi": evi,
            "lst": temp,
            "land_surface_temp": temp,
            "relative_humidity": humidity,
            "humidity": humidity,
            "wind_speed": wind,
            "wind_direction": features[:, 5],
            "precip_7d": precip_7d,
            "precipitation_7d": precip_7d,
            "slope": slope,
            "aspect": aspect,
            "elevation": elevation,
            "human_density_index": human_density,
            "days_since_last_rain": days_since_rain,
            "days_since_rain": days_since_rain,
            "fuel_moisture_code": fuel_moisture,
            "historical_fire_count": fire_history,
            "roads": roads,
            "landcover": landcover,
            "ndmi": ndmi,
            "weather": weather,
        }

        columns = []
        for name in feature_names:
            key = str(name).strip().lower()
            if key not in derived:
                raise ValueError(
                    f"Model feature {name!r} is not supported by the current feature adapter."
                )
            columns.append(np.asarray(derived[key], dtype=np.float32))

        return np.column_stack(columns).astype(np.float32, copy=False)

    def _snapshot(self) -> frozenset[tuple[str, float]]:
        try:
            return frozenset(
                (path.name, path.stat().st_mtime)
                for path in MODELS_DIR.iterdir()
                if path.suffix.lower() in SUPPORTED_EXTENSIONS
            )
        except Exception:
            return frozenset()

    def _poll(self) -> None:
        last = self._snapshot()
        while not self._stop_event.wait(5):
            current = self._snapshot()
            if current != last:
                self._scan()
                last = current


model_loader = ModelLoader()
