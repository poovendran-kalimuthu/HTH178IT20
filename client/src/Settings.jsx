/* Hallmark · macrostructure: Workbench · genre: modern-minimal · theme: Cobalt
 * nav: N3 side-rail · footer: none (settings shell)
 * audience: energy system operators · use: configure peak-shaving platform · tone: utilitarian
 * fonts: DM Sans (body) + Space Grotesk (display)
 * P5 H5 E5 S5 R4 V5
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Plug, Activity, ScrollText, Bell, Zap, ChevronRight, Save, RotateCcw,
  AlertTriangle, Wifi, Terminal, Clock, Download, Trash2,
  Mail, MessageSquare, Webhook, BarChart2, TrendingUp, RefreshCw,
  Eye, EyeOff, Copy, Check, Server, Database, Power, Cpu,
  Search, ArrowLeft, ArrowRight, ChevronDown, Plus, SlidersHorizontal, Filter,
  Settings as SettingsIcon, User, CheckCircle2, Code
} from 'lucide-react';
import { useEsp32 } from './useEsp32.js';
import './Settings.css';

const ESP32_FIRMWARE_CODE = `/*
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

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'port',          label: 'Port configuration',    icon: Plug,       badge: null,     hasDot: false, desc: 'Configure Relays & Sensor ports' },
  { id: 'status',        label: 'Status',                icon: Activity,   badge: 'OK',     hasDot: false, desc: 'Live ESP32 telemetry & health'    },
  { id: 'logs',          label: 'logs',                  icon: ScrollText, badge: null,      hasDot: false,  desc: 'System event log viewer'        },
  { id: 'notifications', label: 'Notification Settings', icon: Bell,       badge: null,     hasDot: false,  desc: 'Alert channels & triggers'      },
  { id: 'peak',          label: 'Peak configuration',    icon: Zap,        badge: null, hasDot: false, desc: 'Demand shaving thresholds'      },
];

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_LOGS = [];

const STATUS_SERVICES = [
  { id: 'modbus', label: 'Modbus RTU Bridge',   status: 'online',   uptime: '4h 12m', latency: '3 ms',   port: 'COM3'    },
  { id: 'bess',   label: 'BESS Controller',      status: 'online',   uptime: '4h 12m', latency: '8 ms',   port: 'TCP:502' },
  { id: 'grid',   label: 'Grid Meter Interface', status: 'online',   uptime: '4h 10m', latency: '5 ms',   port: 'TCP:503' },
  { id: 'mqtt',   label: 'MQTT Broker',          status: 'degraded', uptime: '2h 08m', latency: '210 ms', port: '1883'    },
  { id: 'db',     label: 'Time-series Database', status: 'online',   uptime: '4h 12m', latency: '1 ms',   port: '5432'    },
  { id: 'notif',  label: 'Notification Service', status: 'offline',  uptime: '—',      latency: '—',      port: '—'       },
];

// ─── Shared primitives ────────────────────────────────────────────────────────
function useClipboard(timeout = 1800) {
  const [copied, setCopied] = useState(false);
  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    });
  };
  return [copied, copy];
}

function ToggleSwitch({ checked, onChange, id }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`stg-toggle ${checked ? 'stg-toggle--on' : ''}`}
      type="button"
    >
      <span className="stg-toggle__thumb" />
    </button>
  );
}

function Badge({ status }) {
  const map = {
    online:   { cls: 'badge--online',   label: 'Online'   },
    offline:  { cls: 'badge--offline',  label: 'Offline'  },
    degraded: { cls: 'badge--degraded', label: 'Degraded' },
  };
  const { cls, label } = map[status] ?? map.offline;
  return (
    <span className={`stg-badge ${cls}`}>
      <span className="badge-dot" />{label}
    </span>
  );
}

function LogLine({ entry }) {
  return (
    <div className={`stg-log-line log-level-row--${entry.level.toLowerCase()}`}>
      <span className="log-ts">{entry.ts}</span>
      <span className={`log-chip log-chip--${entry.level.toLowerCase()}`}>{entry.level}</span>
      <span className="log-src">{entry.src}</span>
      <span className="log-msg">{entry.msg}</span>
    </div>
  );
}

// ─── Tab 1: Port Configuration ────────────────────────────────────────────────
function PortConfigTab() {
  const [protocol, setProtocol]   = useState('modbus-rtu');
  const [port, setPort]           = useState('COM3');
  const [baud, setBaud]           = useState('9600');
  const [dataBits, setDataBits]   = useState('8');
  const [parity, setParity]       = useState('none');
  const [stopBits, setStopBits]   = useState('1');
  const [tcpHost, setTcpHost]     = useState('10.38.24.77');
  const [tcpPort, setTcpPort]     = useState('502');
  const [slaveId, setSlaveId]     = useState('1');
  const [timeout, setTimeoutVal]  = useState('3000');
  const [retries, setRetries]     = useState('3');
  const [saved, setSaved]         = useState(false);
  const [showKey, setShowKey]     = useState(false);
  const [apiKey]                  = useState('pk_live_kpr_09f3c1da8a7e4b2f');
  const [keyCopied, copyKey]      = useClipboard();

  const isRTU = protocol === 'modbus-rtu';

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form className="stg-form" onSubmit={handleSave} id="port-config-form">
      <div className="stg-section-head">
        <div className="stg-section-icon"><Plug size={16} /></div>
        <div>
          <h2 className="stg-section-title">Port Configuration</h2>
          <p className="stg-section-desc">Configure the communication interface for energy meter and BESS integration.</p>
        </div>
      </div>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Protocol</legend>
        <div className="stg-protocol-grid">
          {[
            { id: 'modbus-rtu', label: 'Modbus RTU', icon: Cpu,      desc: 'Serial RS-485 / RS-232' },
            { id: 'modbus-tcp', label: 'Modbus TCP', icon: Wifi,     desc: 'Ethernet / IP network'  },
            { id: 'bacnet',     label: 'BACnet IP',  icon: Database, desc: 'Building automation'     },
            { id: 'dnp3',       label: 'DNP3',       icon: Server,   desc: 'Utility SCADA protocol'  },
          ].map(p => (
            <label key={p.id} htmlFor={`proto-${p.id}`}
              className={`stg-proto-card ${protocol === p.id ? 'stg-proto-card--active' : ''}`}>
              <input type="radio" id={`proto-${p.id}`} name="protocol" value={p.id}
                checked={protocol === p.id} onChange={() => setProtocol(p.id)} className="sr-only" />
              <p.icon size={20} className="proto-icon" />
              <span className="proto-label">{p.label}</span>
              <span className="proto-desc">{p.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {isRTU && (
        <fieldset className="stg-fieldset">
          <legend className="stg-legend">Serial Interface</legend>
          <div className="stg-grid-2">
            <div className="stg-field">
              <label htmlFor="serial-port" className="stg-label">Port</label>
              <input id="serial-port" type="text" className="stg-input" value={port}
                onChange={e => setPort(e.target.value)} placeholder="COM3 or /dev/ttyUSB0" />
            </div>
            <div className="stg-field">
              <label htmlFor="baud-rate" className="stg-label">Baud Rate</label>
              <select id="baud-rate" className="stg-select" value={baud} onChange={e => setBaud(e.target.value)}>
                {['1200','2400','4800','9600','19200','38400','57600','115200'].map(b =>
                  <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="stg-field">
              <label htmlFor="data-bits" className="stg-label">Data Bits</label>
              <select id="data-bits" className="stg-select" value={dataBits} onChange={e => setDataBits(e.target.value)}>
                {['7','8'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="stg-field">
              <label htmlFor="parity" className="stg-label">Parity</label>
              <select id="parity" className="stg-select" value={parity} onChange={e => setParity(e.target.value)}>
                {['none','even','odd'].map(p =>
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="stg-field">
              <label htmlFor="stop-bits" className="stg-label">Stop Bits</label>
              <select id="stop-bits" className="stg-select" value={stopBits} onChange={e => setStopBits(e.target.value)}>
                {['1','2'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {!isRTU && (
        <fieldset className="stg-fieldset">
          <legend className="stg-legend">Network Interface</legend>
          <div className="stg-grid-2">
            <div className="stg-field stg-field--span2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="tcp-host" className="stg-label">Host / IP Address</label>
                <button
                  type="button"
                  onClick={() => setTcpHost('10.38.24.77')}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-accent)',
                    cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600, padding: 0
                  }}
                  title="Apply connected ESP32 Wi-Fi IP"
                >
                  Use Connected ESP32 (10.38.24.77)
                </button>
              </div>
              <input id="tcp-host" type="text" className="stg-input" value={tcpHost}
                onChange={e => setTcpHost(e.target.value)} placeholder="10.38.24.77" />
            </div>
            <div className="stg-field">
              <label htmlFor="tcp-port" className="stg-label">Port</label>
              <input id="tcp-port" type="number" className="stg-input" value={tcpPort}
                onChange={e => setTcpPort(e.target.value)} min="1" max="65535" />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Device Parameters</legend>
        <div className="stg-grid-3">
          <div className="stg-field">
            <label htmlFor="slave-id" className="stg-label">Slave / Unit ID</label>
            <input id="slave-id" type="number" className="stg-input" value={slaveId}
              onChange={e => setSlaveId(e.target.value)} min="1" max="247" />
          </div>
          <div className="stg-field">
            <label htmlFor="timeout" className="stg-label">Timeout (ms)</label>
            <input id="timeout" type="number" className="stg-input" value={timeout}
              onChange={e => setTimeoutVal(e.target.value)} min="100" step="100" />
          </div>
          <div className="stg-field">
            <label htmlFor="retries" className="stg-label">Retry Attempts</label>
            <input id="retries" type="number" className="stg-input" value={retries}
              onChange={e => setRetries(e.target.value)} min="0" max="10" />
          </div>
        </div>
      </fieldset>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">API Access Key</legend>
        <div className="stg-field">
          <label htmlFor="api-key" className="stg-label">Platform API Key</label>
          <div className="stg-input-group">
            <input id="api-key" type={showKey ? 'text' : 'password'}
              className="stg-input stg-input--mono" value={apiKey} readOnly />
            <button type="button" className="stg-input-addon"
              onClick={() => setShowKey(v => !v)} title={showKey ? 'Hide' : 'Show'}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button type="button" className="stg-input-addon"
              onClick={() => copyKey(apiKey)} title="Copy">
              {keyCopied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      </fieldset>

      <div className="stg-actions">
        <button type="button" className="stg-btn stg-btn--ghost" id="port-reset-btn">
          <RotateCcw size={15} /> Reset to Defaults
        </button>
        <button type="submit" className={`stg-btn stg-btn--primary ${saved ? 'stg-btn--saved' : ''}`} id="port-save-btn">
          {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save Configuration</>}
        </button>
      </div>
    </form>
  );
}

// ─── Tab 2: Status ────────────────────────────────────────────────────────────
function StatusTab() {
  const { esp32 } = useEsp32();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('21:35:00');

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastRefresh(new Date().toTimeString().slice(0, 8));
    }, 1200);
  };

  const services = [
    {
      id: 'esp32',
      label: 'ESP32 Telemetry Gateway',
      status: esp32.connected ? 'online' : 'degraded',
      uptime: esp32.connected ? 'Streaming' : 'Standby',
      latency: `${esp32.latencyMs || 4} ms`,
      port: 'WS:5000 (10.38.24.77)'
    },
    ...STATUS_SERVICES
  ];

  const online = services.filter(s => s.status === 'online').length;
  const total  = services.length;
  const health = Math.round((online / total) * 100);

  return (
    <div className="stg-pane" id="status-pane">
      <div className="stg-section-head">
        <div className="stg-section-icon"><Activity size={16} /></div>
        <div>
          <h2 className="stg-section-title">System Status</h2>
          <p className="stg-section-desc">Live health of all platform services, communication interfaces, and edge nodes.</p>
        </div>
        <button
          className={`stg-btn stg-btn--ghost stg-btn--sm ml-auto ${refreshing ? 'stg-btn--spinning' : ''}`}
          onClick={handleRefresh} id="status-refresh-btn" type="button">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="stg-health-block">
        <div className="stg-health-score-row">
          <span className={`stg-health-num ${health === 100 ? 'health--green' : health > 60 ? 'health--amber' : 'health--red'}`}>
            {health}%
          </span>
          <span className="stg-health-label">System Health · {online}/{total} services online</span>
        </div>
        <div className="stg-bar-track">
          <div className={`stg-bar-fill ${health === 100 ? 'bar--green' : health > 60 ? 'bar--amber' : 'bar--red'}`}
            style={{ width: `${health}%` }} />
        </div>
        <p className="stg-health-ts">Last refreshed at {lastRefresh}</p>
      </div>

      <div className="stg-service-table" role="table" aria-label="Service status">
        <div className="stg-service-thead" role="row">
          <span role="columnheader">Service</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Port</span>
          <span role="columnheader">Uptime</span>
          <span role="columnheader">Latency</span>
        </div>
        {services.map(svc => (
          <div key={svc.id} className={`stg-service-row status-row--${svc.status}`} role="row">
            <span className="svc-name" role="cell">
              {svc.status === 'online'   && <Power size={13} className="svc-icon svc-icon--on" />}
              {svc.status === 'offline'  && <Power size={13} className="svc-icon svc-icon--off" />}
              {svc.status === 'degraded' && <AlertTriangle size={13} className="svc-icon svc-icon--warn" />}
              {svc.label}
            </span>
            <span role="cell"><Badge status={svc.status} /></span>
            <span className="svc-mono" role="cell">{svc.port}</span>
            <span className="svc-mono" role="cell">{svc.uptime}</span>
            <span className="svc-mono" role="cell">{svc.latency}</span>
          </div>
        ))}
      </div>

      <div className="stg-kpi-grid">
        {[
          { label: 'Active Connections', val: esp32.connected ? '5' : '4',       icon: Wifi,          color: 'cyan'    },
          { label: 'ESP32 Packets RX',   val: String(esp32.packetsReceived || 0), icon: Activity,      color: 'indigo'  },
          { label: 'Avg Response Time',  val: `${esp32.latencyMs || 4} ms`,      icon: Clock,         color: 'emerald' },
          { label: 'Errors (last 1h)',   val: '0',                                icon: AlertTriangle, color: 'amber'   },
        ].map(k => (
          <div key={k.label} className={`stg-kpi-tile kpi--${k.color}`}>
            <k.icon size={18} className="kpi-icon" />
            <span className="kpi-val">{k.val}</span>
            <span className="kpi-label">{k.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: ESP32 Telemetry & Gateway ──────────────────────────────────────────
export function Esp32Tab() {
  const { esp32, wsConnected, pingDevice, sendCommand } = useEsp32();
  const [pingStatus, setPingStatus] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, copyCode] = useClipboard();

  const handlePing = async () => {
    setPingStatus('Pinging ESP32 (10.38.24.77)...');
    const start = Date.now();
    await pingDevice();
    const rtt = Date.now() - start;
    setTimeout(() => {
      setPingStatus(`Ping ACK received · ${rtt} ms round-trip`);
      setTimeout(() => setPingStatus(null), 3500);
    }, 200);
  };

  const handleSimulate = () => {
    sendCommand('telemetry', {
      type: 'telemetry',
      voltage: 231.2 + (Math.random() * 2 - 1),
      current1: 13.8 + (Math.random() * 2 - 1),
      current2: 8.5 + (Math.random() * 1.5 - 0.75),
      current3: 15.2 + (Math.random() * 2.5 - 1.25),
      current4: 5.1 + (Math.random() * 0.8 - 0.4),
      power: 3.19 + (Math.random() * 0.4 - 0.2),
      frequency: 50.01 + (Math.random() * 0.04 - 0.02),
      soc: 83.5,
      temperature: 33.1 + (Math.random() * 0.5),
      ir_sensor: Math.random() > 0.5 ? 1 : 0,
      relay1: esp32.latestTelemetry?.relay1 || false,
      relay2: esp32.latestTelemetry?.relay2 || false,
      relay3: esp32.latestTelemetry?.relay3 || false,
      relay4: esp32.latestTelemetry?.relay4 || false,
    });
  };

  const t = esp32.latestTelemetry || {};
  const isOnline = esp32.connected;

  return (
    <div className="stg-pane" id="esp32-pane">
      <div className="stg-section-head">
        <div className="stg-section-icon"><Cpu size={16} /></div>
        <div>
          <h2 className="stg-section-title">ESP32 Edge Device Telemetry</h2>
          <p className="stg-section-desc">
            Bidirectional real-time WebSocket connection to ESP32 node at <code>10.38.24.77</code>.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="stg-btn stg-btn--ghost stg-btn--sm"
            onClick={handleSimulate}
            title="Inject simulated reading to test stream"
          >
            <Activity size={14} /> Send Test Packet
          </button>
          <button
            type="button"
            className="stg-btn stg-btn--ghost stg-btn--sm"
            onClick={handlePing}
          >
            <Terminal size={14} /> Ping Node
          </button>
          <button
            type="button"
            className={`stg-btn stg-btn--sm ${showCode ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
            onClick={() => setShowCode(v => !v)}
          >
            <Code size={14} /> {showCode ? 'Hide Firmware' : 'View Arduino Code'}
          </button>
        </div>
      </div>

      {pingStatus && (
        <div className="stg-banner-info" style={{
          marginBottom: '1.25rem', padding: '0.65rem 1rem', borderRadius: '8px',
          background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.25)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#059669'
        }}>
          <CheckCircle2 size={16} />
          <span>{pingStatus}</span>
        </div>
      )}

      {/* Hero Status Card */}
      <div className="esp32-hero-card">
        <div className="esp32-hero-top">
          <div className="esp32-node-info">
            <div className={`esp32-status-pill ${isOnline ? 'pill--online' : 'pill--standby'}`}>
              <span className="badge-dot" />
              {isOnline ? 'Online · Live Streaming' : 'Standby · Ready to Connect'}
            </div>
            <span className="esp32-ip-text">IP: <strong>10.38.24.77</strong></span>
            <span className="esp32-server-target">Backend Target: <code>ws://10.38.24.64:5000/ws</code></span>
          </div>

          <div className="esp32-stats-chips">
            <div className="esp32-chip">
              <span className="chip-label">Packets RX</span>
              <span className="chip-val">{esp32.packetsReceived || 0}</span>
            </div>
            <div className="esp32-chip">
              <span className="chip-label">Latency</span>
              <span className="chip-val">{esp32.latencyMs || 4} ms</span>
            </div>
            <div className="esp32-chip">
              <span className="chip-label">Browser WS</span>
              <span className="chip-val" style={{ color: wsConnected ? 'var(--color-online)' : 'var(--color-warn)' }}>
                {wsConnected ? 'Connected' : 'Reconnecting'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Metrics Grid */}
      <div className="esp32-metrics-grid">
        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Power</span>
            <Zap size={16} color="#3b82f6" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.power !== undefined ? Number(t.power).toFixed(2) : '0.00'}</span>
            <span className="metric-unit">kW</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((t.power || 0) / 10) * 100)}%`, background: '#3b82f6' }} />
          </div>
          <span className="metric-hint">Instantaneous real-time load</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Grid Voltage</span>
            <Activity size={16} color="#06b6d4" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.voltage !== undefined ? Number(t.voltage).toFixed(1) : '230.0'}</span>
            <span className="metric-unit">V AC</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, (((t.voltage || 230) - 200) / 50) * 100)}%`, background: '#06b6d4' }} />
          </div>
          <span className="metric-hint">Nominal 230V ±10%</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Current (CT1)</span>
            <Cpu size={16} color="#8b5cf6" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.current1 !== undefined ? Number(t.current1).toFixed(2) : '0.00'}</span>
            <span className="metric-unit">A</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((t.current1 || 0) / 32) * 100)}%`, background: '#8b5cf6' }} />
          </div>
          <span className="metric-hint">Phase 1 RMS Current</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Current (CT2)</span>
            <Cpu size={16} color="#8b5cf6" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.current2 !== undefined ? Number(t.current2).toFixed(2) : '0.00'}</span>
            <span className="metric-unit">A</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((t.current2 || 0) / 32) * 100)}%`, background: '#8b5cf6' }} />
          </div>
          <span className="metric-hint">Phase 2 RMS Current</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Current (CT3)</span>
            <Cpu size={16} color="#8b5cf6" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.current3 !== undefined ? Number(t.current3).toFixed(2) : '0.00'}</span>
            <span className="metric-unit">A</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((t.current3 || 0) / 32) * 100)}%`, background: '#8b5cf6' }} />
          </div>
          <span className="metric-hint">Phase 3 RMS Current</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Current (CT4)</span>
            <Cpu size={16} color="#8b5cf6" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.current4 !== undefined ? Number(t.current4).toFixed(2) : '0.00'}</span>
            <span className="metric-unit">A</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((t.current4 || 0) / 32) * 100)}%`, background: '#8b5cf6' }} />
          </div>
          <span className="metric-hint">Neutral RMS Current</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Battery SoC</span>
            <Database size={16} color="#10b981" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.soc !== undefined ? Number(t.soc).toFixed(1) : '85.0'}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, t.soc || 85)}%`, background: '#10b981' }} />
          </div>
          <span className="metric-hint">BESS Storage Reserve</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">Frequency</span>
            <Clock size={16} color="#f59e0b" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.frequency !== undefined ? Number(t.frequency).toFixed(2) : '50.00'}</span>
            <span className="metric-unit">Hz</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: '50%', background: '#f59e0b' }} />
          </div>
          <span className="metric-hint">Grid sync nominal 50.0 Hz</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">ESP32 Temp</span>
            <Power size={16} color="#ec4899" />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number">{t.temperature !== undefined ? Number(t.temperature).toFixed(1) : '32.0'}</span>
            <span className="metric-unit">°C</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((t.temperature || 30) / 80) * 100)}%`, background: '#ec4899' }} />
          </div>
          <span className="metric-hint">ESP32 Core Thermals (Normal)</span>
        </div>

        <div className="esp32-metric-card">
          <div className="metric-header">
            <span className="metric-title">IR Sensor</span>
            <Eye size={16} color={t.ir_sensor === 0 ? '#ef4444' : '#64748b'} />
          </div>
          <div className="metric-number-wrap">
            <span className="metric-number" style={{ fontSize: '1.4rem' }}>{t.ir_sensor === 0 ? 'DETECTED' : 'CLEAR'}</span>
          </div>
          <div className="metric-bar-wrap">
            <div className="metric-bar-fill" style={{ width: t.ir_sensor === 0 ? '100%' : '0%', background: '#ef4444' }} />
          </div>
          <span className="metric-hint">Object proximity detection</span>
        </div>
      </div>

      {/* Arduino Firmware Viewer (collapsible) */}
      {showCode && (
        <div className="esp32-code-box">
          <div className="esp32-code-header">
            <div className="code-header-title">
              <Code size={15} />
              <span>Arduino IDE Firmware (esp32_firmware.ino)</span>
            </div>
            <button
              type="button"
              className="stg-btn stg-btn--ghost stg-btn--sm"
              onClick={() => copyCode(ESP32_FIRMWARE_CODE)}
            >
              {codeCopied ? <Check size={14} /> : <Copy size={14} />}
              {codeCopied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <div className="esp32-code-guide">
            <strong>Setup Guide:</strong>
            <ol>
              <li>Open Arduino IDE &rarr; <em>Tools &rarr; Manage Libraries</em>.</li>
              <li>Install <strong>WebSockets</strong> (by Markus Sattler) and <strong>ArduinoJson</strong> (by Benoit Blanchon).</li>
              <li>Set your Wi-Fi SSID and password in the sketch. The server target is pre-configured to <code>10.38.24.64:5000</code>.</li>
              <li>Select your ESP32 board and COM port, then click <strong>Upload</strong>.</li>
            </ol>
          </div>
          <pre className="esp32-code-pre">
            <code>{ESP32_FIRMWARE_CODE}</code>
          </pre>
        </div>
      )}

      {/* Live Packet Terminal */}
      <div className="esp32-terminal-box">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="dot dot-red" />
            <span className="dot dot-amber" />
            <span className="dot dot-green" />
          </div>
          <span className="terminal-title">Live WebSocket Frame Stream · ws://10.38.24.64:5000/ws</span>
          <span className="terminal-badge">{isOnline ? 'FEED ACTIVE' : 'LISTENING'}</span>
        </div>
        <div className="terminal-body">
          <div className="terminal-line comment">// WebSocket connection established with backend router</div>
          <div className="terminal-line comment">// Target ESP32 Client IP: 10.38.24.77 · Listening for frames...</div>
          {(esp32.history && esp32.history.length > 0 ? esp32.history : [t]).map((item, idx) => (
            <div key={idx} className="terminal-line frame">
              <span className="term-ts">[{new Date(item.timestamp || Date.now()).toLocaleTimeString()}]</span>
              <span className="term-key"> RX </span>
              <span className="term-json">{JSON.stringify(item)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Logs ──────────────────────────────────────────────────────────────
function LogsTab() {
  const [logs, setLogs]       = useState(MOCK_LOGS);
  const [filter, setFilter]   = useState('ALL');
  const [search, setSearch]   = useState('');
  const [autoScroll, setAuto] = useState(true);
  const bottomRef             = useRef(null);

  const filtered = logs.filter(l => {
    const matchLevel  = filter === 'ALL' || l.level === filter;
    const matchSearch = !search ||
      l.msg.toLowerCase().includes(search.toLowerCase()) ||
      l.src.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  useEffect(() => {
    if (autoScroll && bottomRef.current)
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [filtered, autoScroll]);

  return (
    <div className="stg-pane" id="logs-pane">
      <div className="stg-section-head">
        <div className="stg-section-icon"><ScrollText size={16} /></div>
        <div>
          <h2 className="stg-section-title">System Logs</h2>
          <p className="stg-section-desc">Real-time event stream from all platform services.</p>
        </div>
      </div>

      <div className="stg-log-toolbar">
        <div className="stg-log-filters">
          {['ALL','INFO','WARN','ERROR'].map(lvl => (
            <button key={lvl} type="button"
              onClick={() => setFilter(lvl)}
              className={`stg-filter-btn filter--${lvl.toLowerCase()} ${filter === lvl ? 'active' : ''}`}
              id={`log-filter-${lvl.toLowerCase()}`}>
              {lvl}
            </button>
          ))}
        </div>
        <div className="stg-log-search-wrap">
          <Terminal size={13} className="log-search-icon" />
          <input type="search" className="stg-log-search" placeholder="Search logs…"
            value={search} onChange={e => setSearch(e.target.value)} id="log-search-input" />
        </div>
        <div className="stg-log-controls">
          <label className="stg-inline-label" htmlFor="auto-scroll-toggle">
            <ToggleSwitch id="auto-scroll-toggle" checked={autoScroll} onChange={setAuto} />
            <span>Auto-scroll</span>
          </label>
          <button type="button" className="stg-btn stg-btn--ghost stg-btn--sm" id="log-download-btn">
            <Download size={14} /> Export
          </button>
          <button type="button" className="stg-btn stg-btn--danger stg-btn--sm"
            onClick={() => setLogs([])} id="log-clear-btn">
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      <div className="stg-log-viewer" id="log-viewer" aria-live="polite">
        {filtered.length === 0 ? (
          <div className="stg-log-empty">
            <ScrollText size={28} />
            <p>No log entries match the current filter.</p>
          </div>
        ) : filtered.map(entry => <LogLine key={entry.id} entry={entry} />)}
        <div ref={bottomRef} />
      </div>
      <p className="stg-log-count">{filtered.length} of {logs.length} entries displayed</p>
    </div>
  );
}

// ─── Tab 4: Notification Settings ────────────────────────────────────────────
function NotificationsTab() {
  const [emailEnabled,   setEmail]   = useState(true);
  const [smsEnabled,     setSms]     = useState(false);
  const [webhookEnabled, setWebhook] = useState(true);
  const [slackEnabled,   setSlack]   = useState(false);
  const [emailAddr, setEmailAddr]    = useState('ops-team@kpr.in');
  const [webhookUrl, setWebhookUrl]  = useState('https://hooks.kpr.in/peak-events');
  const [slackChan, setSlackChan]    = useState('#alerts');
  const [severity, setSeverity]      = useState('warning');
  const [saved, setSaved]            = useState(false);

  const [triggers, setTriggers] = useState({
    peakExceeded:     true,
    connectionLost:   true,
    batteryLow:       true,
    dailyReport:      false,
    firmwareUpdate:   false,
    scheduleComplete: true,
  });

  const TRIGGER_DEFS = [
    { key: 'peakExceeded',     label: 'Peak demand exceeded',     desc: 'Fires when demand breaches the configured kW threshold.' },
    { key: 'connectionLost',   label: 'Device connection lost',    desc: 'Fires when a monitored port goes offline.' },
    { key: 'batteryLow',       label: 'BESS state-of-charge low',  desc: 'Fires when SoC drops below the configured floor.' },
    { key: 'dailyReport',      label: 'Daily summary report',      desc: 'Dispatched at 06:00 each day with previous-day metrics.' },
    { key: 'firmwareUpdate',   label: 'Firmware update available', desc: 'Fires when a device reports a newer firmware version.' },
    { key: 'scheduleComplete', label: 'Peak schedule completed',   desc: 'Fires at the end of each managed peak window.' },
  ];

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const CHANNELS = [
    { id: 'email',   label: 'Email',   icon: Mail,           enabled: emailEnabled,   setEnabled: setEmail,   field: { id: 'email-addr',   type: 'email', val: emailAddr,   setVal: setEmailAddr,   ph: 'team@example.com'  } },
    { id: 'sms',     label: 'SMS',     icon: MessageSquare,  enabled: smsEnabled,     setEnabled: setSms,     field: { id: 'sms-num',      type: 'tel',   val: '',          setVal: () => {},        ph: '+91 98765 43210'   } },
    { id: 'webhook', label: 'Webhook', icon: Webhook,        enabled: webhookEnabled, setEnabled: setWebhook, field: { id: 'webhook-url',  type: 'url',   val: webhookUrl,  setVal: setWebhookUrl,  ph: 'https://…'         } },
    { id: 'slack',   label: 'Slack',   icon: MessageSquare,  enabled: slackEnabled,   setEnabled: setSlack,   field: { id: 'slack-chan',   type: 'text',  val: slackChan,   setVal: setSlackChan,   ph: '#alerts'           } },
  ];

  return (
    <form className="stg-form" onSubmit={handleSave} id="notif-form">
      <div className="stg-section-head">
        <div className="stg-section-icon"><Bell size={16} /></div>
        <div>
          <h2 className="stg-section-title">Notification Settings</h2>
          <p className="stg-section-desc">Configure alert channels and define which events trigger notifications.</p>
        </div>
      </div>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Alert Channels</legend>
        <div className="stg-channel-list">
          {CHANNELS.map(ch => (
            <div key={ch.id} className={`stg-channel-card ${ch.enabled ? 'stg-channel-card--on' : ''}`} id={`channel-${ch.id}`}>
              <div className="channel-header">
                <ch.icon size={16} className="channel-icon" />
                <span className="channel-name">{ch.label}</span>
                <ToggleSwitch id={`${ch.id}-toggle`} checked={ch.enabled} onChange={ch.setEnabled} />
              </div>
              {ch.enabled && (
                <div className="channel-body">
                  <label htmlFor={ch.field.id} className="stg-label">{ch.label === 'Email' ? 'Recipient Address' : ch.label === 'SMS' ? 'Phone Number' : ch.label === 'Webhook' ? 'Endpoint URL' : 'Channel'}</label>
                  <input id={ch.field.id} type={ch.field.type} className="stg-input"
                    value={ch.field.val} onChange={e => ch.field.setVal(e.target.value)}
                    placeholder={ch.field.ph} />
                </div>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Minimum Severity</legend>
        <div className="stg-severity-grid">
          {[
            { val: 'info',    label: 'Info',    desc: 'All events'         },
            { val: 'warning', label: 'Warning', desc: 'Warnings + errors'  },
            { val: 'error',   label: 'Error',   desc: 'Critical only'      },
          ].map(s => (
            <label key={s.val} htmlFor={`sev-${s.val}`}
              className={`stg-sev-card ${severity === s.val ? `stg-sev-card--${s.val}` : ''}`}>
              <input type="radio" id={`sev-${s.val}`} name="severity" value={s.val}
                checked={severity === s.val} onChange={() => setSeverity(s.val)} className="sr-only" />
              <span className="sev-label">{s.label}</span>
              <span className="sev-desc">{s.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Trigger Events</legend>
        <div className="stg-trigger-list">
          {TRIGGER_DEFS.map(t => (
            <div key={t.key} className="stg-trigger-row" id={`trigger-${t.key}`}>
              <div className="trigger-info">
                <span className="trigger-label">{t.label}</span>
                <span className="trigger-desc">{t.desc}</span>
              </div>
              <ToggleSwitch id={`trigger-toggle-${t.key}`}
                checked={triggers[t.key]}
                onChange={() => setTriggers(tr => ({ ...tr, [t.key]: !tr[t.key] }))} />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="stg-actions">
        <button type="button" className="stg-btn stg-btn--ghost" id="notif-test-btn">
          <Bell size={15} /> Send Test Alert
        </button>
        <button type="submit" className={`stg-btn stg-btn--primary ${saved ? 'stg-btn--saved' : ''}`} id="notif-save-btn">
          {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save Settings</>}
        </button>
      </div>
    </form>
  );
}

// ─── Tab 5: Peak Configuration ────────────────────────────────────────────────
function PeakConfigTab() {
  const [peakThreshold,  setPeakThreshold]  = useState(450);
  const [warningPct,     setWarningPct]     = useState(85);
  const [rampRate,       setRampRate]       = useState(25);
  const [minSoC,         setMinSoC]         = useState(20);
  const [windowStart,    setWindowStart]    = useState('09:00');
  const [windowEnd,      setWindowEnd]      = useState('22:00');
  const [strategy,       setStrategy]       = useState('load-shed');
  const [contractDemand, setContractDemand] = useState(500);
  const [tariffPeriod,   setTariffPeriod]   = useState('tod');
  const [saved,          setSaved]          = useState(false);

  const warningKW     = Math.round(contractDemand * warningPct / 100);
  const shavingTarget = contractDemand - peakThreshold;
  const threshPct     = Math.round((peakThreshold / contractDemand) * 100);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form className="stg-form" onSubmit={handleSave} id="peak-config-form">
      <div className="stg-section-head">
        <div className="stg-section-icon"><Zap size={16} /></div>
        <div>
          <h2 className="stg-section-title">Peak Configuration</h2>
          <p className="stg-section-desc">Define demand thresholds, shaving strategies, and tariff window parameters.</p>
        </div>
      </div>

      {/* Demand visualisation */}
      <div className="stg-peak-preview" aria-label="Demand threshold visualisation">
        <div className="peak-preview-header">
          <span className="peak-preview-label">Demand Visualisation</span>
          <span className="peak-preview-legend">
            <span className="pk-legend pk-legend--warn">⚑ {warningKW} kW warning</span>
            <span className="pk-legend pk-legend--thresh">✕ {peakThreshold} kW threshold</span>
            <span className="pk-legend pk-legend--contract">↑ {contractDemand} kW contract</span>
          </span>
        </div>
        <div className="peak-bar-track">
          <div className="peak-bar-warn"   style={{ width: `${warningPct}%` }} />
          <div className="peak-bar-thresh" style={{ width: `${threshPct}%` }} />
          <div className="peak-bar-marker peak-bar-marker--warn"   style={{ left: `${warningPct}%` }}>{warningPct}%</div>
          <div className="peak-bar-marker peak-bar-marker--thresh" style={{ left: `${threshPct}%` }}>{threshPct}%</div>
        </div>
        <p className="peak-preview-stat">Shaving target: <strong>{shavingTarget} kW</strong> below contract demand</p>
      </div>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Demand Limits</legend>
        <div className="stg-grid-2">
          <div className="stg-field">
            <label htmlFor="contract-demand" className="stg-label">Contract Demand</label>
            <div className="stg-input-unit">
              <input id="contract-demand" type="number" className="stg-input" value={contractDemand}
                onChange={e => setContractDemand(Number(e.target.value))} min="0" step="10" />
              <span className="input-unit">kW</span>
            </div>
            <p className="stg-hint">Sanctioned demand from the utility.</p>
          </div>
          <div className="stg-field">
            <label htmlFor="peak-threshold" className="stg-label">Peak Shaving Threshold</label>
            <div className="stg-input-unit">
              <input id="peak-threshold" type="number" className="stg-input" value={peakThreshold}
                onChange={e => setPeakThreshold(Number(e.target.value))} min="0" step="10" max={contractDemand} />
              <span className="input-unit">kW</span>
            </div>
            <p className="stg-hint">Algorithm triggers when demand exceeds this value.</p>
          </div>
          <div className="stg-field">
            <label htmlFor="warning-pct" className="stg-label">Warning Level — {warningPct}% · {warningKW} kW</label>
            <input id="warning-pct" type="range" className="stg-slider" value={warningPct}
              onChange={e => setWarningPct(Number(e.target.value))} min="50" max="99" step="1" />
            <p className="stg-hint">Early alert before threshold is reached.</p>
          </div>
          <div className="stg-field">
            <label htmlFor="ramp-rate" className="stg-label">Load Ramp Rate — {rampRate} kW/min</label>
            <input id="ramp-rate" type="range" className="stg-slider" value={rampRate}
              onChange={e => setRampRate(Number(e.target.value))} min="5" max="100" step="5" />
            <p className="stg-hint">Maximum rate of load change during shaving.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Shaving Strategy</legend>
        <div className="stg-strategy-grid">
          {[
            { id: 'load-shed',   label: 'Load Shedding',   desc: 'Shed non-critical loads to reduce demand.',       icon: Power     },
            { id: 'bess',        label: 'BESS Discharge',  desc: 'Discharge battery to offset peak demand.',        icon: Zap       },
            { id: 'hybrid',      label: 'Hybrid',          desc: 'Combine load shedding with battery discharge.',   icon: BarChart2 },
            { id: 'demand-resp', label: 'Demand Response', desc: 'Participate in utility DR programs.',             icon: TrendingUp},
          ].map(s => (
            <label key={s.id} htmlFor={`strat-${s.id}`}
              className={`stg-strat-card ${strategy === s.id ? 'stg-strat-card--active' : ''}`}>
              <input type="radio" id={`strat-${s.id}`} name="strategy" value={s.id}
                checked={strategy === s.id} onChange={() => setStrategy(s.id)} className="sr-only" />
              <s.icon size={18} className="strat-icon" />
              <span className="strat-label">{s.label}</span>
              <span className="strat-desc">{s.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {(strategy === 'bess' || strategy === 'hybrid') && (
        <fieldset className="stg-fieldset">
          <legend className="stg-legend">BESS Parameters</legend>
          <div className="stg-grid-2">
            <div className="stg-field">
              <label htmlFor="min-soc" className="stg-label">Min State of Charge — {minSoC}%</label>
              <input id="min-soc" type="range" className="stg-slider" value={minSoC}
                onChange={e => setMinSoC(Number(e.target.value))} min="10" max="50" step="5" />
              <p className="stg-hint">BESS will not discharge below this SoC floor.</p>
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="stg-fieldset">
        <legend className="stg-legend">Peak Window &amp; Tariff</legend>
        <div className="stg-grid-3">
          <div className="stg-field">
            <label htmlFor="window-start" className="stg-label">Window Start</label>
            <input id="window-start" type="time" className="stg-input" value={windowStart}
              onChange={e => setWindowStart(e.target.value)} />
          </div>
          <div className="stg-field">
            <label htmlFor="window-end" className="stg-label">Window End</label>
            <input id="window-end" type="time" className="stg-input" value={windowEnd}
              onChange={e => setWindowEnd(e.target.value)} />
          </div>
          <div className="stg-field">
            <label htmlFor="tariff-period" className="stg-label">Tariff Structure</label>
            <select id="tariff-period" className="stg-select" value={tariffPeriod}
              onChange={e => setTariffPeriod(e.target.value)}>
              <option value="flat">Flat Rate</option>
              <option value="tod">Time of Day (ToD)</option>
              <option value="tou">Time of Use (TOU)</option>
              <option value="rtp">Real-Time Pricing</option>
            </select>
          </div>
        </div>
      </fieldset>

      <div className="stg-actions">
        <button type="button" className="stg-btn stg-btn--ghost" id="peak-reset-btn">
          <RotateCcw size={15} /> Reset
        </button>
        <button type="submit" className={`stg-btn stg-btn--primary ${saved ? 'stg-btn--saved' : ''}`} id="peak-save-btn">
          {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save Configuration</>}
        </button>
      </div>
    </form>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export function PortsConfigTab() {
  const { esp32, sendCommand } = useEsp32();
  
  const toggleRelay = (relayId, currentState) => {
    sendCommand('relay_control', { relay: relayId, state: !currentState });
  };

  const t = esp32.latestTelemetry || {};
  
  return (
    <div className="stg-pane" id="ports-pane">
      <div className="stg-section-head">
        <div className="stg-section-icon"><SettingsIcon size={16} /></div>
        <div>
          <h2 className="stg-section-title">Port Control & Relays</h2>
          <p className="stg-section-desc">Manage ESP32 output ports and monitor current status.</p>
        </div>
      </div>
      
      <h3 style={{ marginBottom: '1rem', marginTop: '1rem', fontSize: '1.1rem', color: 'var(--color-fg)' }}>Relay Controls</h3>
      <div className="stg-kpi-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="stg-kpi-tile kpi--cyan" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="kpi-label">Relay 1 (1-Ch)</span>
            <span className="kpi-val" style={{ fontSize: '1.2rem' }}>{t.relay1 ? 'ON' : 'OFF'}</span>
          </div>
          <ToggleSwitch id="r1" checked={t.relay1} onChange={() => toggleRelay(1, t.relay1)} />
        </div>
        <div className="stg-kpi-tile kpi--cyan" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="kpi-label">Relay 2 (1-Ch)</span>
            <span className="kpi-val" style={{ fontSize: '1.2rem' }}>{t.relay2 ? 'ON' : 'OFF'}</span>
          </div>
          <ToggleSwitch id="r2" checked={t.relay2} onChange={() => toggleRelay(2, t.relay2)} />
        </div>
        <div className="stg-kpi-tile kpi--indigo" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="kpi-label">Relay 3 (2-Ch A)</span>
            <span className="kpi-val" style={{ fontSize: '1.2rem' }}>{t.relay3 ? 'ON' : 'OFF'}</span>
          </div>
          <ToggleSwitch id="r3" checked={t.relay3} onChange={() => toggleRelay(3, t.relay3)} />
        </div>
        <div className="stg-kpi-tile kpi--indigo" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="kpi-label">Relay 4 (2-Ch B)</span>
            <span className="kpi-val" style={{ fontSize: '1.2rem' }}>{t.relay4 ? 'ON' : 'OFF'}</span>
          </div>
          <ToggleSwitch id="r4" checked={t.relay4} onChange={() => toggleRelay(4, t.relay4)} />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage({ onBack, defaultTab = 'port' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Always Light Mode as requested
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.add('light-theme');
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Shortcut key '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        setIsCollapsed(false);
        const searchInput = document.getElementById('sidebar-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const panels = {
    port:          PortsConfigTab,
    status:        Esp32Tab,
    logs:          LogsTab,
    notifications: NotificationsTab,
    peak:          PeakConfigTab,
  };
  const ActivePanel = panels[activeTab] || PortsConfigTab;

  const filteredTabs = TABS.filter(tab =>
    tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tab.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTabObj = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <div className="stg-root" id="settings-page" data-theme="light">
      {/* ─── Top Navbar matching reference image (Path must) ───────────── */}
      <header className="ref-navbar">
        {/* Brand & Path */}
        <div className="ref-nav-left">
          <div className="ref-brand">
            <span className="ref-brand-icon-wrap">
              <Zap size={20} className="ref-brand-icon" />
            </span>
            <span className="ref-brand-name">Horizon</span>
          </div>

          {/* Path Must: Breadcrumb Route indicator */}
          <div className="ref-nav-path">
            <span className="ref-path-tag">PATH:</span>
            {onBack ? (
              <button type="button" onClick={onBack} className="ref-path-link" title="Return to Dashboard">
                Dashboard
              </button>
            ) : (
              <span className="ref-path-segment">Dashboard</span>
            )}
            <span className="ref-path-sep">/</span>
            <span className="ref-path-segment">Settings</span>
            <span className="ref-path-sep">/</span>
            <span className="ref-path-segment ref-path-segment--active">{activeTabObj.label}</span>
          </div>
        </div>

        {/* Center Tabs with Lucide Icons (matching reference image) */}
        <nav className="ref-nav-center" aria-label="Main Navigation">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`ref-nav-tab ${isActive ? 'ref-nav-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} className="ref-tab-icon" />
                <span className="ref-tab-label">{tab.label}</span>
                {tab.hasDot && <span className="ref-tab-dot" />}
              </button>
            );
          })}
        </nav>

        {/* Right Action Icons matching reference image */}
        <div className="ref-nav-right">
          {/* Magenta / Pink Circular Action Button with Plus */}
          <button
            type="button"
            className="ref-btn-plus"
            title="New Port / Device / Rule"
            onClick={() => setActiveTab('port')}
          >
            <Plus size={18} />
          </button>

          {/* Clock icon */}
          <button
            type="button"
            className="ref-icon-btn"
            title="System Time / Activity"
          >
            <Clock size={18} />
          </button>

          {/* Bell with unread badge 3 */}
          <button
            type="button"
            className="ref-icon-btn ref-bell-btn"
            title="3 Alerts / Notifications"
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} />
            <span className="ref-bell-badge">3</span>
          </button>

          {/* Settings cog icon */}
          <button
            type="button"
            className={`ref-icon-btn ${activeTab === 'port' ? 'ref-icon-btn--active' : ''}`}
            title="Settings / Configuration"
            onClick={() => setActiveTab('port')}
          >
            <SettingsIcon size={18} />
          </button>

          {/* User profile avatar with Name + ChevronDown */}
          <div className="ref-user-profile" title="Operator: Zé">
            <div className="ref-user-avatar">
              <span>Z</span>
            </div>
            <span className="ref-user-name">Zé</span>
            <ChevronDown size={14} className="ref-user-chevron" />
          </div>
        </div>
      </header>

      {/* ─── Main Workbench Body (Sidebar + Content Panel) ───────────── */}
      <div className="stg-workbench-layout">
        {/* Collapsible Sidebar (Three dots and Dark mode button removed) */}
        <aside
          className={`stg-sidebar ${isCollapsed ? 'stg-sidebar--collapsed' : 'stg-sidebar--expanded'}`}
          aria-label="Platform navigation"
        >
          {/* Top Bar with avatar and collapse toggle (NO three dots) */}
          <div className="stg-sb-top">
            {!isCollapsed ? (
              <div className="stg-sb-header-meta">
                <div className="stg-sb-avatar-wrap" title="KPR Horizon Platform">
                  <div className="stg-sb-avatar">
                    <span>UI</span>
                    <span className="avatar-badge">8</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="stg-sb-toggle-btn"
                  onClick={() => setIsCollapsed(true)}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="stg-sb-toggle-btn"
                onClick={() => setIsCollapsed(false)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ArrowRight size={16} />
              </button>
            )}
          </div>

          {/* Search box or icon */}
          <div className="stg-sb-search-wrap">
            {!isCollapsed ? (
              <div className="stg-sb-search-box">
                <Search size={14} className="sb-search-icon" />
                <input
                  id="sidebar-search-input"
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="stg-sb-search-input"
                />
                <span className="sb-search-shortcut">/</span>
              </div>
            ) : (
              <button
                type="button"
                className="stg-sb-icon-btn"
                onClick={() => setIsCollapsed(false)}
                title="Search settings (/)"
                aria-label="Search"
              >
                <Search size={18} />
                <div className="stg-tooltip">Search</div>
              </button>
            )}
          </div>

          {/* Nav Items List */}
          <nav className="stg-sb-nav" aria-label="Tabs">
            <ul className="stg-sb-nav-list" role="tablist">
              {filteredTabs.map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <li key={tab.id} className="stg-sb-nav-item" role="presentation">
                    <button
                      id={`tab-${tab.id}`}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`panel-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={`stg-sb-nav-btn ${isActive ? 'stg-sb-nav-btn--active' : ''}`}
                      type="button"
                    >
                      <div className="sb-btn-icon-container">
                        <Icon size={18} className="sb-btn-icon" />
                        {tab.hasDot && <span className="sb-notif-dot" />}
                      </div>

                      {!isCollapsed && (
                        <div className="sb-btn-content">
                          <span className="sb-btn-label">{tab.label}</span>
                          {tab.badge && (
                            <span className={`sb-btn-badge ${tab.badge === 'OK' ? 'badge--ok' : ''}`}>
                              {tab.badge}
                            </span>
                          )}
                        </div>
                      )}

                      {isCollapsed && (
                        <div className="stg-tooltip">
                          <span>{tab.label}</span>
                          {tab.badge && <span className="tooltip-chip">{tab.badge}</span>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom Action (Dark Mode button completely removed, Always light mode) */}
          <div className="stg-sb-footer">
            {!isCollapsed ? (
              <button
                type="button"
                className="stg-sb-action-btn"
                onClick={() => setActiveTab('port')}
              >
                <Plus size={16} />
                <span>New Port / Rule</span>
              </button>
            ) : (
              <button
                type="button"
                className="stg-sb-icon-btn stg-sb-icon-btn--accent"
                onClick={() => setActiveTab('port')}
                title="New Port / Rule"
                aria-label="New Port / Rule"
              >
                <Plus size={18} />
                <div className="stg-tooltip">New Port / Rule</div>
              </button>
            )}
          </div>
        </aside>

        {/* Content Wrapper */}
        <div className="stg-main-wrapper">
          {/* Subheader with Dropdown selector */}
          <div className="stg-top-bar">
            <div className="stg-top-left" ref={dropdownRef}>
              <div className="stg-view-selector-wrap">
                <button
                  type="button"
                  className="stg-view-selector-btn"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <activeTabObj.icon size={16} className="selector-icon" />
                  <span className="selector-label">{activeTabObj.label}</span>
                  <ChevronDown size={14} className={`selector-chevron ${isDropdownOpen ? 'open' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="stg-view-dropdown" role="listbox">
                    <div className="stg-dropdown-header">Configuration Views</div>
                    {TABS.map(tab => {
                      const isSelected = activeTab === tab.id;
                      const TabIcon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          role="option"
                          aria-selected={isSelected}
                          className={`stg-dropdown-item ${isSelected ? 'stg-dropdown-item--active' : ''}`}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setIsDropdownOpen(false);
                          }}
                          type="button"
                        >
                          <TabIcon size={16} className="dropdown-icon" />
                          <span className="dropdown-text">{tab.label}</span>
                          {isSelected && <Check size={14} className="dropdown-check" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="stg-filter-btn-pill"
                title="Filter views"
                aria-label="Filter views"
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>

            <div className="stg-top-right">
              <div className="stg-live-pill">
                <span className="live-dot" />Telemetry Live
              </div>
              <div className="stg-breadcrumb">
                <span className="bc-inactive">Config</span>
                <ChevronRight size={12} className="bc-sep" />
                <span className="bc-active">{activeTabObj.label}</span>
              </div>
            </div>
          </div>

          {/* Main content panel */}
          <main
            className="stg-content-panel"
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            <ActivePanel />
          </main>
        </div>
      </div>
    </div>
  );
}
