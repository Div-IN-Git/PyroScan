"""PyroScan DataFetcher — sync Flask version"""
from __future__ import annotations
import logging, os, random
import numpy as np
import requests as req_lib

logger = logging.getLogger("pyroscan.data_fetcher")
OWM_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")

from dataclasses import dataclass

@dataclass
class TileFeatures:
    ndvi: float
    evi: float
    land_surface_temp: float
    relative_humidity: float
    wind_speed: float
    wind_direction: float
    precipitation_7d: float
    slope: float
    aspect: float
    elevation: float
    human_density_index: float
    days_since_last_rain: int
    fuel_moisture_code: float
    historical_fire_count: int

    def to_numpy(self):
        return np.array([self.ndvi, self.evi, self.land_surface_temp,
            self.relative_humidity, self.wind_speed, self.wind_direction,
            self.precipitation_7d, self.slope, self.aspect, self.elevation,
            self.human_density_index, self.days_since_last_rain,
            self.fuel_moisture_code, self.historical_fire_count], dtype=np.float32)


class DataFetcher:
    def fetch_features_sync(self, lat, lon, day_offset=0):
        w = self._weather(lat, lon)
        f = self._forecast(lat, lon, day_offset)
        t = self._terrain(lat, lon)
        v = self._vegetation(lat, lon)
        fmc = self._calc_fmc(w["temp"], w["humidity"], w["wind_speed"], f["precip_7d"])
        return TileFeatures(ndvi=v["ndvi"], evi=v["evi"],
            land_surface_temp=w["temp"], relative_humidity=w["humidity"],
            wind_speed=w["wind_speed"], wind_direction=w["wind_dir"],
            precipitation_7d=f["precip_7d"], slope=t["slope"], aspect=t["aspect"],
            elevation=t["elevation"], human_density_index=self._human(lat, lon),
            days_since_last_rain=f["days_since_rain"], fuel_moisture_code=fmc,
            historical_fire_count=self._hist_fire(lat, lon))

    def fetch_weather_sync(self, lat, lon):
        return self._weather(lat, lon)

    def _weather(self, lat, lon):
        if OWM_API_KEY:
            try:
                r = req_lib.get("https://api.openweathermap.org/data/2.5/weather",
                    params={"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": "metric"}, timeout=6)
                d = r.json()
                return {"temp": d["main"]["temp"], "humidity": d["main"]["humidity"],
                        "wind_speed": d["wind"]["speed"], "wind_dir": d["wind"].get("deg",0),
                        "description": d["weather"][0]["description"]}
            except Exception: pass
        return self._synth_weather(lat, lon)

    def _forecast(self, lat, lon, day_offset):
        try:
            r = req_lib.get("https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lon,
                        "daily": "precipitation_sum,rain_sum",
                        "forecast_days": max(day_offset+1, 10), "timezone": "auto"}, timeout=6)
            d = r.json()
            precip = d.get("daily", {}).get("precipitation_sum", [0]*10)
            rain   = d.get("daily", {}).get("rain_sum", [0]*10)
            idx = min(day_offset, len(precip)-1)
            p7 = sum(precip[max(0,idx-6):idx+1])
            dsr = next((i for i,v in enumerate(reversed(rain[:idx+1])) if v and v>0.1), idx+1)
            return {"precip_7d": p7, "days_since_rain": dsr}
        except Exception:
            return self._synth_forecast(day_offset)

    @staticmethod
    def _synth_weather(lat, lon):
        rng = random.Random(int((lat*1000+lon*1000)%99999))
        return {"temp": 35-abs(lat)*0.5+rng.uniform(-5,5),
                "humidity": rng.uniform(20,70), "wind_speed": rng.uniform(1,15),
                "wind_dir": rng.uniform(0,360), "description": "synthetic"}

    @staticmethod
    def _synth_forecast(day_offset):
        rng = random.Random(day_offset*42)
        p = rng.uniform(0,5) if rng.random()>0.6 else 0.0
        return {"precip_7d": p*7, "days_since_rain": max(0, day_offset-rng.randint(0,3))}

    @staticmethod
    def _terrain(lat, lon):
        rng = random.Random(int((lat*7+lon*13)%88888))
        return {"slope": rng.uniform(0,35), "aspect": rng.uniform(0,360),
                "elevation": abs(lat)*20+rng.uniform(0,300)}

    @staticmethod
    def _vegetation(lat, lon):
        rng = random.Random(int((lat*3+lon*17)%77777))
        ndvi = max(-0.2, min(0.9, 0.6-abs(lat)*0.005+rng.uniform(-0.2,0.2)))
        return {"ndvi": ndvi, "evi": ndvi*0.9+rng.uniform(-0.05,0.05)}

    @staticmethod
    def _human(lat, lon):
        return round(random.Random(int((lat*11+lon*7)%55555)).uniform(0,0.8), 3)

    @staticmethod
    def _hist_fire(lat, lon):
        return random.Random(int((lat*5+lon*19)%44444)).randint(0,12)

    @staticmethod
    def _calc_fmc(temp, humidity, wind, precip):
        return max(0, min(100, temp*0.3+(100-humidity)*0.4+wind*0.2-precip*0.1))

data_fetcher = DataFetcher()
