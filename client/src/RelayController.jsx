import React, { useState } from 'react';
import { 
  Wifi, 
  Cpu, 
  Zap, 
  Power, 
  Terminal, 
  Code, 
  Copy, 
  Check, 
  ArrowRight, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  Flame, 
  Laptop, 
  Smartphone, 
  Router,
  RefreshCw
} from 'lucide-react';
import { useEsp32 } from './useEsp32';
import { ESP32_UART_CONTROLLER_SKETCH, ARDUINO_UNO_RELAY_SKETCH } from './uartRelayFirmware';
import './RelayController.css';

const RELAYS = [
  {
    id: 'relay1',
    key: 'R1',
    number: 1,
    name: 'Wi-Fi Router',
    port: 'Port 1 (P-001)',
    pin: 'D4',
    icon: Router,
    specs: '230V · 12W · Critical Load',
    onCmd: 'R1_ON',
    offCmd: 'R1_OFF'
  },
  {
    id: 'relay2',
    key: 'R2',
    number: 2,
    name: 'Mobile Charger',
    port: 'Port 2 (P-002)',
    pin: 'D5',
    icon: Smartphone,
    specs: '230V · 25W · Non-Critical',
    onCmd: 'R2_ON',
    offCmd: 'R2_OFF'
  },
  {
    id: 'relay3',
    key: 'R3',
    number: 3,
    name: 'Laptop Workstation',
    port: 'Port 3 (P-003)',
    pin: 'D6',
    icon: Laptop,
    specs: '230V · 65W · Moderate Load',
    onCmd: 'R3_ON',
    offCmd: 'R3_OFF'
  },
  {
    id: 'relay4',
    key: 'R4',
    number: 4,
    name: 'Electric Iron',
    port: 'Port 4 (P-004)',
    pin: 'D7',
    icon: Flame,
    specs: '230V · 1200W · High Load / Shed Candidate',
    onCmd: 'R4_ON',
    offCmd: 'R4_OFF'
  }
];

const PROTOCOL_TABLE = [
  { action: 'Relay 1 ON', espSends: 'R1_ON', arduinoAction: 'Relay 1 ON', target: 'Port 1 (Pin D4)', code: 'R1_ON', type: 'on', url: 'http://10.38.24.77/relay/1/on' },
  { action: 'Relay 1 OFF', espSends: 'R1_OFF', arduinoAction: 'Relay 1 OFF', target: 'Port 1 (Pin D4)', code: 'R1_OFF', type: 'off', url: 'http://10.38.24.77/relay/1/off' },
  { action: 'Relay 2 ON', espSends: 'R2_ON', arduinoAction: 'Relay 2 ON', target: 'Port 2 (Pin D5)', code: 'R2_ON', type: 'on', url: 'http://10.38.24.77/relay/2/on' },
  { action: 'Relay 2 OFF', espSends: 'R2_OFF', arduinoAction: 'Relay 2 OFF', target: 'Port 2 (Pin D5)', code: 'R2_OFF', type: 'off', url: 'http://10.38.24.77/relay/2/off' },
  { action: 'Relay 3 ON', espSends: 'R3_ON', arduinoAction: 'Relay 3 ON', target: 'Port 3 (Pin D6)', code: 'R3_ON', type: 'on', url: 'http://10.38.24.77/relay/3/on' },
  { action: 'Relay 3 OFF', espSends: 'R3_OFF', arduinoAction: 'Relay 3 OFF', target: 'Port 3 (Pin D6)', code: 'R3_OFF', type: 'off', url: 'http://10.38.24.77/relay/3/off' },
  { action: 'Relay 4 ON', espSends: 'R4_ON', arduinoAction: 'Relay 4 ON', target: 'Port 4 (Pin D7)', code: 'R4_ON', type: 'on', url: 'http://10.38.24.77/relay/4/on' },
  { action: 'Relay 4 OFF', espSends: 'R4_OFF', arduinoAction: 'Relay 4 OFF', target: 'Port 4 (Pin D7)', code: 'R4_OFF', type: 'off', url: 'http://10.38.24.77/relay/4/off' },
  { action: 'All OFF', espSends: 'ALL_OFF', arduinoAction: 'All relays OFF', target: 'Relays 1-4 (D4-D7)', code: 'ALL_OFF', type: 'off', url: 'http://10.38.24.77/relay/all/off' },
  { action: 'All ON', espSends: 'ALL_ON', arduinoAction: 'All relays ON', target: 'Relays 1-4 (D4-D7)', code: 'ALL_ON', type: 'on', url: 'http://10.38.24.77/relay/all/on' }
];

export default function RelayController() {
  const { esp32, relayStates, uartLog, sendRelayCommand } = useEsp32();
  const [activeFwTab, setActiveFwTab] = useState('esp32');
  const [copiedFw, setCopiedFw] = useState(false);
  const [pendingCmd, setPendingCmd] = useState(null);

  const [testRunning, setTestRunning] = useState(false);

  const handleCommand = async (code) => {
    setPendingCmd(code);
    try {
      await sendRelayCommand(code);
    } finally {
      setTimeout(() => setPendingCmd(null), 300);
    }
  };

  const runTestSequence = async () => {
    setTestRunning(true);
    try {
      const seq = ['R1_ON', 'R2_ON', 'R3_ON', 'R4_ON', 'ALL_OFF'];
      for (const cmd of seq) {
        await handleCommand(cmd);
        await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      setTestRunning(false);
    }
  };

  const handleCopySketch = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedFw(true);
    setTimeout(() => setCopiedFw(false), 2000);
  };

  const activeCount = Object.values(relayStates || {}).filter(Boolean).length;

  return (
    <div className="rc-container">
      {/* ─── Hero Card & Live Architecture Flowchart ─────────────────────── */}
      <div className="rc-hero-card">
        <div className="rc-hero-top">
          <div className="rc-hero-title-wrap">
            <div className="rc-hero-icon">
              <Zap size={22} />
            </div>
            <div>
              <h2 className="rc-hero-title">ESP32 Wi-Fi to Arduino UART Relay Controller</h2>
              <p className="rc-hero-subtitle">
                Hardware Bridge Pipeline: Control physical relays over Wi-Fi via ESP32 UART commands to Arduino UNO
              </p>
            </div>
          </div>
          <div className="rc-link-pills">
            <span className={`rc-pill ${esp32.connected ? 'rc-pill--wifi' : 'rc-pill--off'}`}>
              <Wifi size={13} />
              {esp32.connected ? `ESP32 Wi-Fi Connected (${esp32.ip || '10.38.24.77'})` : 'ESP32 Wi-Fi Standby'}
            </span>
            <span className="rc-pill rc-pill--uart">
              <Cpu size={13} />
              UART 115200 baud (Serial2: TX 17, RX 16)
            </span>
            <span className="rc-pill" style={{ background: '#eff6ff', color: '#1d64f2', borderColor: '#bfdbfe' }}>
              <Activity size={13} />
              {activeCount} / 4 Relays Active
            </span>
          </div>
        </div>

        {/* Node Status Callout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.08)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Active Hardware Node:</span>
            <code style={{ fontSize: '0.82rem', color: '#1d64f2', fontWeight: 700, background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
              http://10.38.24.77
            </code>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>ESP32 Port 80 Relay API Ready</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a 
              href="http://10.38.24.77/relay?cmd=ALL_OFF" 
              target="_blank" 
              rel="noreferrer"
              style={{ fontSize: '0.74rem', fontWeight: 600, color: '#1d64f2', textDecoration: 'none', background: '#ffffff', padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1' }}
            >
              Test Direct Node Query ↗
            </a>
          </div>
        </div>

        {/* Visual Architecture Diagram */}
        <div className="rc-arch-card">
          <div className="rc-arch-title">
            <Activity size={14} color="#1d64f2" />
            Current Hardware Pipeline Architecture
          </div>
          <div className="rc-arch-diagram">
            {/* Step 1: Dashboard */}
            <div className="rc-arch-node">
              <div className="rc-arch-node-name">
                <Laptop size={16} color="#0284c7" />
                Dashboard UI
              </div>
              <div className="rc-arch-node-sub">Web / React Client</div>
              <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 700, marginTop: 4 }}>● Online</span>
            </div>

            {/* Connection: Wi-Fi */}
            <div className="rc-arch-link">
              <span className="rc-arch-link-text">Wi-Fi / WS</span>
              <div className="rc-arch-link-line" />
              <ArrowRight size={14} color="#1d64f2" />
            </div>

            {/* Step 2: ESP32 */}
            <div className="rc-arch-node">
              <div className="rc-arch-node-name">
                <Wifi size={16} color="#059669" />
                ESP32 DevKit
              </div>
              <div className="rc-arch-node-sub">Web/API Controller</div>
              <span style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 700, marginTop: 4 }}>
                TX2 (17) ➔ RX2 (16)
              </span>
            </div>

            {/* Connection: UART */}
            <div className="rc-arch-link">
              <span className="rc-arch-link-text">UART (115200)</span>
              <div className="rc-arch-link-line" />
              <ArrowRight size={14} color="#8b5cf6" />
            </div>

            {/* Step 3: Arduino UNO */}
            <div className="rc-arch-node">
              <div className="rc-arch-node-name">
                <Cpu size={16} color="#7c3aed" />
                Arduino UNO
              </div>
              <div className="rc-arch-node-sub">Hardware Receiver</div>
              <span style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: 700, marginTop: 4 }}>
                ATmega328P
              </span>
            </div>

            {/* Connection: GPIO Relays */}
            <div className="rc-arch-link">
              <span className="rc-arch-link-text">D4, D5, D6, D7</span>
              <div className="rc-arch-link-line" />
              <ArrowRight size={14} color="#ea580c" />
            </div>

            {/* Step 4: Relays 1-4 */}
            <div className="rc-arch-relays-branch">
              {RELAYS.map(r => {
                const isOn = !!relayStates[r.id];
                return (
                  <div key={r.id} className={`rc-arch-relay-chip ${isOn ? 'active' : 'inactive'}`}>
                    <span>{r.key}:</span>
                    <span>{isOn ? 'ON' : 'OFF'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 Relay Control Action Cards ─────────────────────────────────── */}
      <div className="rc-cards-grid">
        {RELAYS.map(relay => {
          const isOn = !!relayStates[relay.id];
          const RelayIcon = relay.icon;
          const isPending = pendingCmd === relay.onCmd || pendingCmd === relay.offCmd;

          return (
            <div key={relay.id} className={`rc-relay-card ${isOn ? 'rc-relay-card--active' : ''}`}>
              <div>
                <div className="rc-relay-header">
                  <div>
                    <span className="rc-relay-number">Relay {relay.number}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className="rc-relay-pin">Pin {relay.pin}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{relay.port}</span>
                      {(relay.number === 3 || relay.number === 4) && (
                        <span style={{ fontSize: '0.68rem', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                          ⚡ Polarity Inverted
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`rc-relay-state-pill ${isOn ? 'rc-relay-state-pill--on' : 'rc-relay-state-pill--off'}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOn ? '#16a34a' : '#94a3b8' }} />
                    {isOn ? 'ENERGIZED (ON)' : 'OPEN (OFF)'}
                  </span>
                </div>

                <div className="rc-relay-body" style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 6, 
                      background: isOn ? '#dcfce7' : '#f1f5f9', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: isOn ? '#15803d' : '#64748b'
                    }}>
                      <RelayIcon size={16} />
                    </div>
                    <div>
                      <span className="rc-relay-device-name">{relay.name}</span>
                      <div className="rc-relay-specs">{relay.specs}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="rc-relay-protocol-code">
                        UART: {isOn ? relay.offCmd : relay.onCmd}
                      </span>
                    </div>
                    <a
                      href={`http://10.38.24.77/relay/${relay.number}/${isOn ? 'off' : 'on'}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        color: '#0369a1',
                        textDecoration: 'none',
                        background: '#e0f2fe',
                        padding: '2px 6px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        width: 'fit-content'
                      }}
                      title={`Direct HTTP GET request to http://10.38.24.77/relay/${relay.number}/${isOn ? 'off' : 'on'}`}
                    >
                      REST: /relay/{relay.number}/{isOn ? 'off' : 'on'} ↗
                    </a>
                  </div>
                </div>
              </div>

              <div className="rc-relay-actions">
                <button
                  type="button"
                  className="rc-btn-on"
                  disabled={isOn || isPending}
                  onClick={() => handleCommand(relay.onCmd)}
                  title={`Send ${relay.onCmd} over ESP32 UART to turn Relay ${relay.number} ON`}
                >
                  <Power size={14} />
                  {relay.name} ON ({relay.key}_ON)
                </button>
                <button
                  type="button"
                  className="rc-btn-off"
                  disabled={!isOn || isPending}
                  onClick={() => handleCommand(relay.offCmd)}
                  title={`Send ${relay.offCmd} over ESP32 UART to turn Relay ${relay.number} OFF`}
                >
                  <Power size={14} />
                  {relay.name} OFF ({relay.key}_OFF)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Master Controller Strip ───────────────────────────────────────── */}
      <div className="rc-master-strip">
        <div className="rc-master-left">
          <span className="rc-master-title">Master Relay Bus Controls</span>
          <span className="rc-master-desc">
            Broadcast mass control frames directly across the ESP32 ➔ Arduino UART link
          </span>
        </div>
        <div className="rc-master-buttons">
          <button
            type="button"
            className="rc-btn-all-on"
            style={{ background: '#7c3aed', borderColor: '#6d28d9' }}
            onClick={runTestSequence}
            disabled={testRunning}
            title="Automatically tests R1 -> R2 -> R3 -> R4 then sheds all"
          >
            <RefreshCw size={15} className={testRunning ? 'animate-spin' : ''} />
            {testRunning ? 'Testing Relays...' : 'Test Sequence (R1➔R4➔OFF)'}
          </button>
          <button
            type="button"
            className="rc-btn-all-on"
            onClick={() => handleCommand('ALL_ON')}
            disabled={pendingCmd === 'ALL_ON' || testRunning}
          >
            <Power size={15} />
            Turn All Relays ON (ALL_ON)
          </button>
          <button
            type="button"
            className="rc-btn-emergency"
            onClick={() => handleCommand('ALL_OFF')}
            disabled={pendingCmd === 'ALL_OFF' || testRunning}
          >
            <AlertTriangle size={15} />
            Emergency Shed All OFF (ALL_OFF)
          </button>
        </div>
      </div>

      {/* ─── Protocol Reference Table ─────────────────────────────────────── */}
      <div className="rc-section">
        <div className="rc-section-header">
          <h3 className="rc-section-title">ESP32 ➔ Arduino Command Protocol Mapping</h3>
          <p className="rc-section-desc">
            Standardized UART command set sent from Dashboard to ESP32 over Wi-Fi, and piped down to Arduino UNO over Hardware Serial2.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="rc-protocol-table">
            <thead>
              <tr>
                <th>Dashboard Action</th>
                <th>HTTP REST Request</th>
                <th>ESP32 Sends (UART)</th>
                <th>Arduino Action</th>
                <th>Hardware Pin / Target</th>
                <th>Quick Trigger</th>
              </tr>
            </thead>
            <tbody>
              {PROTOCOL_TABLE.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{item.action}</strong>
                  </td>
                  <td>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        color: '#0369a1',
                        background: '#e0f2fe',
                        padding: '3px 8px',
                        borderRadius: 4,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        border: '1px solid #bae6fd'
                      }}
                      title="Open direct HTTP request in new tab"
                    >
                      {item.url} ↗
                    </a>
                  </td>
                  <td>
                    <span className="rc-code-badge">{item.espSends}</span>
                  </td>
                  <td>
                    <span className={`rc-action-pill ${item.type === 'on' ? 'rc-action-pill--on' : 'rc-action-pill--off'}`}>
                      {item.arduinoAction}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', color: '#475569' }}>{item.target}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleCommand(item.code)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Zap size={11} color="#1d64f2" />
                      Send {item.code}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Real-time UART Bus Log Terminal ───────────────────────────────── */}
      <div className="rc-section">
        <div className="rc-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="rc-section-title">Live UART Command Frame Stream</h3>
            <p className="rc-section-desc">
              Real-time audit log of Wi-Fi commands forwarded by ESP32 to Arduino UNO over UART Serial2
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
              STREAM ACTIVE (115200 8N1)
            </span>
          </div>
        </div>

        <div className="rc-terminal-box">
          <div className="rc-terminal-header">
            <div className="rc-terminal-dots">
              <span className="rc-term-dot rc-term-dot--red" />
              <span className="rc-term-dot rc-term-dot--amber" />
              <span className="rc-term-dot rc-term-dot--green" />
            </div>
            <div className="rc-terminal-title">ESP32 ↔ ARDUINO UNO SERIAL CONSOLE</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>BUFFER: 50 FRAMES</div>
          </div>

          <div className="rc-terminal-body">
            {uartLog && uartLog.length > 0 ? (
              uartLog.map((log, i) => (
                <div key={i} className="rc-term-line">
                  <span className="rc-term-ts">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="rc-term-src">[{log.source}]</span>
                  <span className="rc-term-cmd">➔ {log.code}</span>
                  <span className="rc-term-echo">· {log.action} ({log.pin})</span>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontStyle: 'italic', padding: '8px 0' }}>
                [READY] Waiting for dashboard commands. Click any "ON" or "OFF" button above to dispatch UART frames.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Production Firmware Source Codes ──────────────────────────────── */}
      <div className="rc-section">
        <div className="rc-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 className="rc-section-title">Hardware Firmware Codes (Ready to Flash)</h3>
            <p className="rc-section-desc">
              Complete, production-tested Arduino C++ sketches for the ESP32 Web/API bridge and Arduino UNO receiver.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCopySketch(activeFwTab === 'esp32' ? ESP32_UART_CONTROLLER_SKETCH : ARDUINO_UNO_RELAY_SKETCH)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#1d64f2',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {copiedFw ? <Check size={14} /> : <Copy size={14} />}
            {copiedFw ? 'Copied to Clipboard!' : 'Copy Active Sketch'}
          </button>
        </div>

        <div className="rc-firmware-tabs">
          <button
            type="button"
            className={`rc-fw-tab-btn ${activeFwTab === 'esp32' ? 'rc-fw-tab-btn--active' : ''}`}
            onClick={() => setActiveFwTab('esp32')}
          >
            ESP32 Web/API Controller Sketch (.ino)
          </button>
          <button
            type="button"
            className={`rc-fw-tab-btn ${activeFwTab === 'arduino' ? 'rc-fw-tab-btn--active' : ''}`}
            onClick={() => setActiveFwTab('arduino')}
          >
            Arduino UNO Relay Controller Sketch (.ino)
          </button>
        </div>

        <pre className="rc-code-pre">
          <code>
            {activeFwTab === 'esp32' ? ESP32_UART_CONTROLLER_SKETCH : ARDUINO_UNO_RELAY_SKETCH}
          </code>
        </pre>
      </div>
    </div>
  );
}
