"""
Faster - Backend
Traffic prediction API for Albania.
"""

import os
import math
from datetime import datetime, timedelta
import socket

import requests
from flask import Flask, jsonify, request, send_from_directory, redirect

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = BASE_DIR

app = Flask(__name__, static_folder=PROJECT_DIR, static_url_path="")
APP_SLUG = ""

# Albania bounds
ALBANIA_LAT_MIN, ALBANIA_LAT_MAX = 39.64, 42.66
ALBANIA_LON_MIN, ALBANIA_LON_MAX = 19.26, 21.06
DEFAULT_LAT, DEFAULT_LON = 41.3275, 19.8187

# Timetable configuration
SCHOOL_START = 8.0
SCHOOL_END = 13.0
BUSINESS_START = 9.0
BUSINESS_END = 17.0
PEAK_SPREAD = 0.5

REGIONS = [
    {"code": "SHK", "lat": 42.0683, "lon": 19.5126},
    {"code": "KUK", "lat": 42.0683, "lon": 20.4212},
    {"code": "DIB", "lat": 41.6853, "lon": 20.4299},
    {"code": "LEZ", "lat": 41.7861, "lon": 19.6517},
    {"code": "DUR", "lat": 41.3242, "lon": 19.4554},
    {"code": "TIR", "lat": 41.3275, "lon": 19.8187},
    {"code": "ELB", "lat": 41.1133, "lon": 20.0842},
    {"code": "FIE", "lat": 40.7167, "lon": 19.5667},
    {"code": "BER", "lat": 40.7058, "lon": 19.9522},
    {"code": "VLO", "lat": 40.4667, "lon": 19.4833},
    {"code": "KOR", "lat": 40.6167, "lon": 20.7831},
    {"code": "GJI", "lat": 40.0758, "lon": 20.1389},
]


def is_in_albania(lat: float, lon: float) -> bool:
    return ALBANIA_LAT_MIN <= lat <= ALBANIA_LAT_MAX and ALBANIA_LON_MIN <= lon <= ALBANIA_LON_MAX


def parse_coordinates() -> tuple[float, float]:
    """Read lat/lon query params with backend defaults."""
    lat = float(request.args.get("lat", DEFAULT_LAT))
    lon = float(request.args.get("lon", DEFAULT_LON))
    return lat, lon


def parse_hour_arg(raw: str | None) -> float | None:
    if raw is None:
        return None
    return float(raw)


def gaussian_peak(hour: float, center: float, spread: float, amplitude: float = 1.0) -> float:
    return amplitude * math.exp(-((hour - center) ** 2) / (2 * spread ** 2))


def get_base_traffic(hour: float) -> float:
    h = hour % 24
    school_morning = gaussian_peak(h, SCHOOL_START - 0.55, PEAK_SPREAD, 24)
    school_drop = gaussian_peak(h, SCHOOL_START + 0.05, PEAK_SPREAD * 0.78, 22)
    work_morning = gaussian_peak(h, BUSINESS_START - 0.15, PEAK_SPREAD * 0.95, 22)
    midday = gaussian_peak(h, 12.35, 0.72, 10)
    school_exit = gaussian_peak(h, SCHOOL_END + 0.1, PEAK_SPREAD * 0.95, 14)
    work_evening = gaussian_peak(h, BUSINESS_END + 0.15, PEAK_SPREAD * 1.18, 37)
    evening_leisure = gaussian_peak(h, 19.4, 1.25, 9)
    baseline = 6 if 6 <= h <= 22.5 else 2

    total = (
        baseline
        + school_morning
        + school_drop
        + work_morning
        + midday
        + school_exit
        + work_evening
        + evening_leisure
    )
    return min(100, total)


def get_weather_multiplier(weather_code: int, precipitation: float) -> float:
    snow_codes = {71, 73, 75, 77, 85, 86}
    rain_codes = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}
    fog_codes = {45, 48}
    storm_codes = {95, 96, 99}

    mult = 1.0
    if weather_code in storm_codes:
        mult = 1.5
    elif weather_code in snow_codes:
        mult = 1.42 + min(0.34, precipitation / 8)
    elif weather_code in rain_codes:
        mult = 1.14 + min(0.34, precipitation / 4)
    elif weather_code in fog_codes:
        mult = 1.2
    elif 1 <= weather_code <= 3:
        mult = 1.03

    if precipitation >= 8:
        mult += 0.12
    elif precipitation >= 4:
        mult += 0.06
    return mult


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lon / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_city_profile(lat: float, lon: float) -> dict:
    nearest = None
    min_dist = float("inf")
    for region in REGIONS:
        d = distance_meters(lat, lon, region["lat"], region["lon"])
        if d < min_dist:
            min_dist = d
            nearest = region

    if not nearest:
        return {"base": 1.0, "commute": 1.0, "midday": 1.0, "evening": 1.0}

    code = nearest["code"]
    if code == "TIR":
        return {"base": 1.15, "commute": 1.18, "midday": 1.08, "evening": 1.10}
    if code in {"DUR", "VLO", "SHK"}:
        return {"base": 1.08, "commute": 1.11, "midday": 1.05, "evening": 1.07}
    if code in {"ELB", "FIE", "KOR"}:
        return {"base": 1.05, "commute": 1.08, "midday": 1.03, "evening": 1.05}
    return {"base": 1.02, "commute": 1.05, "midday": 1.02, "evening": 1.03}


def get_day_multiplier(dt: datetime, hour: float) -> float:
    is_weekend = dt.weekday() >= 5
    if is_weekend:
        if 7 <= hour < 10:
            return 0.76
        if 11 <= hour < 15:
            return 1.08
        if 18 <= hour < 22:
            return 1.12
        return 0.92

    if 6.5 <= hour < 9.5:
        return 1.14
    if 11.5 <= hour < 14:
        return 1.05
    if 16 <= hour < 19.5:
        return 1.17
    return 1.0


def get_season_multiplier(dt: datetime) -> float:
    m = dt.month
    if m in {12, 1, 2}:
        return 1.07
    if 6 <= m <= 8:
        return 1.03
    return 1.0


def get_event_multiplier(dt: datetime, hour: float) -> float:
    mult = 1.0
    if dt.weekday() == 4 and 16 <= hour < 21:  # Friday evening
        mult *= 1.08
    if dt.weekday() == 0 and 7 <= hour < 10:  # Monday morning
        mult *= 1.06
    return mult


def get_city_hour_multiplier(profile: dict, hour: float) -> float:
    mult = profile["base"]
    if 6.5 <= hour < 9.5 or 16 <= hour < 19.5:
        mult *= profile["commute"]
    if 11.5 <= hour < 14.5:
        mult *= profile["midday"]
    if 18.5 <= hour < 22:
        mult *= profile["evening"]
    return mult


def predict_traffic(
    hour: float,
    weather_code: int = 0,
    precipitation: float = 0,
    lat: float = 41.3275,
    lon: float = 19.8187,
    dt: datetime | None = None,
) -> dict:
    h = hour % 24
    now_dt = dt or datetime.now()
    profile = get_city_profile(lat, lon)

    base = get_base_traffic(h)
    weather_mult = get_weather_multiplier(weather_code, precipitation)
    day_mult = get_day_multiplier(now_dt, h)
    season_mult = get_season_multiplier(now_dt)
    event_mult = get_event_multiplier(now_dt, h)
    city_mult = get_city_hour_multiplier(profile, h)

    adjusted = base * weather_mult * day_mult * season_mult * event_mult * city_mult
    if adjusted > 60:
        adjusted += (adjusted - 60) * 0.12
    adjusted = min(100, adjusted)

    return {
        "hour": h,
        "base_traffic": round(base, 1),
        "weather_multiplier": round(weather_mult, 2),
        "predicted_traffic": round(adjusted, 1),
        "level": "low" if adjusted < 30 else "medium" if adjusted < 55 else "high",
    }


def fetch_weather(lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> dict:
    """
    Fetch weather data safely.
    If the API fails or times out, returns default data
    so the app won’t crash.
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "weather_code,precipitation",
            "forecast_days": 2,
        }
        r = requests.get(url, params=params, timeout=5)  # shorter timeout
        r.raise_for_status()
        data = r.json()
        # Ensure hourly keys exist
        if "hourly" not in data:
            data["hourly"] = {"weather_code": [0]*48, "precipitation": [0]*48}
        return data
    except Exception as e:
        # Return default dummy data instead of crashing
        return {
            "error": str(e),
            "hourly": {
                "weather_code": [0] * 48,
                "precipitation": [0] * 48
            }
        }


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/index.html")
@app.route("/frontend/index.html")
def legacy_index_redirect():
    if APP_SLUG:
        return redirect(f"/{APP_SLUG}")
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route(f"/{APP_SLUG}")
def named_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/weather")
def api_weather():
    lat, lon = parse_coordinates()
    if not is_in_albania(lat, lon):
        return jsonify({"error": "Only locations in Albania are supported."}), 400
    data = fetch_weather(lat, lon)
    if "error" in data and data.get("hourly") is None:
        return jsonify({"error": data["error"]}), 500
    return jsonify(data)


@app.route("/api/predict")
def api_predict():
    hour_arg = parse_hour_arg(request.args.get("hour"))
    lat, lon = parse_coordinates()
    if not is_in_albania(lat, lon):
        return jsonify({"error": "Only locations in Albania are supported."}), 400

    weather = fetch_weather(lat, lon)
    hourly_weather = weather.get("hourly") or {}
    codes = hourly_weather.get("weather_code", [0] * 48)
    precip = hourly_weather.get("precipitation", [0] * 48)

    if hour_arg is not None:
        h = hour_arg
        idx = max(0, min(int(h), len(codes) - 1))
        selected_dt = datetime.now().replace(
            hour=int(h) % 24,
            minute=max(0, min(59, int((h % 1) * 60))),
            second=0,
            microsecond=0,
        )
        pred = predict_traffic(
            h,
            codes[idx] if idx < len(codes) else 0,
            precip[idx] if idx < len(precip) else 0,
            lat=lat,
            lon=lon,
            dt=selected_dt,
        )
        return jsonify(pred)

    now = datetime.now()
    results = []
    for i in range(24):
        slot_dt = now + timedelta(hours=i)
        h = slot_dt.hour + slot_dt.minute / 60
        idx = min(i, len(codes) - 1)
        c = codes[idx] if idx < len(codes) else 0
        p = precip[idx] if idx < len(precip) else 0
        results.append(predict_traffic(h, c, p, lat=lat, lon=lon, dt=slot_dt))
    return jsonify({"predictions": results})


@app.route("/api/traffic-curve")
def api_traffic_curve():
    curve = [{"hour": h, "traffic": round(get_base_traffic(h), 1)} for h in range(24)]
    return jsonify(curve)


def resolve_local_ip() -> str:
    """
    Best-effort LAN IP detection so users can open the app from phone.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    lan_ip = resolve_local_ip()
    named_path = f"/{APP_SLUG}" if APP_SLUG else ""
    print(f"Local: http://127.0.0.1:{port}{named_path}")
    print(f"Phone: http://{lan_ip}:{port}{named_path}")
    app.run(host=host, port=port, debug=debug)
