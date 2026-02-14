# PyroScan
PyroScan is an AI-driven wildfire risk mapping system that fuses satellite imagery, thermal data, vegetation indices, terrain, weather, and human proximity to predict forest fire risk. It processes geospatial data into tiled zones and generates color-coded maps (green to red) for proactive monitoring, planning, and early warning.

[Demo]

# Features
-  Future fire preditiction
-  zone categorization(low to high)
-  4 colors-color grading system
-  Upload map of a place(drag & drop)
-  Trained on multiple different types to data to predict fire

# Getting Started

# Project Structure

# Tech Stack


## Backend model endpoint
- Frontend predictions call `/predict_batch` on the current site origin by default.
- For local development on `localhost`, the frontend defaults to `http://127.0.0.1:8000/predict_batch`.
- You can override and persist this in browser console:

```js
window.PyroScanML.configure({
  backendUrl: "https://<your-backend-domain>/predict_batch",
  backendModel: "fire_risk_model",
});
```

- Inspect the active configuration with:

```js
window.PyroScanML.getConfig()
```
