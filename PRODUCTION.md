# SentriQ Production Checklist

This project is working for prototype/demo use. To move it toward production, tighten these areas first.

## 1. Realtime Database shape

Each collar should write to one stable path:

```json
{
  "pawtect": {
    "DOG_001": {
      "temperature": 38.5,
      "heartRate": 112,
      "spO2": 97,
      "latitude": 12.9716,
      "longitude": 77.5946,
      "timestamp": 1724745600000,
      "gpsValid": true,
      "heartContact": true,
      "wifiConnected": true,
      "speedKmph": 0.8,
      "sats": 7
    }
  }
}
```

Notes:
- `timestamp` is required for reliable online/offline state.
- Device ID in Firebase must exactly match the collar ID saved in the app.

## 2. Firebase rules

Do not keep public read/write rules in production.

Current app limitation:
- The dashboard currently reads RTDB directly from the browser.
- Because the app is not using Firebase Auth yet, fully private RTDB reads are not possible without adding a backend or Firebase Auth for web users.

Safer transitional rules:

```json
{
  "rules": {
    "pawtect": {
      "$deviceId": {
        ".read": true,
        ".write": "auth != null",
        "temperature": {
          ".validate": "newData.isNumber() && newData.val() >= -20 && newData.val() <= 80"
        },
        "heartRate": {
          ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 260"
        },
        "spO2": {
          ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100"
        },
        "latitude": {
          ".validate": "newData.isNumber() && newData.val() >= -90 && newData.val() <= 90"
        },
        "longitude": {
          ".validate": "newData.isNumber() && newData.val() >= -180 && newData.val() <= 180"
        },
        "timestamp": {
          ".validate": "newData.isNumber()"
        },
        "gpsValid": {
          ".validate": "newData.isBoolean()"
        },
        "heartContact": {
          ".validate": "newData.isBoolean()"
        },
        "wifiConnected": {
          ".validate": "newData.isBoolean()"
        },
        "speedKmph": {
          ".validate": "newData.isNumber() || !newData.exists()"
        },
        "sats": {
          ".validate": "newData.isNumber() || !newData.exists()"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

Best production target:
- Web app users authenticate with Firebase Auth.
- RTDB reads are limited to signed-in NGO users.
- Device writes go through a controlled writer path, ideally per-device credentials or a backend endpoint.

## 3. ESP8266 firmware hardening

The current sketch is a good prototype, but these changes matter for production:

- Remove hardcoded Wi-Fi credentials from committed source.
- Move `WIFI_SSID`, `WIFI_PASSWORD`, `API_KEY`, `DATABASE_URL`, and device ID into a separate untracked config header.
- Add `timestamp` to every upload.
- Add booleans like `gpsValid`, `heartContact`, and `wifiConnected`.
- Keep the device ID configurable per collar instead of hardcoding `DOG_001`.
- Use structured retry/backoff for Firebase auth failures.
- Reset or mark sensor values invalid instead of uploading misleading zeros when contact is lost.

Minimum upload payload:

```cpp
FirebaseJson json;
json.set("temperature", temperatureValid ? temperatureC : nullptr);
json.set("heartRate", heartRateValid ? heartRate : 0);
json.set("spO2", spO2Valid ? spO2 : 0);
json.set("latitude", gpsLocationValid ? latitude : 0);
json.set("longitude", gpsLocationValid ? longitude : 0);
json.set("timestamp", millis());
json.set("gpsValid", gpsLocationValid);
json.set("heartContact", contactDetected);
json.set("wifiConnected", WiFi.status() == WL_CONNECTED);
json.set("speedKmph", 0);
json.set("sats", gps.satellites.isValid() ? gps.satellites.value() : 0);
```

Important:
- `millis()` is only uptime-relative. Better options are NTP time or server-generated time.
- If you cannot add NTP yet, keep the app tolerant but plan to replace uptime timestamps.

## 4. Web app hardening already added

This repo now does two safer things:
- Dev-only browser test writes. The `Send test reading` button is hidden from production builds.
- Stale-reading protection. A device reading is only treated as live when it includes a recent timestamp.

## 5. Remaining production blockers in this repo

These still need architectural work:

- App user auth is currently browser-local, not production-grade.
- Dog, NGO, community, and records data are currently stored in local browser storage.
- Anyone with the same browser can lose that data by clearing storage.

Recommended next backend milestone:

1. Move app user auth to Firebase Authentication.
2. Move NGO/dog/records/community data to Firestore.
3. Keep RTDB only for live collar telemetry.
4. Add a Cloud Function or backend worker to archive live telemetry into historical records.
5. Enforce NGO-level access control in Firestore and RTDB rules.

## 6. Suggested final architecture

- ESP8266 collar writes live telemetry to RTDB.
- Web app reads live telemetry from RTDB.
- Web app stores dog profiles, NGO profiles, chat, and records in Firestore.
- Firebase Auth secures both web and device flows.
- Cloud Functions validate, normalize, and archive telemetry.
