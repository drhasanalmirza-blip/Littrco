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

### POST /api/device/telemetry

Reports sensor data from the bin to the server. Call this every 60 seconds during normal operation.

**Sensors Supported:**
- **DS18B20**: Temperature sensor (fire detection)
- **MQ135**: VOC/air quality sensor with analog (A0) and digital (D0) outputs
- **Fill Level**: Percentage full (0-100%)

**Request:**
```http
POST /api/device/telemetry HTTP/1.1
Host: littr.co
X-Device-Id: 1
X-Device-Key: your-device-key-here
Content-Type: application/json

{
  "temperatureC": 28.5,
  "vocAnalog": 450,
  "vocDigital": false,
  "fillPercent": 35
}
```

**Request Fields:**
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| temperatureC | number | -40 to 125 | Temperature in Celsius from DS18B20 |
| vocAnalog | integer | 0 to 4095 | Raw ADC reading from MQ135 A0 pin |
| vocDigital | boolean | true/false | Digital output from MQ135 D0 pin (high = hazard detected) |
| fillPercent | integer | 0 to 100 | Percentage full based on distance sensor |

**Response (Success):**
```json
{
  "status": "ok",
  "binId": 1,
  "fireAlertTriggered": false,
  "nextPollSeconds": 60
}
```

**Response (Rate Limited):**
```json
{
  "error": "Too fast",
  "waitSeconds": 25
}
```

**Fire Alert Triggers:**
- Temperature >= 60°C triggers HIGH severity alert
- Temperature >= 80°C triggers CRITICAL severity alert
- VOC digital pin HIGH triggers HIGH severity alert

### GET /api/device/telemetry/history

Retrieve historical sensor readings for this device's bin.

**Request:**
```http
GET /api/device/telemetry/history?limit=100 HTTP/1.1
Host: littr.co
X-Device-Id: 1
X-Device-Key: your-device-key-here
```

**Response:**
```json
{
  "binId": 1,
  "readings": [
    {
      "temperature": 28.5,
      "vocAnalog": 450,
      "vocDigital": false,
      "fillPercent": 35,
      "recordedAt": "2025-01-07T12:00:00.000Z"
    }
  ]
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

**Spin Endpoint:**
- **Minimum seconds between spins**: Configurable per shop (default: 30 seconds)
- **Daily spin cap**: Maximum spins per device per day (default: 50)
- **Daily point cap**: Maximum points per device per day (default: 200)

**Telemetry Endpoint:**
- **Minimum interval**: 30 seconds between telemetry reports
- **Recommended interval**: 60 seconds during normal operation

These values are configured by the shop owner in their partner dashboard.

## Error Codes

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 401 | Device authentication required | Missing X-Device-Id or X-Device-Key headers |
| 401 | Invalid device credentials | Wrong device key or device not found |
| 400 | Rewards disabled for this shop | Shop has turned off rewards |
| 400 | fillPercent must be 0-100 | Invalid fill level value |
| 400 | vocAnalog must be 0-4095 | Invalid ADC value |
| 400 | temperatureC out of valid range | Temperature outside -40 to 125°C |
| 429 | Too fast | Rate limit not yet reset |
| 429 | Daily spin limit reached | Daily cap exceeded |
| 429 | Daily point limit reached | Daily point cap exceeded |
| 500 | Spin failed | Server error |

## Arduino/ESP32 Example

### Complete Example with Sensors

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";

// Device credentials (from staff dashboard)
const char* deviceId = "1";
const char* deviceKey = "your-device-key-here";
const char* serverUrl = "https://littr.co";

// Sensor pins
#define ONE_WIRE_BUS 4      // DS18B20 data pin
#define MQ135_ANALOG 34     // MQ135 A0 pin
#define MQ135_DIGITAL 35    // MQ135 D0 pin
#define ULTRASONIC_TRIG 12  // Ultrasonic trigger
#define ULTRASONIC_ECHO 14  // Ultrasonic echo
#define BIN_HEIGHT_CM 50    // Total bin height for fill calculation

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL = 60000; // 60 seconds

void setup() {
  Serial.begin(115200);
  
  // Initialize sensors
  tempSensor.begin();
  pinMode(MQ135_ANALOG, INPUT);
  pinMode(MQ135_DIGITAL, INPUT);
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
}

void loop() {
  // Send telemetry every 60 seconds
  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL) {
    sendTelemetry();
    lastTelemetry = millis();
  }
  
  // Check for vape detection (your detection logic here)
  // if (vapeDetected()) {
  //   triggerSpin();
  // }
  
  delay(100);
}

float readTemperature() {
  tempSensor.requestTemperatures();
  return tempSensor.getTempCByIndex(0);
}

int readFillPercent() {
  // Ultrasonic distance measurement
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);
  
  long duration = pulseIn(ULTRASONIC_ECHO, HIGH);
  float distanceCm = duration * 0.034 / 2;
  
  // Calculate fill percentage (inverted - less distance = more full)
  int fillPercent = 100 - (int)((distanceCm / BIN_HEIGHT_CM) * 100);
  return constrain(fillPercent, 0, 100);
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  float temperature = readTemperature();
  int vocAnalog = analogRead(MQ135_ANALOG);
  bool vocDigital = digitalRead(MQ135_DIGITAL) == HIGH;
  int fillPercent = readFillPercent();
  
  HTTPClient http;
  http.begin(String(serverUrl) + "/api/device/telemetry");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", deviceId);
  http.addHeader("X-Device-Key", deviceKey);
  
  StaticJsonDocument<256> doc;
  doc["temperatureC"] = temperature;
  doc["vocAnalog"] = vocAnalog;
  doc["vocDigital"] = vocDigital;
  doc["fillPercent"] = fillPercent;
  
  String json;
  serializeJson(doc, json);
  
  int httpCode = http.POST(json);
  
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<256> resDoc;
    deserializeJson(resDoc, response);
    
    bool fireAlert = resDoc["fireAlertTriggered"];
    if (fireAlert) {
      Serial.println("⚠️ FIRE ALERT TRIGGERED!");
      // Activate local alarm if desired
    }
  } else if (httpCode == 429) {
    Serial.println("Rate limited - waiting...");
  } else {
    Serial.printf("Telemetry failed: %d\n", httpCode);
  }
  
  http.end();
}

void triggerSpin() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(serverUrl) + "/api/device/spin");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", deviceId);
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.POST("");
  
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, payload);
    
    int points = doc["points"];
    const char* qrUrl = doc["qr_url"];
    int expiresIn = doc["expires_in"];
    
    Serial.printf("Spin result: +%d points\n", points);
    Serial.printf("QR URL: %s\n", qrUrl);
    
    // Display points and QR code on your screen
    // displayPoints(points);
    // showQRCode(qrUrl, expiresIn);
  } else if (httpCode == 429) {
    Serial.println("Rate limited");
  }
  
  http.end();
}
```

## Testing

Use curl to test the API:

```bash
# Test telemetry
curl -X POST https://littr.co/api/device/telemetry \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: 1" \
  -H "X-Device-Key: demo-device-key-12345" \
  -d '{"temperatureC": 28.5, "vocAnalog": 450, "vocDigital": false, "fillPercent": 35}'

# Test spin
curl -X POST https://littr.co/api/device/spin \
  -H "X-Device-Id: 1" \
  -H "X-Device-Key: demo-device-key-12345"

# Check status
curl https://littr.co/api/device/status \
  -H "X-Device-Id: 1" \
  -H "X-Device-Key: demo-device-key-12345"

# Get telemetry history
curl "https://littr.co/api/device/telemetry/history?limit=50" \
  -H "X-Device-Id: 1" \
  -H "X-Device-Key: demo-device-key-12345"
```

## Security Notes

1. Device keys are only shown once during creation
2. Keys are stored as SHA-256 hashes in the database
3. Keep device keys secure and never expose them in client-side code
4. Rotate keys if compromised by creating a new device

## Wiring Diagram

```
ESP32 Pin Connections:
----------------------
GPIO4  -> DS18B20 Data (with 4.7kΩ pull-up to 3.3V)
GPIO34 -> MQ135 A0 (analog out)
GPIO35 -> MQ135 D0 (digital out)
GPIO12 -> Ultrasonic TRIG
GPIO14 -> Ultrasonic ECHO
3.3V   -> DS18B20 VCC, MQ135 VCC
GND    -> DS18B20 GND, MQ135 GND
```
