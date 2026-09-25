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
  Mail, MessageSquare, Webhook, RefreshCw,
  Eye, Copy, Check, Database, Power, Cpu,
  Search, ArrowLeft, ArrowRight, ChevronDown, Plus, SlidersHorizontal,
  Settings as SettingsIcon, CheckCircle2, Code, HardDrive, Sparkles, TrendingUp
} from 'lucide-react';
import { useEsp32 } from './useEsp32.js';
import DeviceConfigTab from './DeviceConfig.jsx';
import LoadSheddingTab from './LoadShedding.jsx';
import LoadRecommendationsTab from './LoadRecommendations.jsx';
import RelayControllerTab from './RelayController.jsx';
import PeakFinancialAnalysisTab from './PeakFinancialAnalysis.jsx';
import { ESP32_FIRMWARE_CODE } from './esp32FirmwareCode.js';
import './Settings.css';

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'device',          label: 'Device Configuration',        shortLabel: 'Devices',       icon: HardDrive,  badge: null,     hasDot: false, desc: 'Hardware & Edge Node Settings'  },
  { id: 'port',            label: 'Port configuration',          shortLabel: 'Ports',         icon: Plug,       badge: null,     hasDot: false, desc: 'Configure Relays & Sensor ports' },
  { id: 'controller',      label: 'Relay Controller',            shortLabel: 'Relays',        icon: Cpu,        badge: 'UART',   hasDot: true,  desc: 'ESP32 Wi-Fi to Arduino UART Relay Controller' },
  { id: 'peak',            label: 'Load shedding / Scheduling',  shortLabel: 'Shedding',      icon: Zap,        badge: 'AUTO',   hasDot: true,  desc: 'Automated peak protection & load shifting' },
  { id: 'analytics',       label: 'Main Peak & Financial Analysis', shortLabel: 'Analysis',   icon: TrendingUp, badge: 'PRO',    hasDot: true,  desc: 'Before/After Peak Prediction & Financial ROI' },
  { id: 'recommendations', label: 'Load Recommendations',        shortLabel: 'AI Recomms',    icon: Sparkles,   badge: 'AI',     hasDot: true,  desc: 'AI peak mitigation advice & impact' },
  { id: 'status',          label: 'Status & Telemetry',          shortLabel: 'Telemetry',     icon: Activity,   badge: 'LIVE',   hasDot: true,  desc: 'Live ESP32 telemetry & system health' },
  { id: 'logs',            label: 'System Logs',                 shortLabel: 'Logs',          icon: ScrollText, badge: null,     hasDot: false, desc: 'Real-time platform event stream' },
  { id: 'notifications',   label: 'Notification Settings',       shortLabel: 'Alerts',        icon: Bell,       badge: null,     hasDot: false, desc: 'Alert channels & triggers'      },
];

// ─── Mock data ────────────────────────────────────────────────────────────────
const INITIAL_SYSTEM_LOGS = [
  { id: 'log-1', ts: '10:52:14', level: 'INFO',  src: 'TELEMETRY', msg: 'ESP32 (10.38.24.77) frame synced: 229.4V, 418W, 1.82A, PF: 0.95, IR: 1' },
  { id: 'log-2', ts: '10:50:00', level: 'WARN',  src: 'PEAK_GUARD', msg: 'System load approached 4.62 kW (92.4% of 5.00 kW ceiling). Risk state flagged.' },
  { id: 'log-3', ts: '10:50:02', level: 'INFO',  src: 'RECOMMEND', msg: 'Algorithmic recommendation generated: Shed Iron Box on Port 4 (-1000 W).' },
  { id: 'log-4', ts: '10:48:30', level: 'INFO',  src: 'RELAY_CTL', msg: 'Hardware relay channel D7 state verified active. Relay coil current normal.' },
  { id: 'log-5', ts: '10:44:12', level: 'INFO',  src: 'MODBUS',   msg: 'Modbus RTU bridge polling cycle completed in 3 ms. COM3 OK.' },
  { id: 'log-6', ts: '10:42:05', level: 'INFO',  src: 'BESS',     msg: 'Battery Energy Storage reserve at 85.0% SoC. Standby buffer available.' },
  { id: 'log-7', ts: '10:40:00', level: 'INFO',  src: 'SYSTEM',   msg: 'KPR Horizon Core v2.4 initialized. WebSocket router listening on :5000/ws.' },
];

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

// ─── Tab 1: Port Configuration (Arduino Hardware & Electrical Specs) ──────────
const HARDWARE_PORT_DEFAULTS = [
  {
    port_id: 'P-001',
    port_name: 'Port 1',
    port_number: 1,
    port_status: 'Online',
    port_type: 'AC Output',
    location: 'Extension Board',
    connected_device: 'Wi-Fi Router',
    controller: 'Arduino UNO',
    relay_channel: 'Relay 1',
    relay_pin: 'D4',
    current_sensor: 'ACS712-1',
    current_sensor_pin: 'A1',
    voltage_sensor: 'ZMPT101B-1',
    voltage_sensor_pin: 'A0',
    rated_voltage: 230.0,
    max_current: 10.0,
    max_power: 2300.0,
    measurement_unit: 'W',
    power_factor: 0.95,
    live_voltage: 229.4,
    live_current: 1.82,
    live_power: 418.0,
    live_status: 'NORMAL'
  },
  {
    port_id: 'P-002',
    port_name: 'Port 2',
    port_number: 2,
    port_status: 'Online',
    port_type: 'AC Output',
    location: 'Extension Board',
    connected_device: 'Mobile Charger',
    controller: 'Arduino UNO',
    relay_channel: 'Relay 2',
    relay_pin: 'D5',
    current_sensor: 'ACS712-2',
    current_sensor_pin: 'A2',
    voltage_sensor: 'ZMPT101B-1',
    voltage_sensor_pin: 'A0',
    rated_voltage: 230.0,
    max_current: 10.0,
    max_power: 2300.0,
    measurement_unit: 'W',
    power_factor: 0.95,
    live_voltage: 229.8,
    live_current: 0.28,
    live_power: 62.0,
    live_status: 'NORMAL'
  },
  {
    port_id: 'P-003',
    port_name: 'Port 3',
    port_number: 3,
    port_status: 'Online',
    port_type: 'AC Output',
    location: 'Extension Board',
    connected_device: 'Laptop',
    controller: 'Arduino UNO',
    relay_channel: 'Relay 3',
    relay_pin: 'D6',
    current_sensor: 'ACS712-3',
    current_sensor_pin: 'A3',
    voltage_sensor: 'ZMPT101B-1',
    voltage_sensor_pin: 'A0',
    rated_voltage: 230.0,
    max_current: 10.0,
    max_power: 2300.0,
    measurement_unit: 'W',
    power_factor: 0.95,
    live_voltage: 229.1,
    live_current: 0.54,
    live_power: 120.0,
    live_status: 'NORMAL'
  },
  {
    port_id: 'P-004',
    port_name: 'Port 4',
    port_number: 4,
    port_status: 'Online',
    port_type: 'AC Output',
    location: 'Extension Board',
    connected_device: 'Electric Iron',
    controller: 'Arduino UNO',
    relay_channel: 'Relay 4',
    relay_pin: 'D7',
    current_sensor: 'ACS712-4',
    current_sensor_pin: 'A4',
    voltage_sensor: 'ZMPT101B-1',
    voltage_sensor_pin: 'A0',
    rated_voltage: 230.0,
    max_current: 10.0,
    max_power: 2300.0,
    measurement_unit: 'W',
    power_factor: 0.95,
    live_voltage: 228.6,
    live_current: 4.85,
    live_power: 1080.0,
    live_status: 'NORMAL'
  }
];

function normalizePort(p) {
  if (!p) return null;
  const pId = p.port_id || p.id || 'P-001';
  const pName = p.port_name || p.name || 'Port 1';
  const pNum = p.port_number != null ? p.port_number : (p.portNumber != null ? p.portNumber : 1);
  const pStatus = p.port_status || p.status || 'Online';
  const pType = p.port_type || p.type || 'AC Output';
  const pLoc = p.location || 'Extension Board';
  const pDev = p.connected_device || p.connectedDevice || 'Unassigned';
  const pCtrl = p.controller || 'Arduino UNO';
  const pRelay = p.relay_channel || p.relayChannel || 'Relay 1';
  const pPin = p.relay_pin || p.relayPin || 'D4';
  const pCSensor = p.current_sensor || p.currentSensor || 'ACS712-1';
  const pCPin = p.current_sensor_pin || p.currentSensorPin || 'A1';
  const pVSensor = p.voltage_sensor || p.voltageSensor || 'ZMPT101B-1';
  const pVPin = p.voltage_sensor_pin || p.voltageSensorPin || 'A0';
  const pRatedV = p.rated_voltage != null ? Number(p.rated_voltage) : (p.ratedVoltage != null ? Number(p.ratedVoltage) : 230);
  const pMaxI = p.max_current != null ? Number(p.max_current) : (p.maxCurrent != null ? Number(p.maxCurrent) : 10);
  const pMaxP = p.max_power != null ? Number(p.max_power) : (p.maxPower != null ? Number(p.maxPower) : 2300);
  const pUnit = p.measurement_unit || p.measureUnit || 'W';
  const pPF = p.power_factor != null ? Number(p.power_factor) : (p.powerFactor != null ? Number(p.powerFactor) : 0.95);
  const pLiveV = p.live_voltage != null ? Number(p.live_voltage) : (p.liveVoltage != null ? Number(p.liveVoltage) : 229.4);
  const pLiveI = p.live_current != null ? Number(p.live_current) : (p.liveCurrent != null ? Number(p.liveCurrent) : 1.82);
  const pLiveP = p.live_power != null ? Number(p.live_power) : (p.livePower != null ? Number(p.livePower) : 418);
  const pLiveStatus = (p.live_status || p.liveStatus || 'NORMAL').toUpperCase();

  return {
    id: pId,
    port_id: pId,
    name: pName,
    port_name: pName,
    portNumber: pNum,
    port_number: pNum,
    status: pStatus,
    port_status: pStatus,
    type: pType,
    port_type: pType,
    location: pLoc,
    connectedDevice: pDev,
    connected_device: pDev,
    controller: pCtrl,
    relayChannel: pRelay,
    relay_channel: pRelay,
    relayPin: pPin,
    relay_pin: pPin,
    currentSensor: pCSensor,
    current_sensor: pCSensor,
    currentSensorPin: pCPin,
    current_sensor_pin: pCPin,
    voltageSensor: pVSensor,
    voltage_sensor: pVSensor,
    voltageSensorPin: pVPin,
    voltage_sensor_pin: pVPin,
    ratedVoltage: pRatedV,
    rated_voltage: pRatedV,
    maxCurrent: pMaxI,
    max_current: pMaxI,
    maxPower: pMaxP,
    max_power: pMaxP,
    measureUnit: pUnit,
    measurement_unit: pUnit,
    powerFactor: pPF,
    power_factor: pPF,
    liveVoltage: pLiveV,
    live_voltage: pLiveV,
    liveCurrent: pLiveI,
    live_current: pLiveI,
    livePower: pLiveP,
    live_power: pLiveP,
    liveStatus: pLiveStatus,
    live_status: pLiveStatus
  };
}

const DEVICE_WATTS = {
  1: 12,    // Wi-Fi Router
  2: 25,    // Mobile Charger
  3: 65,    // Laptop Workstation
  4: 1200   // Electric Iron
};

function PortConfigTab() {
  const { esp32, relayStates, sendRelayCommand } = useEsp32();
  const [ports, setPorts] = useState(() => HARDWARE_PORT_DEFAULTS.map(normalizePort));
  const [selectedPortId, setSelectedPortId] = useState('P-001');
  const [availableDevices, setAvailableDevices] = useState([
    'Wi-Fi Router', 'Mobile Charger', 'Laptop', 'Electric Iron', 'Air Conditioner', 'Water Heater', 'Lighting Circuit'
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [pendingRelay, setPendingRelay] = useState(false);

  // Fetch real ports from server/DB on mount
  useEffect(() => {
    fetch('/api/ports')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const normalizedList = json.data.map(normalizePort);
          setPorts(normalizedList);
        }
      })
      .catch(err => console.log('Using default ports configuration:', err));

    // Also fetch devices to populate the Connected Device options
    fetch('/api/devices')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          const names = json.data.map(d => d.name).filter(Boolean);
          if (names.length > 0) {
            setAvailableDevices(prev => Array.from(new Set([...prev, ...names])));
          }
        }
      })
      .catch(() => {});
  }, []);

  const activePort = ports.find(p => (p.port_id === selectedPortId || p.id === selectedPortId)) || ports[0] || normalizePort(HARDWARE_PORT_DEFAULTS[0]);

  const handleFieldChange = (field, value) => {
    setPorts(prev => prev.map(p => {
      const matchId = p.port_id || p.id;
      if (matchId === selectedPortId) {
        const updated = { ...p, [field]: value };

        // Dual-casing synchronizer
        if (field === 'port_name') updated.name = value;
        if (field === 'name') updated.port_name = value;
        if (field === 'port_id') updated.id = value;
        if (field === 'id') updated.port_id = value;
        if (field === 'port_number') {
          const n = parseInt(value, 10) || 1;
          updated.portNumber = n;
          updated.port_number = n;
        }
        if (field === 'portNumber') {
          const n = parseInt(value, 10) || 1;
          updated.port_number = n;
          updated.portNumber = n;
        }
        if (field === 'port_status') updated.status = value;
        if (field === 'status') updated.port_status = value;
        if (field === 'port_type') updated.type = value;
        if (field === 'type') updated.port_type = value;
        if (field === 'connected_device') updated.connectedDevice = value;
        if (field === 'connectedDevice') updated.connected_device = value;
        if (field === 'relay_channel') updated.relayChannel = value;
        if (field === 'relayChannel') updated.relay_channel = value;
        if (field === 'relay_pin') updated.relayPin = value;
        if (field === 'relayPin') updated.relay_pin = value;
        if (field === 'current_sensor') updated.currentSensor = value;
        if (field === 'currentSensor') updated.current_sensor = value;
        if (field === 'current_sensor_pin') updated.currentSensorPin = value;
        if (field === 'currentSensorPin') updated.current_sensor_pin = value;
        if (field === 'voltage_sensor') updated.voltageSensor = value;
        if (field === 'voltageSensor') updated.voltage_sensor = value;
        if (field === 'voltage_sensor_pin') updated.voltageSensorPin = value;
        if (field === 'voltageSensorPin') updated.voltage_sensor_pin = value;

        if (field === 'rated_voltage' || field === 'ratedVoltage') {
          const v = parseFloat(value) || 0;
          updated.rated_voltage = v;
          updated.ratedVoltage = v;
        }
        if (field === 'max_current' || field === 'maxCurrent') {
          const i = parseFloat(value) || 0;
          updated.max_current = i;
          updated.maxCurrent = i;
        }
        if (field === 'max_power' || field === 'maxPower') {
          const mp = parseFloat(value) || 0;
          updated.max_power = mp;
          updated.maxPower = mp;
        }
        if (field === 'measurement_unit' || field === 'measureUnit') {
          updated.measurement_unit = value;
          updated.measureUnit = value;
        }
        if (field === 'power_factor' || field === 'powerFactor') {
          const pf = parseFloat(value) || 0.95;
          updated.power_factor = pf;
          updated.powerFactor = pf;
        }

        // Auto-recalculate rated max power if rated_voltage or max_current change
        if (field === 'rated_voltage' || field === 'ratedVoltage' || field === 'max_current' || field === 'maxCurrent' || field === 'power_factor' || field === 'powerFactor') {
          const v = parseFloat(updated.rated_voltage) || 0;
          const i = parseFloat(updated.max_current) || 0;
          const pf = parseFloat(updated.power_factor) || 1;
          if (v && i) {
            const calculatedPower = Math.round(v * i * pf);
            updated.max_power = calculatedPower;
            updated.maxPower = calculatedPower;
          }
        }
        return updated;
      }
      return p;
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const targetId = activePort.port_id || activePort.id || selectedPortId;
    try {
      const res = await fetch(`/api/ports/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activePort)
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setSaveMessage(`Configuration for ${activePort.port_name || activePort.name} (${targetId}) saved to database.`);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert('Failed to save port configuration: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error saving port configuration:', err);
      setSaved(true);
      setSaveMessage(`Configuration for ${activePort.port_name || activePort.name} stored locally.`);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    const rawDefault = HARDWARE_PORT_DEFAULTS.find(p => p.port_id === selectedPortId);
    if (rawDefault) {
      const defaultData = normalizePort(rawDefault);
      setPorts(prev => prev.map(p => (p.port_id === selectedPortId || p.id === selectedPortId) ? { ...defaultData } : p));
      setSaved(true);
      setSaveMessage(`Reset ${defaultData.port_name} to Arduino UNO & default hardware pins.`);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  // Derive dynamic live telemetry linked to physical relay state
  const portIdx = activePort.port_number || activePort.portNumber || 1;
  const isRelayOn = Boolean(relayStates?.[`relay${portIdx}`]);
  const ratedWatts = DEVICE_WATTS[portIdx] || activePort.live_power || 50;

  const espVolt = esp32?.latestTelemetry?.voltage;
  const espCurr = esp32?.latestTelemetry?.[`current${portIdx}`];
  const espPower = esp32?.latestTelemetry?.[`power${portIdx}`];

  const liveVoltage = espVolt !== undefined ? Number(espVolt).toFixed(1) : (activePort.rated_voltage ?? activePort.ratedVoltage ?? 229.4);
  
  // Real physical load calculation: if relay is open/OFF, 0W and 0.00A flow
  const livePower = isRelayOn
    ? (espPower !== undefined && espPower > 0 ? Math.round(espPower) : ratedWatts)
    : 0;

  const liveCurrent = isRelayOn
    ? (espCurr !== undefined && espCurr > 0 ? Number(espCurr).toFixed(2) : (ratedWatts / (parseFloat(liveVoltage) || 230)).toFixed(2))
    : '0.00';

  const liveStatus = isRelayOn ? 'NORMAL (ENERGIZED)' : 'SHED (RELAY OFF)';

  return (
    <form className="stg-form" onSubmit={handleSave} id="port-config-form">
      {/* Header */}
      <div className="stg-section-head">
        <div className="stg-section-icon"><Plug size={18} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="stg-section-title">PORT Configuration</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="stg-badge stg-badge--active" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                <span className="stg-status-dot stg-status-dot--online"></span>
                ESP32 Wi-Fi Node: {esp32?.ip || '10.38.24.77'}
              </span>
              <span className="stg-badge" style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(29,100,242,0.1)', color: 'var(--color-accent)' }}>
                Arduino UNO Controller
              </span>
            </div>
          </div>
          <p className="stg-section-desc">
            Configure AC output ports, hardware pin mappings for Arduino UNO relays and sensors, and electrical limits. Realtime relay state is synchronized over Wi-Fi.
          </p>
        </div>
      </div>

      {/* 4-Port Selector Strip */}
      <div className="port-selector-strip" role="tablist" aria-label="Port selection">
        {ports.map((p) => {
          const pId = p.port_id || p.id;
          const isSelected = pId === selectedPortId;
          const pName = p.port_name || p.name || `Port ${p.port_number || p.portNumber || 1}`;
          const pPin = p.relay_pin || p.relayPin || 'D4';
          const pDev = p.connected_device || p.connectedDevice || 'Unassigned';
          const pNum = p.port_number || p.portNumber || 1;
          const isPortRelayActive = Boolean(relayStates?.[`relay${pNum}`]);
          const portWatts = DEVICE_WATTS[pNum] || 50;

          return (
            <button
              key={pId}
              type="button"
              className={`port-select-card ${isSelected ? 'port-select-card--active' : ''} ${isPortRelayActive ? 'port-select-card--energized' : 'port-select-card--shed'}`}
              onClick={() => setSelectedPortId(pId)}
            >
              <div className="port-card-top">
                <span className="port-card-title">{pName}</span>
                <span className={`port-relay-badge ${isPortRelayActive ? 'port-relay-badge--on' : 'port-relay-badge--off'}`}>
                  <span className="relay-badge-dot" />
                  {isPortRelayActive ? 'RELAY ON' : 'RELAY OFF'}
                </span>
              </div>
              <div className="port-card-id">{pId} • Pin {pPin}</div>
              <div className="port-card-device" title={pDev}>
                {pDev}
              </div>
              <div className="port-card-live-pill">
                <span className="pcl-power">{isPortRelayActive ? `${portWatts} W` : '0 W'}</span>
                <span className="pcl-sep">•</span>
                <span className={`pcl-status ${isPortRelayActive ? 'pcl-status--on' : 'pcl-status--off'}`}>
                  {isPortRelayActive ? 'ENERGIZED' : 'SHED'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Values Display HUD */}
      <div className={`port-live-telemetry-hud ${isRelayOn ? 'hud--energized' : 'hud--shed'}`}>
        <div className="hud-title-bar">
          <div className="hud-title-left">
            <Activity size={15} className={`pulse-accent ${isRelayOn ? 'icon-on' : 'icon-off'}`} />
            <span>Live Hardware Values — {activePort.port_name || activePort.name || 'Port 1'} ({activePort.connected_device || activePort.connectedDevice || 'Unassigned'})</span>
          </div>
          <div className={`hud-status-badge ${isRelayOn ? 'hud-status-badge--on' : 'hud-status-badge--off'}`}>
            <span className={`stg-status-dot ${isRelayOn ? 'stg-status-dot--online' : 'stg-status-dot--offline'}`} />
            Circuit: <strong>{liveStatus}</strong>
          </div>
        </div>

        <div className="live-metrics-grid">
          <div className="metric-box">
            <span className="metric-label">Voltage</span>
            <div className="metric-val-wrap">
              <span className="metric-val">{liveVoltage}</span>
              <span className="metric-unit">V</span>
            </div>
            <span className="metric-sub">Bus: {activePort.rated_voltage ?? activePort.ratedVoltage ?? 230} V</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Current</span>
            <div className="metric-val-wrap">
              <span className={`metric-val ${isRelayOn ? 'metric-val--live' : ''}`}>{liveCurrent}</span>
              <span className="metric-unit">A</span>
            </div>
            <span className="metric-sub">Max: {activePort.max_current ?? activePort.maxCurrent ?? 10} A</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Power</span>
            <div className="metric-val-wrap">
              <span className={`metric-val ${isRelayOn ? 'metric-val--live' : ''}`}>{livePower}</span>
              <span className="metric-unit">{activePort.measurement_unit || activePort.measureUnit || 'W'}</span>
            </div>
            <span className="metric-sub">Rated: {ratedWatts} W</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Relay Controller State</span>
            <div className="metric-val-wrap">
              <span className={`metric-val metric-val--status ${isRelayOn ? 'status-text-on' : 'status-text-off'}`}>
                {isRelayOn ? 'ENERGIZED' : 'SHED'}
              </span>
            </div>
            <span className="metric-sub">Relay {portIdx} · Pin {activePort.relay_pin || 'D4'}</span>
          </div>
        </div>
      </div>

      {/* Section 1: Port Information */}
      <fieldset className="stg-fieldset">
        <legend className="stg-legend">
          <Plug size={14} style={{ marginRight: '6px' }} />
          1. Port Information
        </legend>
        <div className="stg-grid-3">
          <div className="stg-field">
            <label htmlFor="port-name" className="stg-label">Port Name</label>
            <input
              id="port-name"
              type="text"
              className="stg-input"
              value={activePort.port_name || activePort.name || ''}
              onChange={e => handleFieldChange('port_name', e.target.value)}
              placeholder="Port 1"
              required
            />
          </div>

          <div className="stg-field">
            <label htmlFor="port-id" className="stg-label">Port ID</label>
            <input
              id="port-id"
              type="text"
              className="stg-input stg-input--mono"
              value={activePort.port_id || activePort.id || ''}
              onChange={e => handleFieldChange('port_id', e.target.value)}
              placeholder="P-001"
              required
            />
          </div>

          <div className="stg-field">
            <label htmlFor="port-number" className="stg-label">Port Number</label>
            <input
              id="port-number"
              type="number"
              className="stg-input"
              value={activePort.port_number != null ? activePort.port_number : (activePort.portNumber != null ? activePort.portNumber : 1)}
              onChange={e => handleFieldChange('port_number', parseInt(e.target.value, 10) || 1)}
              min="1"
              max="16"
              required
            />
          </div>

          <div className="stg-field">
            <label htmlFor="port-status" className="stg-label">Port Status</label>
            <select
              id="port-status"
              className="stg-select"
              value={activePort.port_status || activePort.status || 'Online'}
              onChange={e => handleFieldChange('port_status', e.target.value)}
            >
              <option value="Online">Online</option>
              <option value="Standby">Standby</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          <div className="stg-field">
            <label htmlFor="port-type" className="stg-label">Port Type</label>
            <select
              id="port-type"
              className="stg-select"
              value={activePort.port_type || activePort.type || 'AC Output'}
              onChange={e => handleFieldChange('port_type', e.target.value)}
            >
              <option value="AC Output">AC Output</option>
              <option value="DC Output">DC Output</option>
              <option value="Auxiliary Relay">Auxiliary Relay</option>
              <option value="High Load Relay">High Load Relay</option>
            </select>
          </div>

          <div className="stg-field">
            <label htmlFor="location" className="stg-label">Location</label>
            <input
              id="location"
              type="text"
              className="stg-input"
              value={activePort.location || ''}
              onChange={e => handleFieldChange('location', e.target.value)}
              placeholder="Extension Board"
            />
          </div>

          <div className="stg-field stg-field--span2">
            <label htmlFor="connected-device" className="stg-label">Connected Device</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="connected-device"
                type="text"
                className="stg-input"
                list="connected-device-suggestions"
                value={activePort.connected_device || activePort.connectedDevice || ''}
                onChange={e => handleFieldChange('connected_device', e.target.value)}
                placeholder="Wi-Fi Router"
              />
              <datalist id="connected-device-suggestions">
                {availableDevices.map((dev, i) => (
                  <option key={i} value={dev} />
                ))}
              </datalist>
            </div>
            <span className="stg-helper">Type a custom device name or select from configured devices.</span>
          </div>
        </div>
      </fieldset>

      {/* Section 2: Hardware Mapping */}
      <fieldset className="stg-fieldset">
        <legend className="stg-legend">
          <Cpu size={14} style={{ marginRight: '6px' }} />
          2. Hardware Mapping
        </legend>
        
        <div className="hardware-mapping-banner">
          <Zap size={15} style={{ color: 'var(--color-accent)' }} />
          <span>This connects the web configuration to your Arduino hardware & ESP32 Wi-Fi relay controller.</span>
        </div>

        {/* Realtime Physical Relay Controller Strip */}
        <div className={`port-relay-action-strip ${isRelayOn ? 'pras--active' : 'pras--inactive'}`}>
          <div className="pras-header">
            <div className="pras-header-left">
              <div className={`pras-icon-ring ${isRelayOn ? 'pras-icon-ring--active' : ''}`}>
                <Power size={20} />
              </div>
              <div>
                <div className="pras-title-row">
                  <h4 className="pras-title">Realtime Hardware Relay Controller</h4>
                  <span className={`pras-live-tag ${isRelayOn ? 'pras-live-tag--on' : 'pras-live-tag--off'}`}>
                    <span className="pras-pulse" />
                    {isRelayOn ? 'RELAY ENERGIZED (ON)' : 'CIRCUIT OPEN / SHED (OFF)'}
                  </span>
                </div>
                <p className="pras-subtitle">
                  Direct physical relay switching for <strong>{activePort.connected_device || activePort.connectedDevice || `Port ${portIdx}`}</strong> on Arduino pin <strong>{activePort.relay_pin || 'D4'}</strong> via ESP32 Wi-Fi Node (<code>{esp32?.ip || '10.38.24.77'}</code>).
                </p>
              </div>
            </div>

            {/* Direct Big Switch Button */}
            <button
              type="button"
              disabled={pendingRelay}
              className={`pras-toggle-btn ${isRelayOn ? 'pras-toggle-btn--off' : 'pras-toggle-btn--on'}`}
              onClick={async () => {
                setPendingRelay(true);
                try {
                  await sendRelayCommand(isRelayOn ? `R${portIdx}_OFF` : `R${portIdx}_ON`);
                } finally {
                  setTimeout(() => setPendingRelay(false), 300);
                }
              }}
              id={`toggle-port-relay-${portIdx}`}
            >
              {pendingRelay ? (
                <><RefreshCw size={17} className="stg-spin" /> Switching...</>
              ) : isRelayOn ? (
                <><Power size={17} /> Turn Relay {portIdx} OFF (Shed Load)</>
              ) : (
                <><Power size={17} /> Turn Relay {portIdx} ON (Energize Port)</>
              )}
            </button>
          </div>

          <div className="pras-footer-bar">
            <div className="pras-meta-chips">
              <span className="pras-meta-chip">
                <strong>Target:</strong> Relay {portIdx} ({activePort.relay_pin || 'D4'})
              </span>
              <span className="pras-meta-chip">
                <strong>Logic:</strong> {portIdx >= 3 ? 'Active-HIGH (Inverted)' : 'Active-LOW (Standard)'}
              </span>
              <span className="pras-meta-chip">
                <strong>Hardware Route:</strong> <code>POST http://{esp32?.ip || '10.38.24.77'}/relay/{portIdx}/{isRelayOn ? 'off' : 'on'}</code>
              </span>
            </div>

            <div className="pras-bus-controls">
              <button
                type="button"
                className="pras-mini-btn pras-mini-btn--on"
                onClick={() => sendRelayCommand('ALL_ON')}
                title="Energize all 4 physical relays sequentially"
              >
                <Zap size={13} /> All Ports ON
              </button>
              <button
                type="button"
                className="pras-mini-btn pras-mini-btn--off"
                onClick={() => sendRelayCommand('ALL_OFF')}
                title="Immediately disconnect and shed all 4 relays"
              >
                <AlertTriangle size={13} /> Shed All Ports (ALL_OFF)
              </button>
            </div>
          </div>
        </div>

        <div className="stg-grid-3">
          <div className="stg-field">
            <label htmlFor="hw-controller" className="stg-label">Controller</label>
            <select
              id="hw-controller"
              className="stg-select"
              value={activePort.controller || 'Arduino UNO'}
              onChange={e => handleFieldChange('controller', e.target.value)}
            >
              <option value="Arduino UNO">Arduino UNO</option>
              <option value="Arduino Mega 2560">Arduino Mega 2560</option>
              <option value="ESP32 DevKit V1">ESP32 DevKit V1</option>
              <option value="STM32 Nucleo">STM32 Nucleo</option>
            </select>
          </div>

          <div className="stg-field">
            <label htmlFor="hw-relay-channel" className="stg-label">Relay Channel</label>
            <input
              id="hw-relay-channel"
              type="text"
              className="stg-input"
              value={activePort.relay_channel || activePort.relayChannel || ''}
              onChange={e => handleFieldChange('relay_channel', e.target.value)}
              placeholder="Relay 1"
            />
          </div>

          <div className="stg-field">
            <label htmlFor="hw-relay-pin" className="stg-label">
              Relay GPIO/Pin <span className="stg-pin-badge">Digital</span>
            </label>
            <input
              id="hw-relay-pin"
              type="text"
              className="stg-input stg-input--mono"
              value={activePort.relay_pin || activePort.relayPin || ''}
              onChange={e => handleFieldChange('relay_pin', e.target.value)}
              placeholder="D4"
            />
          </div>

          <div className="stg-field">
            <label htmlFor="hw-current-sensor" className="stg-label">Current Sensor</label>
            <input
              id="hw-current-sensor"
              type="text"
              className="stg-input"
              value={activePort.current_sensor || activePort.currentSensor || ''}
              onChange={e => handleFieldChange('current_sensor', e.target.value)}
              placeholder="ACS712-1"
            />
          </div>

          <div className="stg-field">
            <label htmlFor="hw-current-sensor-pin" className="stg-label">
              Current Sensor Pin <span className="stg-pin-badge">Analog</span>
            </label>
            <input
              id="hw-current-sensor-pin"
              type="text"
              className="stg-input stg-input--mono"
              value={activePort.current_sensor_pin || activePort.currentSensorPin || ''}
              onChange={e => handleFieldChange('current_sensor_pin', e.target.value)}
              placeholder="A1"
            />
          </div>

          <div className="stg-field">
            <label htmlFor="hw-voltage-sensor" className="stg-label">Voltage Sensor</label>
            <input
              id="hw-voltage-sensor"
              type="text"
              className="stg-input"
              value={activePort.voltage_sensor || activePort.voltageSensor || ''}
              onChange={e => handleFieldChange('voltage_sensor', e.target.value)}
              placeholder="ZMPT101B-1"
            />
          </div>

          <div className="stg-field">
            <label htmlFor="hw-voltage-sensor-pin" className="stg-label">
              Voltage Sensor Pin <span className="stg-pin-badge">Analog</span>
            </label>
            <input
              id="hw-voltage-sensor-pin"
              type="text"
              className="stg-input stg-input--mono"
              value={activePort.voltage_sensor_pin || activePort.voltageSensorPin || ''}
              onChange={e => handleFieldChange('voltage_sensor_pin', e.target.value)}
              placeholder="A0"
            />
          </div>
        </div>
      </fieldset>

      {/* Section 3: Electrical Configuration */}
      <fieldset className="stg-fieldset">
        <legend className="stg-legend">
          <Zap size={14} style={{ marginRight: '6px' }} />
          3. Electrical Configuration
        </legend>
        <div className="stg-grid-3">
          <div className="stg-field">
            <label htmlFor="elec-rated-voltage" className="stg-label">Rated Voltage</label>
            <div className="stg-input-group">
              <input
                id="elec-rated-voltage"
                type="number"
                step="1"
                className="stg-input"
                value={activePort.rated_voltage != null ? activePort.rated_voltage : (activePort.ratedVoltage != null ? activePort.ratedVoltage : 230)}
                onChange={e => handleFieldChange('rated_voltage', parseFloat(e.target.value) || 0)}
                placeholder="230"
                required
              />
              <span className="stg-input-addon" style={{ fontWeight: 600 }}>V</span>
            </div>
          </div>

          <div className="stg-field">
            <label htmlFor="elec-max-current" className="stg-label">Maximum Current</label>
            <div className="stg-input-group">
              <input
                id="elec-max-current"
                type="number"
                step="0.1"
                className="stg-input"
                value={activePort.max_current != null ? activePort.max_current : (activePort.maxCurrent != null ? activePort.maxCurrent : 10)}
                onChange={e => handleFieldChange('max_current', parseFloat(e.target.value) || 0)}
                placeholder="10"
                required
              />
              <span className="stg-input-addon" style={{ fontWeight: 600 }}>A</span>
            </div>
          </div>

          <div className="stg-field">
            <label htmlFor="elec-max-power" className="stg-label">Maximum Power</label>
            <div className="stg-input-group">
              <input
                id="elec-max-power"
                type="number"
                step="10"
                className="stg-input"
                value={activePort.max_power != null ? activePort.max_power : (activePort.maxPower != null ? activePort.maxPower : 2300)}
                onChange={e => handleFieldChange('max_power', parseFloat(e.target.value) || 0)}
                placeholder="2300"
                required
              />
              <span className="stg-input-addon" style={{ fontWeight: 600 }}>W</span>
            </div>
          </div>

          <div className="stg-field">
            <label htmlFor="elec-meas-unit" className="stg-label">Measurement Unit</label>
            <select
              id="elec-meas-unit"
              className="stg-select"
              value={activePort.measurement_unit || activePort.measureUnit || 'W'}
              onChange={e => handleFieldChange('measurement_unit', e.target.value)}
            >
              <option value="W">W (Watts)</option>
              <option value="kW">kW (Kilowatts)</option>
              <option value="VA">VA (Volt-Amperes)</option>
            </select>
          </div>

          <div className="stg-field">
            <label htmlFor="elec-power-factor" className="stg-label">Power Factor</label>
            <input
              id="elec-power-factor"
              type="number"
              step="0.01"
              min="0.1"
              max="1.0"
              className="stg-input"
              value={activePort.power_factor != null ? activePort.power_factor : (activePort.powerFactor != null ? activePort.powerFactor : 0.95)}
              onChange={e => handleFieldChange('power_factor', parseFloat(e.target.value) || 0.95)}
              placeholder="0.95"
            />
          </div>
        </div>
      </fieldset>

      {/* Save message notification if any */}
      {saveMessage && (
        <div style={{
          padding: '10px 14px',
          background: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: '8px',
          color: '#15803d',
          fontWeight: 600,
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="stg-actions">
        <button
          type="button"
          className="stg-btn stg-btn--ghost"
          id="port-reset-btn"
          onClick={handleResetDefaults}
          title="Reset current port back to Arduino UNO and standard pin defaults"
        >
          <RotateCcw size={15} /> Reset to Defaults
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`stg-btn stg-btn--primary ${saved ? 'stg-btn--saved' : ''}`}
          id="port-save-btn"
        >
          {saving ? (
            <><RefreshCw size={15} className="stg-spin" /> Saving...</>
          ) : saved ? (
            <><Check size={15} /> Save Configuration</>
          ) : (
            <><Save size={15} /> Save Configuration</>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Tab: Status & Telemetry (Unified Platform Services + ESP32 Edge Gateway) ──
export function Esp32Tab() {
  const { esp32, wsConnected, pingDevice, sendCommand } = useEsp32();
  const [viewMode, setViewMode] = useState('telemetry'); // 'telemetry' | 'services'
  const [pingStatus, setPingStatus] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, copyCode] = useClipboard();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date().toTimeString().slice(0, 8));

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastRefresh(new Date().toTimeString().slice(0, 8));
    }, 1000);
  };

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
    <div className="stg-pane" id="status-telemetry-pane">
      <div className="stg-section-head">
        <div className="stg-section-icon"><Activity size={16} /></div>
        <div>
          <h2 className="stg-section-title">System Status &amp; Telemetry</h2>
          <p className="stg-section-desc">
            Real-time edge IoT metrics from node <code>10.38.24.77</code> and platform service health.
          </p>
        </div>

        {/* View switcher & Actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--color-paper-3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <button
              type="button"
              className={`stg-btn stg-btn--sm ${viewMode === 'telemetry' ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
              onClick={() => setViewMode('telemetry')}
              style={{ borderRadius: '6px', fontSize: '0.8rem' }}
            >
              <Cpu size={14} /> Edge Telemetry
            </button>
            <button
              type="button"
              className={`stg-btn stg-btn--sm ${viewMode === 'services' ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
              onClick={() => setViewMode('services')}
              style={{ borderRadius: '6px', fontSize: '0.8rem' }}
            >
              <Activity size={14} /> Services Health
            </button>
          </div>

          {viewMode === 'telemetry' ? (
            <>
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
                <Code size={14} /> {showCode ? 'Hide Firmware' : 'Arduino Code'}
              </button>
            </>
          ) : (
            <button
              className={`stg-btn stg-btn--ghost stg-btn--sm ${refreshing ? 'stg-btn--spinning' : ''}`}
              onClick={handleRefresh}
              type="button"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        </div>
      </div>

      {pingStatus && (
        <div style={{
          marginBottom: '1.25rem', padding: '0.65rem 1rem', borderRadius: '8px',
          background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.25)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#059669', fontWeight: 600
        }}>
          <CheckCircle2 size={16} />
          <span>{pingStatus}</span>
        </div>
      )}

      {viewMode === 'services' ? (
        <>
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
        </>
      ) : (
        <>
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
                  <span className="term-ts">[{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'STREAM'}]</span>
                  <span className="term-key"> RX </span>
                  <span className="term-json">{JSON.stringify(item)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const StatusTab = Esp32Tab;

// ─── Tab 3: Logs ──────────────────────────────────────────────────────────────
function LogsTab() {
  const { esp32 }             = useEsp32();
  const [logs, setLogs]       = useState(INITIAL_SYSTEM_LOGS);
  const [filter, setFilter]   = useState('ALL');
  const [search, setSearch]   = useState('');
  const [autoScroll, setAuto] = useState(true);
  const bottomRef             = useRef(null);

  // Dynamic log updates whenever ESP32 packets arrive
  useEffect(() => {
    if (esp32.latestTelemetry && esp32.packetsReceived > 0) {
      const t = esp32.latestTelemetry;
      const ts = new Date().toTimeString().slice(0, 8);
      const newEntry = {
        id: `rx-${Date.now()}-${esp32.packetsReceived}`,
        ts,
        level: 'INFO',
        src: 'ESP32_WS',
        msg: `Telemetry synced: ${Number(t.voltage || 230).toFixed(1)}V, ${Number(t.power || 0).toFixed(2)}kW, CT1: ${Number(t.current1 || 0).toFixed(2)}A, IR: ${t.ir_sensor ?? 1}`
      };
      setLogs(prev => [newEntry, ...prev.slice(0, 99)]);
    }
  }, [esp32.packetsReceived, esp32.latestTelemetry]);

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



// ─── Main Settings Page ───────────────────────────────────────────────────────
export function PortsConfigTab() {
  return <PortConfigTab />;
}

export default function SettingsPage({ onBack, defaultTab = 'port' }) {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (hash && ['device', 'port', 'controller', 'relay', 'peak', 'shedding', 'analytics', 'finance', 'recommendations', 'status', 'logs', 'notifications'].includes(hash)) {
      return hash;
    }
    return defaultTab;
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    try {
      window.location.hash = tabId;
    } catch {}
  };

  // Sync tab with URL hash if changed externally
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['device', 'port', 'controller', 'relay', 'peak', 'shedding', 'analytics', 'finance', 'recommendations', 'status', 'logs', 'notifications'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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
    device:          DeviceConfigTab,
    port:            PortConfigTab,
    controller:      RelayControllerTab,
    relay:           RelayControllerTab,
    peak:            LoadSheddingTab,
    shedding:        LoadSheddingTab,
    analytics:       PeakFinancialAnalysisTab,
    finance:         PeakFinancialAnalysisTab,
    recommendations: LoadRecommendationsTab,
    recom:           LoadRecommendationsTab,
    status:          Esp32Tab,
    logs:          LogsTab,
    notifications: NotificationsTab,
  };
  const ActivePanel = panels[activeTab] || PortConfigTab;

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
            <span className="ref-path-segment ref-path-segment--active">{activeTabObj.shortLabel || activeTabObj.label}</span>
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
                onClick={() => changeTab(tab.id)}
                title={tab.label}
              >
                <Icon size={15} className="ref-tab-icon" />
                <span className="ref-tab-label">{tab.shortLabel || tab.label}</span>
                {tab.hasDot && <span className="ref-tab-dot" />}
              </button>
            );
          })}
        </nav>

        {/* Right Action Icons matching reference image */}
        <div className="ref-nav-right">
          <div className="ref-esp-pill" title="ESP32 Hardware Online at 10.38.24.77">
            <span className="ref-esp-dot" />
            <span className="ref-esp-text">10.38.24.77</span>
          </div>
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
                      onClick={() => changeTab(tab.id)}
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
                            changeTab(tab.id);
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
