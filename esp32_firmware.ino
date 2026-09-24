/*
 * KPR Horizon - ESP32 WebSocket Telemetry Client
 * 
 * Hardware: ESP32 Dev Module
 * Target Device IP: 10.38.24.77
 * Backend WebSocket Server: ws://10.38.24.64:5000/ws
 * 
 * Dependencies (install via Arduino IDE Library Manager):
 * 1. WebSockets by Markus Sattler (version 2.4.0+)
 * 2. ArduinoJson by Benoit Blanchon (version 6.x or 7.x)
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ======================== WI-FI CONFIGURATION ========================
// Replace with your actual Wi-Fi SSID and Password if needed
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ===================== WEBSOCKET HOST CONFIGURATION ===================
// Your PC running KPR Horizon Express backend:
const char* ws_host  = "10.38.24.64";
const int   ws_port  = 5000;
const char* ws_path  = "/ws";

// ======================== HARDWARE PINS ==============================
const int IR_PIN = 27; // IR Sensor connected to GPIO 27


WebSocketsClient webSocket;
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 300; // Send telemetry every 300ms

// Simulated or real sensor state variables
float voltage = 230.0;
float current = 12.5;
float power = 2.875;
float frequency = 50.0;
float soc = 85.0; // Battery State of Charge (%)
float temperature = 32.0;

void sendTelemetry() {
  // If reading from real ADC or Modbus / CT sensors, read them here:
  // e.g., voltage = analogRead(34) * ... ;
  // Simulate natural fluctuations:
  voltage     = 228.0 + (random(0, 400) / 100.0);       // ~228V - 232V
  current     = 10.0 + (random(0, 800) / 100.0);        // ~10A - 18A
  power       = (voltage * current) / 1000.0;           // kW
  frequency   = 49.95 + (random(0, 10) / 100.0);        // ~49.95Hz - 50.05Hz
  soc         = max(10.0, soc - (power * 0.005));       // slow discharge
  temperature = 31.0 + (random(0, 30) / 10.0);
  int irValue = digitalRead(IR_PIN); // Read IR Sensor

  StaticJsonDocument<512> doc;
  doc["type"]        = "telemetry";
  doc["role"]        = "esp32";
  doc["deviceId"]    = "esp32-horizon";
  doc["ip"]          = WiFi.localIP().toString();
  doc["voltage"]     = voltage;
  doc["current"]     = current;
  doc["power"]       = power;
  doc["frequency"]   = frequency;
  doc["soc"]         = soc;
  doc["temperature"] = temperature;
  doc["ir_sensor"]   = irValue;
  doc["uptimeMs"]    = millis();

  String jsonString;
  serializeJson(doc, jsonString);

  webSocket.sendTXT(jsonString);
  Serial.printf("[WS] Telemetry sent: %.1fV | %.2fA | %.2fkW | SoC: %.1f%% | IR: %d\n", voltage, current, power, soc, irValue);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Horizon WebSocket Server!");
      break;

    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to Server at %s:%d%s\n", ws_host, ws_port, ws_path);
      // Send identification handshake
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

    case WStype_TEXT: {
      Serial.printf("[WS] Received payload: %s\n", payload);
      // Parse commands from the dashboard
      StaticJsonDocument<256> cmdDoc;
      DeserializationError error = deserializeJson(cmdDoc, payload);
      if (!error) {
        const char* cmd = cmdDoc["command"];
        if (cmd && strcmp(cmd, "ping") == 0) {
          StaticJsonDocument<128> pong;
          pong["type"] = "pong";
          pong["time"] = millis();
          String pongStr;
          serializeJson(pong, pongStr);
          webSocket.sendTXT(pongStr);
        }
      }
      break;
    }

    case WStype_BIN:
      Serial.printf("[WS] Received binary data length: %u\n", length);
      break;

    case WStype_ERROR:
      Serial.println("[WS] WebSocket Error occurred!");
      break;

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- KPR Horizon ESP32 Telemetry Client ---");

  pinMode(IR_PIN, INPUT); // Initialize IR Sensor pin

  // If already connected to Wi-Fi:
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("Connecting to Wi-Fi '%s'...", ssid);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
  }

  Serial.println("\nWi-Fi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // Configure WebSocket Client
  Serial.printf("Connecting to WebSocket: ws://%s:%d%s\n", ws_host, ws_port, ws_path);
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000); // Reconnect every 3s if dropped
  webSocket.enableHeartbeat(15000, 3000, 2); // Keep-alive ping every 15s
}

void loop() {
  webSocket.loop();

  // Send telemetry at regular intervals when connected
  if (millis() - lastTelemetryTime >= telemetryInterval) {
    lastTelemetryTime = millis();
    if (webSocket.isConnected()) {
      sendTelemetry();
    }
  }
}
