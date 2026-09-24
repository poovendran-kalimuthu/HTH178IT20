/**
 * KPR Horizon - ESP32 Web/API to Arduino UART Relay Controller Firmware
 * Protocol:
 *   Dashboard (Wi-Fi) -> ESP32 -> UART (115200) -> Arduino UNO -> Relays 1-4
 */

export const ESP32_UART_CONTROLLER_SKETCH = `/*
 * =====================================================================
 * KPR HORIZON - ESP32 WI-FI TO ARDUINO UART CONTROLLER
 * Target Board: ESP32 Dev Module
 * Connections:
 *   ESP32 TX2 (GPIO 17) -> Arduino RX (D0 via voltage divider or direct)
 *   ESP32 RX2 (GPIO 16) <- Arduino TX (D1)
 *   GND                 <-> Arduino GND
 * =====================================================================
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// Wi-Fi Credentials
const char* ssid     = "VEL 7745";
const char* password = "12341234";

// Horizon Backend WebSocket Target
const char* ws_host  = "10.38.24.64";
const int   ws_port  = 5000;
const char* ws_path  = "/ws";

// Hardware Serial 2 for Arduino UNO Communication
#define RXD2 16
#define TXD2 17

WebSocketsClient webSocket;
WebServer server(80);

// Forward protocol code directly to Arduino over UART
void sendToArduino(String commandCode) {
  commandCode.trim();
  commandCode.toUpperCase();
  Serial2.println(commandCode); // Send with newline delimiter
  Serial.printf("[ESP32 -> ARDUINO UART] %s\\n", commandCode.c_str());
}

// HTTP REST API Handler: http://<ESP32_IP>/relay?cmd=R1_ON
void handleRelayHttp() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (server.hasArg("cmd")) {
    String cmd = server.arg("cmd");
    sendToArduino(cmd);
    server.send(200, "application/json", "{\"success\":true,\"dispatched\":\"" + cmd + "\"}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing 'cmd' parameter (e.g. R1_ON)\"}");
  }
}

// ─── Direct REST Route Setup: /relay/<id>/<state> ────────────────────
void setupRestRoutes() {
  server.enableCORS(true);

  // Relay 1
  server.on("/relay/1/on", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R1_ON");
    server.send(200, "application/json", "{\"relay\":1,\"state\":\"on\",\"code\":\"R1_ON\",\"success\":true}");
  });
  server.on("/relay/1/off", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R1_OFF");
    server.send(200, "application/json", "{\"relay\":1,\"state\":\"off\",\"code\":\"R1_OFF\",\"success\":true}");
  });

  // Relay 2
  server.on("/relay/2/on", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R2_ON");
    server.send(200, "application/json", "{\"relay\":2,\"state\":\"on\",\"code\":\"R2_ON\",\"success\":true}");
  });
  server.on("/relay/2/off", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R2_OFF");
    server.send(200, "application/json", "{\"relay\":2,\"state\":\"off\",\"code\":\"R2_OFF\",\"success\":true}");
  });

  // Relay 3
  server.on("/relay/3/on", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R3_ON");
    server.send(200, "application/json", "{\"relay\":3,\"state\":\"on\",\"code\":\"R3_ON\",\"success\":true}");
  });
  server.on("/relay/3/off", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R3_OFF");
    server.send(200, "application/json", "{\"relay\":3,\"state\":\"off\",\"code\":\"R3_OFF\",\"success\":true}");
  });

  // Relay 4
  server.on("/relay/4/on", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R4_ON");
    server.send(200, "application/json", "{\"relay\":4,\"state\":\"on\",\"code\":\"R4_ON\",\"success\":true}");
  });
  server.on("/relay/4/off", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("R4_OFF");
    server.send(200, "application/json", "{\"relay\":4,\"state\":\"off\",\"code\":\"R4_OFF\",\"success\":true}");
  });

  // Master All Relays
  server.on("/relay/all/off", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("ALL_OFF");
    server.send(200, "application/json", "{\"relay\":\"all\",\"state\":\"off\",\"code\":\"ALL_OFF\",\"success\":true}");
  });
  server.on("/relay/all/on", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    sendToArduino("ALL_ON");
    server.send(200, "application/json", "{\"relay\":\"all\",\"state\":\"on\",\"code\":\"ALL_ON\",\"success\":true}");
  });

  // Query parameter fallback (/relay?cmd=R1_ON)
  server.on("/relay", HTTP_ANY, handleRelayHttp);

  // Dynamic 404 URL fallback parser
  server.onNotFound([]() {
    String uri = server.uri();
    uri.toLowerCase();
    server.sendHeader("Access-Control-Allow-Origin", "*");

    if (uri.startsWith("/relay/")) {
      String sub = uri.substring(7); // e.g. "1/on"
      int slash = sub.indexOf('/');
      if (slash != -1) {
        String num = sub.substring(0, slash);
        String act = sub.substring(slash + 1);
        String cmd = "";

        if (num == "all" && act == "off") cmd = "ALL_OFF";
        else if (num == "all" && act == "on") cmd = "ALL_ON";
        else if (act == "on") cmd = "R" + num + "_ON";
        else if (act == "off") cmd = "R" + num + "_OFF";

        if (cmd.length() > 0) {
          sendToArduino(cmd);
          server.send(200, "application/json", "{\"success\":true,\"dispatched\":\"" + cmd + "\"}");
          return;
        }
      }
    }
    server.send(404, "application/json", "{\"error\":\"Route not found. Use /relay/1/on, /relay/1/off, etc.\"}");
  });
}

// WebSocket Event Handler
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("[WS] Connected to Horizon Platform Server!");
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
      {
        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, payload);
        if (!err) {
          if (doc.containsKey("code")) {
            String code = doc["code"].as<String>();
            sendToArduino(code);
          }
        }
      }
      break;

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);   // USB Debug Serial
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2); // UART to Arduino

  Serial.println("\\n--- KPR Horizon ESP32 Web/API Controller Starting ---");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWi-Fi Connected! IP Address: " + WiFi.localIP().toString());

  // Setup REST routes (/relay/1/on, /relay/1/off, etc.)
  setupRestRoutes();
  server.begin();
  Serial.println("Relay REST API Started! Listening on /relay/<id>/<state>");

  // Start WebSocket client to Backend
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void loop() {
  webSocket.loop();
  server.handleClient();

  // Read response ACK back from Arduino UNO
  if (Serial2.available()) {
    String reply = Serial2.readStringUntil('\\n');
    reply.trim();
    Serial.printf("[ARDUINO -> ESP32 ACK] %s\\n", reply.c_str());
  }
}`;

export const ARDUINO_UNO_RELAY_SKETCH = `/*
 * =====================================================================
 * KPR HORIZON - ARDUINO UNO RELAY CONTROLLER (UART RECEIVER)
 * Target Board: Arduino UNO / Nano (ATmega328P)
 * Relay Channels:
 *   Relay 1: Digital Pin 4 (Wi-Fi Router / Port 1)
 *   Relay 2: Digital Pin 5 (Mobile Charger / Port 2)
 *   Relay 3: Digital Pin 6 (Laptop Workstation / Port 3)
 *   Relay 4: Digital Pin 7 (Iron Box / Port 4)
 * Active Level: LOW (Standard optocoupler relay module)
 * =====================================================================
 */

// Relay Channels
const int RELAY_1 = 4;
const int RELAY_2 = 5;
const int RELAY_3 = 6;
const int RELAY_4 = 7;

// Channels 1 & 2: Active-LOW (LOW = ON, HIGH = OFF)
#define RELAY_1_2_ON   LOW
#define RELAY_1_2_OFF  HIGH

// Channels 3 & 4: Inverted Polarity / Active-HIGH (HIGH = ON, LOW = OFF)
#define RELAY_3_4_ON   HIGH
#define RELAY_3_4_OFF  LOW

void setup() {
  Serial.begin(115200); // Hardware UART connected to ESP32

  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);
  pinMode(RELAY_3, OUTPUT);
  pinMode(RELAY_4, OUTPUT);

  // Default initial safe state: all relays physically OFF
  digitalWrite(RELAY_1, RELAY_1_2_OFF);
  digitalWrite(RELAY_2, RELAY_1_2_OFF);
  digitalWrite(RELAY_3, RELAY_3_4_OFF);
  digitalWrite(RELAY_4, RELAY_3_4_OFF);

  Serial.println("ARDUINO_READY");
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    command.toUpperCase();

    // ─── Protocol Decoding ───────────────────────────────────────────
    if (command == "R1_ON") {
      digitalWrite(RELAY_1, RELAY_1_2_ON);
      Serial.println("ACK:R1_ON_OK");
    }
    else if (command == "R1_OFF") {
      digitalWrite(RELAY_1, RELAY_1_2_OFF);
      Serial.println("ACK:R1_OFF_OK");
    }
    else if (command == "R2_ON") {
      digitalWrite(RELAY_2, RELAY_1_2_ON);
      Serial.println("ACK:R2_ON_OK");
    }
    else if (command == "R2_OFF") {
      digitalWrite(RELAY_2, RELAY_1_2_OFF);
      Serial.println("ACK:R2_OFF_OK");
    }
    else if (command == "R3_ON") {
      digitalWrite(RELAY_3, RELAY_3_4_ON);
      Serial.println("ACK:R3_ON_OK");
    }
    else if (command == "R3_OFF") {
      digitalWrite(RELAY_3, RELAY_3_4_OFF);
      Serial.println("ACK:R3_OFF_OK");
    }
    else if (command == "R4_ON") {
      digitalWrite(RELAY_4, RELAY_3_4_ON);
      Serial.println("ACK:R4_ON_OK");
    }
    else if (command == "R4_OFF") {
      digitalWrite(RELAY_4, RELAY_3_4_OFF);
      Serial.println("ACK:R4_OFF_OK");
    }
    else if (command == "ALL_OFF") {
      digitalWrite(RELAY_1, RELAY_1_2_OFF);
      digitalWrite(RELAY_2, RELAY_1_2_OFF);
      digitalWrite(RELAY_3, RELAY_3_4_OFF);
      digitalWrite(RELAY_4, RELAY_3_4_OFF);
      Serial.println("ACK:ALL_OFF_OK");
    }
    else if (command == "ALL_ON") {
      digitalWrite(RELAY_1, RELAY_1_2_ON);
      digitalWrite(RELAY_2, RELAY_1_2_ON);
      digitalWrite(RELAY_3, RELAY_3_4_ON);
      digitalWrite(RELAY_4, RELAY_3_4_ON);
      Serial.println("ACK:ALL_ON_OK");
    }
    else {
      Serial.println("ERR:UNKNOWN_CMD");
    }
  }
}`;
