"""PyroScan ModelLoader — plug-and-play AI model hot-loader"""
from __future__ import annotations
import json, logging, os, threading
from enum import Enum
from pathlib import Path
from typing import Any, Optional
import numpy as np

logger = logging.getLogger("pyroscan.model_loader")
MODELS_DIR = Path(__file__).resolve().parent / "models"
SUPPORTED_EXTENSIONS = {".pkl", ".pt", ".onnx", ".h5"}

class ModelState(str, Enum):
    PENDING = "MODEL_PENDING"
    LOADING = "MODEL_LOADING"
    ACTIVE  = "MODEL_ACTIVE"
    ERROR   = "MODEL_ERROR"

class ModelNotAvailableError(Exception): pass

class ModelLoader:
    def __init__(self):
        self._model = None
        self._config = {}
        self._lock = threading.RLock()
        self.state = ModelState.PENDING
        self.model_name: Optional[str] = None
        self._target_model: Optional[str] = None
        self._stop_event = threading.Event()
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._scan()
        t = threading.Thread(target=self._poll, daemon=True, name="ModelWatcher")
        t.start()

    def get_available_models(self):
        return sorted([p.name for p in MODELS_DIR.iterdir() if p.suffix in SUPPORTED_EXTENSIONS])

    def set_active_model(self, model_name: str):
        path = MODELS_DIR / model_name
        if not path.exists() or path.suffix not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Model {model_name} not found or unsupported.")
        self._target_model = model_name
        self._load(path)

    def is_loaded(self): return self.state == ModelState.ACTIVE

    def predict(self, features: np.ndarray) -> np.ndarray:
        with self._lock:
            if not self.is_loaded():
                raise ModelNotAvailableError("No model loaded. Drop a file into /models.")
            return self._infer(features)

    def _scan(self):
        cfg = MODELS_DIR / "model_config.json"
        if cfg.exists():
            try:
                with open(cfg) as f: self._config = json.load(f)
            except Exception: pass
        candidates = sorted(p for p in MODELS_DIR.iterdir() if p.suffix in SUPPORTED_EXTENSIONS)
        if not candidates:
            self.state = ModelState.PENDING; self.model_name = None; return
        
        if self._target_model and (MODELS_DIR / self._target_model).exists():
            target_path = MODELS_DIR / self._target_model
        elif self.model_name and (MODELS_DIR / self.model_name).exists():
            target_path = MODELS_DIR / self.model_name
        else:
            target_path = candidates[0]
            
        self._load(target_path)

    def _load(self, path: Path):
        with self._lock:
            self.state = ModelState.LOADING
            try:
                ext = path.suffix.lower()
                if ext == ".pkl":
                    import pickle
                    with open(path,"rb") as f: self._model = pickle.load(f)
                elif ext == ".pt":
                    import torch; self._model = torch.jit.load(str(path), map_location="cpu")
                elif ext == ".onnx":
                    import onnxruntime as ort; self._model = ort.InferenceSession(str(path))
                elif ext == ".h5":
                    import tensorflow as tf; self._model = tf.keras.models.load_model(str(path))
                self.model_name = path.name; self.state = ModelState.ACTIVE
                logger.info(f"Model '{path.name}' loaded.")
            except Exception as e:
                logger.error(f"Load failed: {e}")
                self._model = None; self.model_name = None; self.state = ModelState.ERROR

    def _infer(self, features):
        ext = Path(self.model_name).suffix.lower()
        if ext == ".pkl":
            raw = self._model.predict_proba(features)
            return (raw[:,1] if raw.ndim==2 else raw).astype(float)
        elif ext == ".pt":
            import torch
            with torch.no_grad():
                return self._model(torch.tensor(features,dtype=torch.float32)).squeeze(-1).numpy().astype(float)
        elif ext == ".onnx":
            nm = self._model.get_inputs()[0].name
            return np.array(self._model.run(None,{nm:features.astype(np.float32)})[0]).flatten().astype(float)
        elif ext == ".h5":
            return self._model.predict(features.astype(np.float32)).flatten().astype(float)
        raise ValueError(f"No inference path for '{ext}'")

    def _snapshot(self):
        try: return frozenset((p.name, p.stat().st_mtime) for p in MODELS_DIR.iterdir() if p.suffix in SUPPORTED_EXTENSIONS)
        except: return frozenset()

    def _poll(self):
        import time
        last = self._snapshot()
        while not self._stop_event.wait(5):
            cur = self._snapshot()
            if cur != last: self._scan(); last = cur

model_loader = ModelLoader()
