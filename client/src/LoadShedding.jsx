import React, { useState, useEffect } from 'react';
import {
  Zap, AlertTriangle, Shield, CheckCircle2, XCircle, Clock,
  ArrowRight, Plus, Trash2, ArrowUp, ArrowDown,
  Power, Calendar, Check, SlidersHorizontal, Info, ChevronUp, Sparkles
} from 'lucide-react';
import { useEsp32 } from './useEsp32.js';
import LoadRecommendationsTab from './LoadRecommendations.jsx';
import './LoadShedding.css';

const INITIAL_DEVICES = [
  {
    id: 'd1',
    name: 'Wi-Fi Router',
    port: 'P1',
    power: '18 W',
    powerNum: 18,
    priority: 'Critical',
    critical: true,
    shed: false,
    shift: false,
    state: 'ON',
    action: '🔒 Protected'
  },
  {
    id: 'd2',
    name: 'Mobile Charger',
    port: 'P2',
    power: '25 W',
    powerNum: 25,
    priority: 'Low',
    critical: false,
    shed: true,
    shift: true,
    state: 'ON',
    action: 'Standby'
  },
  {
    id: 'd3',
    name: 'Laptop',
    port: 'P3',
    power: '65 W',
    powerNum: 65,
    priority: 'Medium',
    critical: false,
    shed: true,
    shift: true,
    state: 'ON',
    action: 'Standby'
  },
  {
    id: 'd4',
    name: 'Iron Box',
    port: 'P4',
    power: '1000 W',
    powerNum: 1000,
    priority: 'Low',
    critical: false,
    shed: true,
    shift: false,
    state: 'Shed',
    action: 'Shed'
  }
];

const INITIAL_SCHEDULES = [
  { id: 1, device: 'Laptop', startTime: '09:00', endTime: '17:00', duration: '2 hours', days: 'Mon, Tue, Wed, Thu, Fri', shiftable: true, maxDelay: 60, status: 'Active', nextAction: 'Shift if peak' },
  { id: 2, device: 'Iron Box', startTime: '10:00', endTime: '12:00', duration: '2 hours', days: 'Mon, Tue, Wed, Thu, Fri', shiftable: true, maxDelay: 60, status: 'Pending', nextAction: 'Start 10:00' },
  { id: 3, device: 'Mobile Charger', startTime: '09:00', endTime: '18:00', duration: '9 hours', days: 'Mon, Tue, Wed, Thu, Fri', shiftable: true, maxDelay: 30, status: 'Active', nextAction: '—' }
];

const INITIAL_HISTORY = [
  { id: 1, time: '10:48', device: 'Iron Box', action: 'RESTORE', before: '3.70 kW', after: '4.70 kW', reason: 'Risk cleared', delta: '+1.00 kW' },
  { id: 2, time: '10:42', device: 'Iron Box', action: 'SHED', before: '4.82 kW', after: '3.82 kW', reason: 'Predicted peak', delta: '-1.00 kW' }
];

export default function LoadSheddingTab({ initialView = 'shedding' }) {
  const { sendCommand } = useEsp32();
  const [activeSubView, setActiveSubView] = useState(initialView);

  // 1. Peak Status / Summary State
  const [currentPower, setCurrentPower] = useState(3.42);
  const [peakLimit, setPeakLimit] = useState(5.00);
  const [predictedPeak, setPredictedPeak] = useState(5.38);

  // 2. Automatic Shedding State
  const [autoShedding, setAutoShedding] = useState(true);
  const [autoRestore, setAutoRestore] = useState(true);
  const [predictionEnabled, setPredictionEnabled] = useState(true);
  const [triggerThreshold, setTriggerThreshold] = useState(90); // 90%
  const [restoreThreshold, setRestoreThreshold] = useState(75); // 75%
  const [minHeadroom, setMinHeadroom] = useState(500); // 500 W

  // 3. Devices Table State
  const [devices, setDevices] = useState(INITIAL_DEVICES);

  // 4. Shedding Sequence State
  const [sequence, setSequence] = useState([
    { id: 'd4', name: 'Iron Box', power: '1000 W', color: 'red', protected: false },
    { id: 'd2', name: 'Mobile Charger', power: '25 W', color: 'yellow', protected: false },
    { id: 'd3', name: 'Laptop', power: '65 W', color: 'yellow', protected: false },
    { id: 'd1', name: 'Wi-Fi Router', power: '18 W', color: 'green', protected: true }
  ]);

  // 5. Schedules State & Add Form
  const [schedules, setSchedules] = useState(INITIAL_SCHEDULES);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newDevice, setNewDevice] = useState('Laptop');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('17:00');
  const [newDuration, setNewDuration] = useState('2 hours');
  const [selectedDays, setSelectedDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [newShiftable, setNewShiftable] = useState(true);
  const [newMaxDelay, setNewMaxDelay] = useState(60);

  // 6. History State
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [saveToast, setSaveToast] = useState('');

  // Fetch initial config from backend if available
  useEffect(() => {
    fetch('/api/shedding/config')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          const d = json.data;
          if (d.peakLimit) setPeakLimit(d.peakLimit);
          if (d.currentLoad) setCurrentPower(d.currentLoad);
          if (d.predictedLoad) setPredictedPeak(d.predictedLoad);
          if (d.autoShedding !== undefined) setAutoShedding(d.autoShedding);
          if (d.autoRestore !== undefined) setAutoRestore(d.autoRestore);
          if (d.predictionEnabled !== undefined) setPredictionEnabled(d.predictionEnabled);
          if (d.triggerThreshold) setTriggerThreshold(d.triggerThreshold);
          if (d.restoreThreshold) setRestoreThreshold(d.restoreThreshold);
          if (d.minHeadroom) setMinHeadroom(d.minHeadroom);
        }
      })
      .catch(() => {});

    fetch('/api/shedding/schedules')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setSchedules(json.data);
        }
      })
      .catch(() => {});

    fetch('/api/shedding/history')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setHistory(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Compute headroom and peak risk
  const headroom = (peakLimit - predictedPeak).toFixed(2);
  const isPeakRisk = predictedPeak > (peakLimit * triggerThreshold / 100);
  const triggerKW = ((peakLimit * triggerThreshold) / 100).toFixed(2);
  const restoreKW = ((peakLimit * restoreThreshold) / 100).toFixed(2);

  const activeCount = devices.filter(d => d.state === 'ON').length;
  const shedCount = devices.filter(d => d.state === 'Shed').length;

  // Actions on devices
  const handleDeviceAction = (devId, actionType) => {
    const targetDev = devices.find(d => d.id === devId);
    if (!targetDev) return;

    if (actionType === 'shed') {
      if (targetDev.critical) {
        alert('Cannot shed critical load: ' + targetDev.name);
        return;
      }
      const beforeStr = `${currentPower.toFixed(2)} kW`;
      const dropKW = targetDev.powerNum / 1000;
      const newCurr = Math.max(0.5, currentPower - dropKW);
      const afterStr = `${newCurr.toFixed(2)} kW`;

      setDevices(prev => prev.map(d => d.id === devId ? { ...d, state: 'Shed', action: 'Shed' } : d));
      setCurrentPower(newCurr);

      const newHist = {
        id: Date.now(),
        time: new Date().toTimeString().slice(0, 5),
        device: targetDev.name,
        action: 'SHED',
        before: beforeStr,
        after: afterStr,
        reason: 'Manual operator shed',
        delta: `-${dropKW.toFixed(2)} kW`
      };
      setHistory(prev => [newHist, ...prev]);

      // If connected to ESP32 relay, trigger hardware relay off
      if (sendCommand && targetDev.port) {
        const relayIdx = parseInt(targetDev.port.replace('P', ''), 10) || 1;
        sendCommand('relay_control', { relay: relayIdx, state: false });
      }

      setSaveToast(`Shed load for ${targetDev.name} (-${targetDev.power})`);
      setTimeout(() => setSaveToast(''), 3000);
    } else if (actionType === 'restore') {
      const beforeStr = `${currentPower.toFixed(2)} kW`;
      const addKW = targetDev.powerNum / 1000;
      const newCurr = currentPower + addKW;
      const afterStr = `${newCurr.toFixed(2)} kW`;

      setDevices(prev => prev.map(d => d.id === devId ? { ...d, state: 'ON', action: 'Standby' } : d));
      setCurrentPower(newCurr);

      const newHist = {
        id: Date.now(),
        time: new Date().toTimeString().slice(0, 5),
        device: targetDev.name,
        action: 'RESTORE',
        before: beforeStr,
        after: afterStr,
        reason: 'Manual restore',
        delta: `+${addKW.toFixed(2)} kW`
      };
      setHistory(prev => [newHist, ...prev]);

      if (sendCommand && targetDev.port) {
        const relayIdx = parseInt(targetDev.port.replace('P', ''), 10) || 1;
        sendCommand('relay_control', { relay: relayIdx, state: true });
      }

      setSaveToast(`Restored load for ${targetDev.name} (+${targetDev.power})`);
      setTimeout(() => setSaveToast(''), 3000);
    } else if (actionType === 'shift') {
      setDevices(prev => prev.map(d => d.id === devId ? { ...d, state: 'Shifted', action: 'Shifted' } : d));
      setSaveToast(`Scheduled shift delay for ${targetDev.name}`);
      setTimeout(() => setSaveToast(''), 3000);
    } else if (actionType === 'override') {
      setDevices(prev => prev.map(d => d.id === devId ? { ...d, state: 'ON', action: 'Overridden' } : d));
      setSaveToast(`Manual override locked for ${targetDev.name}`);
      setTimeout(() => setSaveToast(''), 3000);
    }
  };

  // Move sequence items
  const moveSequence = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= sequence.length) return;
    const copy = [...sequence];
    const item = copy.splice(index, 1)[0];
    copy.splice(newIdx, 0, item);
    setSequence(copy);
    setSaveToast('Updated shedding priority sequence.');
    setTimeout(() => setSaveToast(''), 2500);
  };

  // Add schedule
  const handleAddSchedule = (e) => {
    e.preventDefault();
    const newEntry = {
      id: Date.now(),
      device: newDevice,
      startTime: newStartTime,
      endTime: newEndTime,
      duration: newDuration,
      days: selectedDays.join(', '),
      shiftable: newShiftable,
      maxDelay: newMaxDelay,
      status: 'Active',
      nextAction: newShiftable ? 'Shift if peak' : '—'
    };
    setSchedules(prev => [...prev, newEntry]);
    setShowAddSchedule(false);
    setSaveToast(`Schedule created for ${newDevice} (${newStartTime}–${newEndTime})`);
    setTimeout(() => setSaveToast(''), 3000);
  };

  const handleDeleteSchedule = (id) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const filteredHistory = history.filter(h => {
    if (historyFilter === 'ALL') return true;
    return h.action === historyFilter;
  });

  return (
    <div className="ls-container">
      {/* ─── Top Switcher Strip: Shedding & Scheduling vs Load Recommendations Panel ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        background: '#ffffff',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`stg-btn stg-btn--sm ${activeSubView === 'shedding' ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
            onClick={() => setActiveSubView('shedding')}
          >
            <Zap size={14} /> Load Shedding & Scheduling (6 Phases)
          </button>
          <button
            type="button"
            className={`stg-btn stg-btn--sm ${activeSubView === 'recommendations' ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
            onClick={() => setActiveSubView('recommendations')}
            style={activeSubView === 'recommendations' ? { background: '#8b5cf6', borderColor: '#8b5cf6' } : {}}
          >
            <Sparkles size={14} /> Load Recommendation Panel (8 Phases)
          </button>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
          {activeSubView === 'shedding' ? '⚡ Phase 1–6 Mode' : '🤖 AI Load Recommendation Engine'}
        </span>
      </div>

      {activeSubView === 'recommendations' ? (
        <LoadRecommendationsTab onNavigateToShedding={() => setActiveSubView('shedding')} />
      ) : (
        <>
          {/* ─── PHASE 1: Peak Status — Top Summary ───────────────────────────────── */}
          <div className="ls-hero-card">
        <div className="ls-hero-top">
          <div className="ls-hero-title-wrap">
            <div className="ls-hero-icon"><Zap size={20} /></div>
            <div>
              <h1 className="ls-hero-title">LOAD SHEDDING & SCHEDULING</h1>
              <p className="ls-hero-subtitle">Automated peak shaving, intelligent load shedding, and shift coordination.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`ls-auto-pill ${autoShedding ? '' : 'ls-auto-pill--off'}`}>
              <span className={`stg-status-dot stg-status-dot--${autoShedding ? 'online' : 'offline'}`} />
              Auto ● {autoShedding ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* 4 Metrics Summary */}
        <div className="ls-summary-grid">
          <div className="ls-metric-card">
            <span className="ls-metric-label">Current Load</span>
            <span className="ls-metric-val">{currentPower.toFixed(2)} kW</span>
            <span className="ls-metric-sub">Active demand</span>
          </div>

          <div className="ls-metric-card">
            <span className="ls-metric-label">Peak Limit</span>
            <span className="ls-metric-val">{peakLimit.toFixed(2)} kW</span>
            <span className="ls-metric-sub">Contracted threshold</span>
          </div>

          <div className="ls-metric-card">
            <span className="ls-metric-label">Predicted Load</span>
            <span className="ls-metric-val">{predictedPeak.toFixed(2)} kW</span>
            <span className="ls-metric-sub">AI 15-min horizon</span>
          </div>

          <div className={`ls-metric-card ${Number(headroom) < 0 ? 'ls-metric-card--danger' : ''}`}>
            <span className="ls-metric-label">Available Headroom</span>
            <span className={`ls-metric-val ${Number(headroom) < 0 ? 'ls-metric-val--danger' : ''}`}>
              {headroom} kW
            </span>
            <span className="ls-metric-sub">Margin to ceiling</span>
          </div>
        </div>

        {/* Peak Risk Warning / Status Banner */}
        <div className={`ls-alert-banner ${isPeakRisk ? '' : 'ls-alert-banner--ok'}`}>
          <div className="ls-alert-left">
            {isPeakRisk ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>
              {isPeakRisk
                ? '⚠ PEAK RISK — SHEDDING REQUIRED (Predicted load exceeds 90% threshold)'
                : 'NORMAL — Headroom stable. All loads operating within safety envelope.'}
            </span>
          </div>
          <div className="ls-quick-counts">
            <span className="ls-count-badge">
              <span className="stg-status-dot stg-status-dot--online" />
              {activeCount} active loads
            </span>
            <span className="ls-count-badge">
              <span className="stg-status-dot stg-status-dot--offline" />
              {shedCount} shed loads
            </span>
          </div>
        </div>
      </div>

      {/* ─── PHASE 2: Automatic Load Shedding ─────────────────────────────────── */}
      <div className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-title-wrap">
            <SlidersHorizontal size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="ls-section-title">2. Automatic Load Shedding</h2>
              <p className="ls-section-desc">Controls automatic peak protection triggers, auto-restore logic, and prediction engine.</p>
            </div>
          </div>
        </div>

        {/* 3 Toggles */}
        <div className="ls-auto-grid">
          <div className="ls-toggle-card">
            <div>
              <div className="ls-toggle-title">Automatic Shedding</div>
              <div className="ls-toggle-sub">Shed loads when peak trigger breached</div>
            </div>
            <button
              type="button"
              className={`stg-btn stg-btn--sm ${autoShedding ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
              onClick={() => setAutoShedding(v => !v)}
            >
              {autoShedding ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="ls-toggle-card">
            <div>
              <div className="ls-toggle-title">Automatic Restore</div>
              <div className="ls-toggle-sub">Re-engage loads once risk clears</div>
            </div>
            <button
              type="button"
              className={`stg-btn stg-btn--sm ${autoRestore ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
              onClick={() => setAutoRestore(v => !v)}
            >
              {autoRestore ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="ls-toggle-card">
            <div>
              <div className="ls-toggle-title">Prediction Enabled</div>
              <div className="ls-toggle-sub">Pre-emptive shedding via forecasting</div>
            </div>
            <button
              type="button"
              className={`stg-btn stg-btn--sm ${predictionEnabled ? 'stg-btn--primary' : 'stg-btn--ghost'}`}
              onClick={() => setPredictionEnabled(v => !v)}
            >
              {predictionEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Threshold Inputs */}
        <div className="ls-thresholds-grid">
          <div className="ls-param-box">
            <label className="ls-param-label">Trigger Threshold</label>
            <div className="ls-input-wrap">
              <input
                type="number"
                value={triggerThreshold}
                onChange={e => setTriggerThreshold(Number(e.target.value))}
                min="50"
                max="99"
              />
              <span className="ls-input-addon">% ({triggerKW} kW)</span>
            </div>
          </div>

          <div className="ls-param-box">
            <label className="ls-param-label">Restore Threshold</label>
            <div className="ls-input-wrap">
              <input
                type="number"
                value={restoreThreshold}
                onChange={e => setRestoreThreshold(Number(e.target.value))}
                min="40"
                max="90"
              />
              <span className="ls-input-addon">% ({restoreKW} kW)</span>
            </div>
          </div>

          <div className="ls-param-box">
            <label className="ls-param-label">Minimum Headroom</label>
            <div className="ls-input-wrap">
              <input
                type="number"
                value={minHeadroom}
                onChange={e => setMinHeadroom(Number(e.target.value))}
                step="50"
              />
              <span className="ls-input-addon">W</span>
            </div>
          </div>
        </div>

        {/* Live Calculation Preview */}
        <div className="ls-example-calc">
          <Info size={16} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Peak Protection Trigger Rule:</strong> Peak limit is set to <strong>{peakLimit.toFixed(2)} kW</strong>.
            At <strong>{triggerThreshold}%</strong> threshold, shedding engages if predicted power reaches <strong>{triggerKW} kW</strong>.
            Current predicted power is <strong>{predictedPeak.toFixed(2)} kW</strong>, so the system automatically evaluates candidate loads.
          </div>
        </div>
      </div>

      {/* ─── PHASE 3: Device Shedding Table ───────────────────────────────────── */}
      <div className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-title-wrap">
            <Power size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="ls-section-title">3. Device Shedding Table</h2>
              <p className="ls-section-desc">Real-time status, shedding and shifting capabilities, and manual overrides.</p>
            </div>
          </div>
        </div>

        <div className="ls-table-wrap">
          <table className="ls-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Port</th>
                <th>Power</th>
                <th>Priority</th>
                <th>Critical</th>
                <th>Shed</th>
                <th>Shift</th>
                <th>State</th>
                <th>Action</th>
                <th>Action Buttons</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const isShed = d.state === 'Shed';
                const isShifted = d.state === 'Shifted';
                return (
                  <tr key={d.id} className={isShed ? 'ls-row--shed' : ''}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td><span className="ls-port-chip">{d.port}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{d.power}</td>
                    <td>
                      <span className={`ls-badge-prio ls-badge-prio--${d.priority.toLowerCase()}`}>
                        {d.priority}
                      </span>
                    </td>
                    <td>{d.critical ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#94a3b8" />}</td>
                    <td>{d.shed ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#94a3b8" />}</td>
                    <td>{d.shift ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#94a3b8" />}</td>
                    <td>
                      <span className={`ls-state-pill ls-state-pill--${isShed ? 'shed' : isShifted ? 'shift' : 'on'}`}>
                        {d.state}
                      </span>
                    </td>
                    <td>
                      {d.critical ? (
                        <span className="ls-protected-tag"><Shield size={12} /> Protected</span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isShed ? '#dc2626' : '#475569' }}>
                          {d.action}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="ls-action-buttons">
                        <button
                          type="button"
                          className="ls-btn-action ls-btn-action--shed"
                          onClick={() => handleDeviceAction(d.id, 'shed')}
                          disabled={d.critical || isShed}
                          title="Shed this load immediately"
                        >
                          Shed
                        </button>
                        <button
                          type="button"
                          className="ls-btn-action ls-btn-action--restore"
                          onClick={() => handleDeviceAction(d.id, 'restore')}
                          disabled={d.state === 'ON'}
                          title="Restore power to this device"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="ls-btn-action ls-btn-action--shift"
                          onClick={() => handleDeviceAction(d.id, 'shift')}
                          disabled={!d.shift || isShifted}
                          title="Shift load to later window"
                        >
                          Shift
                        </button>
                        <button
                          type="button"
                          className="ls-btn-action"
                          onClick={() => handleDeviceAction(d.id, 'override')}
                          title="Manual bypass override"
                        >
                          Override
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PHASE 4: Load Shedding Sequence ──────────────────────────────────── */}
      <div className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-title-wrap">
            <Shield size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="ls-section-title">4. Load Shedding Sequence</h2>
              <p className="ls-section-desc">Order in which the algorithm will shed loads during a peak event. Reorder to change priority.</p>
            </div>
          </div>
          <span className="ls-protected-tag">
            <Shield size={13} /> The router is configured as Critical and will NEVER be shed automatically
          </span>
        </div>

        <div className="ls-sequence-list">
          {sequence.map((item, idx) => (
            <div key={item.id} className={`ls-seq-item ${item.protected ? 'ls-seq-item--protected' : ''}`}>
              <div className="ls-seq-left">
                <span className="ls-seq-num">{idx + 1}</span>
                <span className={`ls-seq-dot ls-seq-dot--${item.color}`} />
                <span className="ls-seq-name">{item.name}</span>
                {item.protected && (
                  <span className="ls-protected-tag" style={{ marginLeft: '4px' }}>
                    <Shield size={12} /> PROTECTED
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="ls-seq-power">{item.power}</span>
                {!item.protected && (
                  <div className="ls-seq-actions">
                    <button
                      type="button"
                      className="ls-seq-btn"
                      onClick={() => moveSequence(idx, -1)}
                      disabled={idx === 0}
                      title="Increase shedding priority (shed earlier)"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="ls-seq-btn"
                      onClick={() => moveSequence(idx, 1)}
                      disabled={idx >= sequence.length - 2}
                      title="Decrease shedding priority (shed later)"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── PHASE 5: Scheduling / Load Shifting ──────────────────────────────── */}
      <div className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-title-wrap">
            <Calendar size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="ls-section-title">5. Scheduling / Load Shifting</h2>
              <p className="ls-section-desc">Define programmable runtime windows and shiftable delays to shave peak hours without loss of utility.</p>
            </div>
          </div>
          <button
            type="button"
            className="stg-btn stg-btn--primary stg-btn--sm"
            onClick={() => setShowAddSchedule(v => !v)}
          >
            {showAddSchedule ? <ChevronUp size={15} /> : <Plus size={15} />}
            {showAddSchedule ? 'Close Form' : '+ Add Schedule'}
          </button>
        </div>

        {/* Collapsible Add Schedule Form */}
        {showAddSchedule && (
          <form className="ls-schedule-form" onSubmit={handleAddSchedule}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
              Create Load Schedule
            </h3>
            <div className="ls-form-grid-3">
              <div className="ls-param-box">
                <label className="ls-param-label">Device</label>
                <select
                  className="stg-select"
                  value={newDevice}
                  onChange={e => setNewDevice(e.target.value)}
                >
                  <option value="Laptop">Laptop</option>
                  <option value="Iron Box">Iron Box</option>
                  <option value="Mobile Charger">Mobile Charger</option>
                  <option value="Water Heater">Water Heater</option>
                </select>
              </div>

              <div className="ls-param-box">
                <label className="ls-param-label">Start Time</label>
                <input
                  type="time"
                  className="stg-input"
                  value={newStartTime}
                  onChange={e => setNewStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="ls-param-box">
                <label className="ls-param-label">End Time</label>
                <input
                  type="time"
                  className="stg-input"
                  value={newEndTime}
                  onChange={e => setNewEndTime(e.target.value)}
                  required
                />
              </div>

              <div className="ls-param-box">
                <label className="ls-param-label">Duration</label>
                <input
                  type="text"
                  className="stg-input"
                  value={newDuration}
                  onChange={e => setNewDuration(e.target.value)}
                  placeholder="e.g. 2 hours"
                />
              </div>

              <div className="ls-param-box">
                <label className="ls-param-label">Shiftable During Peak?</label>
                <select
                  className="stg-select"
                  value={newShiftable ? 'YES' : 'NO'}
                  onChange={e => setNewShiftable(e.target.value === 'YES')}
                >
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </div>

              <div className="ls-param-box">
                <label className="ls-param-label">Maximum Delay (min)</label>
                <input
                  type="number"
                  className="stg-input"
                  value={newMaxDelay}
                  onChange={e => setNewMaxDelay(parseInt(e.target.value, 10) || 30)}
                  min="5"
                  step="5"
                />
              </div>
            </div>

            <div className="ls-param-box" style={{ marginBottom: '1.25rem' }}>
              <label className="ls-param-label">Active Days</label>
              <div className="ls-days-selector">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <button
                    key={day}
                    type="button"
                    className={`ls-day-chip ${selectedDays.includes(day) ? 'ls-day-chip--active' : ''}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="stg-btn stg-btn--ghost stg-btn--sm"
                onClick={() => setShowAddSchedule(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="stg-btn stg-btn--primary stg-btn--sm"
              >
                <Check size={14} /> Create Schedule
              </button>
            </div>
          </form>
        )}

        {/* Existing Schedules Table */}
        <div className="ls-table-wrap">
          <table className="ls-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Schedule</th>
                <th>Shiftable</th>
                <th>Status</th>
                <th>Next Action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.device}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.startTime}–{s.endTime} ({s.duration || '2 hrs'})
                  </td>
                  <td>
                    {s.shiftable ? (
                      <span className="ls-protected-tag">Yes (max {s.maxDelay}m)</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>No</span>
                    )}
                  </td>
                  <td>
                    <span className={`ls-state-pill ${s.status === 'Active' ? 'ls-state-pill--on' : 'ls-state-pill--shift'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                    {s.nextAction}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ls-seq-btn"
                      onClick={() => handleDeleteSchedule(s.id)}
                      title="Delete schedule"
                    >
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PHASE 6: Shedding & Scheduling History ───────────────────────────── */}
      <div className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-title-wrap">
            <Clock size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="ls-section-title">6. Shedding & Scheduling History</h2>
              <p className="ls-section-desc">Audit evidence and before/after verification logs for hackathon evaluation.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'SHED', 'RESTORE'].map(f => (
              <button
                key={f}
                type="button"
                className={`stg-filter-btn ${historyFilter === f ? 'active' : ''}`}
                onClick={() => setHistoryFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Timeline Cards */}
        <div className="ls-history-cards">
          {filteredHistory.map(h => (
            <div
              key={h.id}
              className={`ls-hist-card ${h.action === 'SHED' ? 'ls-hist-card--shed' : 'ls-hist-card--restore'}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="ls-hist-time">{h.time}</span>
                <span className={`ls-hist-action-pill ${h.action === 'SHED' ? 'ls-hist-action-pill--shed' : 'ls-hist-action-pill--restore'}`}>
                  {h.action}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{h.device}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Reason: <strong>{h.reason}</strong>
                </span>
                <div className="ls-hist-diff">
                  <span>Load: {h.before}</span>
                  <ArrowRight size={12} />
                  <span style={{ color: h.action === 'SHED' ? '#059669' : '#dc2626' }}>{h.after}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Structured Table */}
        <div className="ls-table-wrap">
          <table className="ls-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>Action</th>
                <th>Before Load</th>
                <th>After Load</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(h => (
                <tr key={h.id}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{h.time}</td>
                  <td style={{ fontWeight: 600 }}>{h.device}</td>
                  <td>
                    <span className={`ls-hist-action-pill ${h.action === 'SHED' ? 'ls-hist-action-pill--shed' : 'ls-hist-action-pill--restore'}`}>
                      {h.action}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{h.before}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: h.action === 'SHED' ? '#059669' : '#dc2626' }}>
                    {h.after}
                  </td>
                  <td style={{ color: '#475569' }}>{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

        </>
      )}

      {/* Save Notification Toast */}
      {saveToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontSize: '0.84rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={16} color="#4ade80" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
}
