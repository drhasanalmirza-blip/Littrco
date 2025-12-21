# LITTR ESP32 Device API

This document describes the API endpoints for ESP32-based LITTR recycling bin controllers.

## Authentication

All device API requests require two headers:

```
X-Device-Id: <device_id>
X-Device-Key: <device_key>
```

- **Device ID**: The numeric ID assigned when the device is created in the staff dashboard
- **Device Key**: The secret key generated during device creation (only shown once)

## Endpoints

### POST /api/device/spin

Triggers a reward spin when a vape is detected in the bin.

**Request:**
```http
POST /api/device/spin HTTP/1.1
Host: littr.co
X-Device-Id: 1
X-Device-Key: your-device-key-here
Content-Type: application/json
```

**Response (Success):**
```json
{
  "points": 3,
  "message": "+3 points",
  "qr_url": "https://littr.co/app/claim?token=abc123...",
  "expires_in": 180
}
```

**Response (Rate Limited):**
```json
{
  "error": "Too fast",
  "waitSeconds": 15
}
```

**Response (Daily Cap Reached):**
```json
{
  "error": "Daily spin limit reached"
}
```

### GET /api/device/status

Check device status and configuration.

**Request:**
```http
GET /api/device/status HTTP/1.1
Host: littr.co
X-Device-Id: 1
X-Device-Key: your-device-key-here
```

**Response:**
```json
{
  "status": "ok",
  "device": {
    "id": 1,
    "name": "Bin #1"
  },
  "shop": {
    "id": 1,
    "name": "Elite Smoke Shop"
  },
  "rewards_enabled": true,
  "today_spins": 12,
  "daily_spin_cap": 50
}
```

## QR Code Display

After a successful spin:

1. Display the `points` value on your screen (e.g., "+3 POINTS")
2. Generate a QR code from `qr_url`
3. Show the QR code for `expires_in` seconds (default 180 = 3 minutes)
4. Clear the display after expiration

## Rate Limiting

- **Minimum seconds between spins**: Configurable per shop (default: 30 seconds)
- **Daily spin cap**: Maximum spins per device per day (default: 50)
- **Daily point cap**: Maximum points per device per day (default: 200)

These values are configured by the shop owner in their partner dashboard.

## Error Codes

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 401 | Device authentication required | Missing X-Device-Id or X-Device-Key headers |
| 401 | Invalid device credentials | Wrong device key or device not found |
| 400 | Rewards disabled for this shop | Shop has turned off rewards |
| 429 | Too fast | Rate limit not yet reset |
| 429 | Daily spin limit reached | Daily cap exceeded |
| 429 | Daily point limit reached | Daily point cap exceeded |
| 500 | Spin failed | Server error |

## Arduino/ESP32 Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
const char* deviceId = "1";
const char* deviceKey = "your-device-key-here";

void triggerSpin() {
  HTTPClient http;
  http.begin("https://littr.co/api/device/spin");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", deviceId);
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.POST("");
  
  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, payload);
    
    int points = doc["points"];
    const char* qrUrl = doc["qr_url"];
    
    // Display points and QR code
    displayPoints(points);
    showQRCode(qrUrl);
  } else if (httpCode == 429) {
    // Rate limited - wait before next attempt
    Serial.println("Rate limited");
  }
  
  http.end();
}
```

## Testing

Use curl to test the API:

```bash
# Test spin
curl -X POST https://littr.co/api/device/spin \
  -H "X-Device-Id: 1" \
  -H "X-Device-Key: demo-device-key-12345"

# Check status
curl https://littr.co/api/device/status \
  -H "X-Device-Id: 1" \
  -H "X-Device-Key: demo-device-key-12345"
```

## Security Notes

1. Device keys are only shown once during creation
2. Keys are stored as SHA-256 hashes in the database
3. Keep device keys secure and never expose them in client-side code
4. Rotate keys if compromised by creating a new device
