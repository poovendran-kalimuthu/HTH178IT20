/*
 * KPR Horizon - ESP32 WebSocket Telemetry Client
 * Target Device IP: 10.38.24.77
 * Backend WebSocket Server: ws://10.38.24.64:5000/ws
 *
 * Required Libraries:
 * 1. WebSockets by Markus Sattler
 * 2. ArduinoJson by Benoit Blanchon
 */

export const ESP32_FIRMWARE_CODE = `/*
 * KPR Horizon - ESP32 WebSocket Telemetry Client
 * Target Device IP: 10.38.24.77
 * Backend WebSocket Server: ws://10.38.24.64:5000/ws
 *
 * Required Libraries:
 * 1. WebSockets by Markus Sattler
 * 2. ArduinoJson by Benoit Blanchon
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* ws_host  = "10.38.24.64";
const int   ws_port  = 5000;
const char* ws_path  = "/ws";

WebSocketsClient webSocket;
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 300;

float voltage = 230.0;
float current1 = 12.5;
float current2 = 8.2;
float current3 = 14.1;
float current4 = 4.5;
float power = 2.875;
float frequency = 50.0;
float soc = 85.0;
float temperature = 32.0;
const int IR_PIN = 27;

bool relay1 = false;
bool relay2 = false;
bool relay3 = false;
bool relay4 = false;

void sendTelemetry() {
  voltage     = 228.0 + (random(0, 400) / 100.0);
  current1    = 10.0 + (random(0, 800) / 100.0);
  current2    = 8.0 + (random(0, 400) / 100.0);
  current3    = 14.0 + (random(0, 600) / 100.0);
  current4    = 4.0 + (random(0, 200) / 100.0);
  power       = (voltage * current1) / 1000.0;
  frequency   = 49.95 + (random(0, 10) / 100.0);
  soc         = max(10.0, soc - (power * 0.005));
  temperature = 31.0 + (random(0, 30) / 10.0);
  int irValue = digitalRead(IR_PIN);

  StaticJsonDocument<512> doc;
  doc["type"]        = "telemetry";
  doc["role"]        = "esp32";
  doc["deviceId"]    = "esp32-horizon";
  doc["ip"]          = WiFi.localIP().toString();
  doc["voltage"]     = voltage;
  doc["current1"]    = current1;
  doc["current2"]    = current2;
  doc["current3"]    = current3;
  doc["current4"]    = current4;
  doc["power"]       = power;
  doc["frequency"]   = frequency;
  doc["soc"]         = soc;
  doc["temperature"] = temperature;
  doc["ir_sensor"]   = irValue;
  doc["relay1"]      = relay1;
  doc["relay2"]      = relay2;
  doc["relay3"]      = relay3;
  doc["relay4"]      = relay4;

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
  Serial.printf("[WS] Telemetry sent: %.1fV | %.2fA | %.2fkW | IR: %d\\n", voltage, current1, power, irValue);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Horizon Server");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Connected to Server!");
      {
        StaticJsonDocument<200> handshake;
        handshake["type"] = "esp32_handshake";
        handshake["role"] = "esp32";
        handshake["deviceId"] = "esp32-horizon";
        handshake["ip"] = WiFi.localIP().toString();
        String out;
        serializeJson(handshake, out);
        webSocket.sendTXT(out);
      }
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Message received: %s\\n", payload);
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(IR_PIN, INPUT);
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  }
  Serial.println("\\nWi-Fi Connected! IP: " + WiFi.localIP().toString());

  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void loop() {
  webSocket.loop();
  if (millis() - lastTelemetryTime >= telemetryInterval) {
    lastTelemetryTime = millis();
    if (webSocket.isConnected()) {
      sendTelemetry();
    }
  }
}`;
