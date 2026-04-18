# 🔥 PyroScan — AI-Driven Wildfire Risk Intelligence

**v1.0.0** · PRD-compliant full-stack implementation

---

## Architecture

```
pyroscan/
├── api/                        ← Flask/Python backend
│   ├── index.py                ← Flask app entry point
│   ├── requirements.txt        ← Python dependencies
│   ├── models/                 ← DROP AI MODEL HERE (.pkl/.pt/.onnx/.h5)
│   │   └── model_config.json   ← Feature schema & metadata
│   ├── routers/
│   │   ├── predict.py          ← Risk scoring + forecast logic
│   │   ├── weather.py          ← Weather endpoint
│   │   ├── upload.py           ← GeoJSON upload
│   │   ├── search.py           ← Geocoding
│   │   ├── layers.py           ← Environmental layers
│   │   └── tiles.py            ← Tile info
│   └── services/
│       ├── model_loader.py     ← Plug-and-play AI hot-loader
│       ├── data_fetcher.py     ← Multi-source data fetching
│       └── tile_processor.py   ← Grid generation & classification
├── frontend/
│   └── index.html              ← Complete Three.js globe UI
├── tests/
│   └── test_api.py             ← Full test suite (54 tests)
└── vercel.json                 ← Vercel deployment config
```

---

## Quick Start

### 1. Install Python dependencies

```bash
cd api
pip install flask numpy scikit-learn requests
# Optional for ONNX models:
pip install onnxruntime
# Optional for PyTorch models:
pip install torch
# Optional for Keras/TF models:
pip install tensorflow
```

### 2. Start the API server

```bash
cd api
python index.py
# → http://127.0.0.1:8000
```

### 3. Open the frontend

Open `frontend/index.html` in your browser **or** serve it:

```bash
cd frontend
python -m http.server 3000
# → http://localhost:3000
```

> The frontend auto-detects `localhost` and points API calls to `http://127.0.0.1:8000`

---

## Plug-and-Play AI Model

Drop any model file into `api/models/`:

| Format | Framework | Notes |
|--------|-----------|-------|
| `.pkl` | scikit-learn | Must implement `predict_proba(X)` |
| `.pt`  | PyTorch TorchScript | `torch.jit.save(model, path)` |
| `.onnx`| ONNX Runtime | Input shape `(N, 14)`, output `(N,)` |
| `.h5`  | Keras / TensorFlow | `model.save(path)` |

The system **hot-detects** the file within 5 seconds — no restart needed.

### Model contract

```python
# Input:  np.ndarray shape (N, 14) — 14 features per tile
# Output: np.ndarray shape (N,)    — risk score [0.0, 1.0]
```

Features (in order):
1. NDVI  2. EVI  3. Land Surface Temp (°C)  4. Relative Humidity (%)
5. Wind Speed (m/s)  6. Wind Direction (°)  7. Precipitation 7-day (mm)
8. Slope (°)  9. Aspect (°)  10. Elevation (m)  11. Human Density Index
12. Days Since Last Rain  13. Fuel Moisture Code  14. Historical Fire Count

### Create a demo sklearn model

```python
import pickle, numpy as np
from sklearn.ensemble import GradientBoostingClassifier

# Synthetic training data
np.random.seed(42)
X = np.random.rand(1000, 14).astype(np.float32)
# High risk = high temp, low humidity, high wind, low NDVI
y = ((X[:,2]>0.6) & (X[:,3]<0.4) & (X[:,4]>0.5)).astype(int)

clf = GradientBoostingClassifier(n_estimators=50, random_state=42)
clf.fit(X, y)

with open('api/models/wildfire_model.pkl', 'wb') as f:
    pickle.dump(clf, f)

print("Model saved — PyroScan will auto-detect it within 5 seconds!")
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/health` | Status + model state |
| `GET`  | `/api/risk/tiles` | Risk tiles for bbox |
| `GET`  | `/api/risk/zone/<id>` | Zone detail + factor breakdown |
| `GET`  | `/api/forecast` | 10-day forecast (lat, lon params) |
| `GET`  | `/api/weather/current` | Current weather |
| `GET`  | `/api/layers/vegetation` | NDVI/EVI layer |
| `GET`  | `/api/layers/temperature` | Land surface temp |
| `POST` | `/api/maps/upload` | Upload GeoJSON region |
| `GET`  | `/api/maps/<id>/status` | Upload job status |
| `GET`  | `/api/search` | Geocode place name |
| `GET`  | `/api/docs` | API endpoint listing |

### Example: get tiles for California

```bash
curl "http://127.0.0.1:8000/api/risk/tiles?\
min_lat=32&max_lat=42&min_lon=-124&max_lon=-114&tile_deg=2&day_offset=0"
```

---

## Running Tests

```bash
cd /path/to/pyroscan
python tests/test_api.py
# Expected: 54 PASSED, 0 FAILED
```

---

## Graceful Degradation

Without an AI model the system **never crashes**:
- `GET /api/health` → `model_state: "MODEL_PENDING"`
- Risk tiles still returned using built-in **heuristic engine** (weighted feature combination)
- Frontend shows 🟡 **Awaiting Model** badge
- All other features fully operational

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENWEATHERMAP_API_KEY` | _(none)_ | Live weather data (optional) |
| `NASA_FIRMS_MAP_KEY` | _(none)_ | Real thermal/fire data (optional) |

Without API keys the system uses **Open-Meteo** (free, no key) for forecasts and **synthetic weather** for current conditions.

---

## Deployment (Vercel)

```bash
npm i -g vercel
vercel --prod
```

`vercel.json` routes `/api/*` → Python serverless functions, everything else → Next.js/static.

---

## Risk Tiers

| Tier | Score | Color | Action |
|------|-------|-------|--------|
| 🟢 Low | 0–25 | Green | Normal monitoring |
| 🟡 Moderate | 26–50 | Yellow | Increased vigilance |
| 🟠 High | 51–75 | Orange | Pre-position resources |
| 🔴 Extreme | 76–100 | Red | Immediate action |
