import React, { useState, useEffect } from 'react';
import {
  Sparkles, AlertTriangle, Shield, CheckCircle2, XCircle, ArrowRight,
  Check, Power, RefreshCw, Cpu, Clock, HelpCircle, ChevronRight, SlidersHorizontal, Info
} from 'lucide-react';
import { useEsp32 } from './useEsp32.js';
import './LoadRecommendations.css';

const INITIAL_RECOMMENDED_LOADS = [
  { id: 'rec-1', name: 'Iron Box', port: 'P4', power: '1000 W', powerNum: 1000, priority: 'Low', critical: false, action: 'Shed', expectedReduction: '1000 W' },
  { id: 'rec-2', name: 'Laptop', port: 'P3', power: '65 W', powerNum: 65, priority: 'Medium', critical: false, action: 'Shift', expectedReduction: '65 W' },
  { id: 'rec-3', name: 'Mobile Charger', port: 'P2', power: '25 W', powerNum: 25, priority: 'Low', critical: false, action: 'Shed', expectedReduction: '25 W' },
  { id: 'rec-4', name: 'Wi-Fi Router', port: 'P1', power: '18 W', powerNum: 18, priority: 'Critical', critical: true, action: 'Protected', expectedReduction: '0 W' }
];

const INITIAL_HISTORY = [
  { id: 1, time: '10:50', device: 'Mobile Charger', recommendation: 'Shed', result: 'Executed' },
  { id: 2, time: '10:44', device: 'Laptop', recommendation: 'Shift', result: 'Rejected' },
  { id: 3, time: '10:42', device: 'Iron Box', recommendation: 'Shed', result: 'Accepted' }
];

export default function LoadRecommendationsTab({ onNavigateToShedding }) {
  const { sendCommand } = useEsp32();

  // Phase 1: Summary values
  const [currentLoad, setCurrentLoad] = useState(4.62);
  const peakLimit = 5.00;
  const predictedLoad = 5.34;
  const excessLoad = (predictedLoad - peakLimit).toFixed(2); // 0.34 kW = 340 W

  // Phase 2: Featured primary recommendation state
  const primaryRec = {
    device: 'Iron Box',
    port: 'PORT 4',
    relayPin: 'D7',
    power: '1000 W',
    priority: 'Low',
    critical: 'No',
    action: 'SHED',
    expectedReduction: '1000 W',
    reason: 'High power consumption + non-critical'
  };
  const [primaryIgnored, setPrimaryIgnored] = useState(false);
  const [primaryAccepted, setPrimaryAccepted] = useState(false);

  // Phase 7: Recommendation Controls mode
  const [autoExecuteSafe, setAutoExecuteSafe] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  // Phase 8: History
  const [recHistory, setRecHistory] = useState(INITIAL_HISTORY);
  const [toastMessage, setToastMessage] = useState('');

  // Fetch backend history if available
  useEffect(() => {
    fetch('/api/shedding/recommendations/history')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setRecHistory(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleShedNow = () => {
    const afterLoad = Math.max(0.5, currentLoad - 1.00);
    setCurrentLoad(afterLoad);
    setPrimaryAccepted(true);

    // If connected to ESP32, toggle relay D7 off
    if (sendCommand) {
      sendCommand('relay_control', { relay: 4, state: false });
    }

    const newHist = {
      id: Date.now(),
      time: new Date().toTimeString().slice(0, 5),
      device: 'Iron Box',
      recommendation: 'Shed',
      result: 'Accepted'
    };
    setRecHistory(prev => [newHist, ...prev]);

    // Send decision to backend
    fetch('/api/shedding/recommendations/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: 'Iron Box', recommendation: 'Shed', result: 'Accepted' })
    }).catch(() => {});

    setToastMessage('Accepted recommendation: Iron Box shed (-1000 W). Current load is now 3.62 kW.');
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleIgnore = () => {
    setPrimaryIgnored(true);
    const newHist = {
      id: Date.now(),
      time: new Date().toTimeString().slice(0, 5),
      device: 'Iron Box',
      recommendation: 'Shed',
      result: 'Rejected'
    };
    setRecHistory(prev => [newHist, ...prev]);

    fetch('/api/shedding/recommendations/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: 'Iron Box', recommendation: 'Shed', result: 'Rejected' })
    }).catch(() => {});

    setToastMessage('Ignored Iron Box shedding recommendation.');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAltAction = (devName, actionType, reduction) => {
    const newHist = {
      id: Date.now(),
      time: new Date().toTimeString().slice(0, 5),
      device: devName,
      recommendation: actionType,
      result: 'Executed'
    };
    setRecHistory(prev => [newHist, ...prev]);

    fetch('/api/shedding/recommendations/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: devName, recommendation: actionType, result: 'Executed' })
    }).catch(() => {});

    setToastMessage(`Executed ${actionType} on ${devName} (-${reduction})`);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAcceptAllSafe = () => {
    setCurrentLoad(3.53);
    setPrimaryAccepted(true);
    setToastMessage('Accepted all safe recommendations: Shed Iron Box (-1000 W) & Shift Laptop (-65 W).');
    setTimeout(() => setToastMessage(''), 4000);
  };

  return (
    <div className="lr-container">
      {/* ─── PHASE 1: Recommendation Summary ─────────────────────────────────── */}
      <div className="lr-hero-card">
        <div className="lr-hero-top">
          <div className="lr-hero-title-wrap">
            <div className="lr-hero-icon"><Sparkles size={20} /></div>
            <div>
              <h1 className="lr-hero-title">LOAD RECOMMENDATIONS</h1>
              <p className="lr-hero-subtitle">Intelligent AI recommendation engine for demand-shaving and peak avoidance.</p>
            </div>
          </div>
          <span className="lr-mode-pill">
            <span className="stg-status-dot stg-status-dot--online" />
            ● AI/Auto Mode Active
          </span>
        </div>

        <div className="lr-metrics-grid">
          <div className="lr-metric-box">
            <span className="lr-metric-label">Current Load</span>
            <span className="lr-metric-val">{currentLoad.toFixed(2)} kW</span>
            <span className="lr-metric-sub">Active consumption</span>
          </div>

          <div className="lr-metric-box">
            <span className="lr-metric-label">Peak Limit</span>
            <span className="lr-metric-val">{peakLimit.toFixed(2)} kW</span>
            <span className="lr-metric-sub">Contract ceiling</span>
          </div>

          <div className="lr-metric-box">
            <span className="lr-metric-label">Predicted Load</span>
            <span className="lr-metric-val">{predictedLoad.toFixed(2)} kW</span>
            <span className="lr-metric-sub">Upcoming 15m peak</span>
          </div>

          <div className="lr-metric-box lr-metric-box--alert">
            <span className="lr-metric-label">Excess Load</span>
            <span className="lr-metric-val lr-metric-val--alert">{excessLoad} kW</span>
            <span className="lr-metric-sub">{Math.round(excessLoad * 1000)} W over ceiling</span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="lr-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>⚠ Peak threshold may be exceeded. Recommended action: Shed / Shift non-critical loads</span>
          </div>
          <span style={{ fontSize: '0.8rem', background: '#ffffff', color: '#b91c1c', padding: '3px 9px', borderRadius: '4px' }}>
            Required cut: ≥ 340 W
          </span>
        </div>
      </div>

      {/* ─── PHASE 2: Recommended Loads (Overview + Featured Action) ──────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <Cpu size={18} style={{ color: '#8b5cf6' }} />
            <div>
              <h2 className="lr-section-title">2. Recommended Loads</h2>
              <p className="lr-section-desc">Possible actions listed in algorithmic priority order based on power rating and criticality.</p>
            </div>
          </div>
        </div>

        {/* Highlighted Primary Recommendation Card */}
        {!primaryIgnored && (
          <div className="lr-featured-card">
            <div className="lr-featured-top">
              <div className="lr-featured-title">
                <span style={{ color: '#ef4444' }}>🔴</span>
                <span>{primaryRec.device.toUpperCase()}</span>
                {primaryAccepted && (
                  <span className="ls-protected-tag" style={{ background: '#dcfce7', color: '#15803d' }}>
                    <CheckCircle2 size={13} /> SHED EXECUTED
                  </span>
                )}
              </div>
              <span className="lr-port-tag">{primaryRec.port} • {primaryRec.relayPin}</span>
            </div>

            <div className="lr-featured-grid">
              <div className="lr-feat-item">
                <span className="lr-feat-lbl">Current Power</span>
                <span className="lr-feat-val">{primaryRec.power}</span>
              </div>
              <div className="lr-feat-item">
                <span className="lr-feat-lbl">Priority</span>
                <span className="lr-feat-val">{primaryRec.priority}</span>
              </div>
              <div className="lr-feat-item">
                <span className="lr-feat-lbl">Critical</span>
                <span className="lr-feat-val">{primaryRec.critical}</span>
              </div>
              <div className="lr-feat-item">
                <span className="lr-feat-lbl">Expected Reduction</span>
                <span className="lr-feat-val" style={{ color: '#059669' }}>-{primaryRec.expectedReduction}</span>
              </div>
            </div>

            <div className="lr-featured-reason">
              <strong>Recommendation Reason:</strong> {primaryRec.reason}. Shedding this single load will bring total consumption down from <strong>4.62 kW</strong> to <strong>3.62 kW</strong>, well inside safe limits.
            </div>

            {!primaryAccepted ? (
              <div className="lr-featured-actions">
                <button
                  type="button"
                  className="stg-btn stg-btn--primary"
                  onClick={handleShedNow}
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                >
                  <Power size={15} /> Shed Now
                </button>
                <button
                  type="button"
                  className="stg-btn stg-btn--ghost"
                  onClick={handleIgnore}
                >
                  Ignore
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 600, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} /> Power to Iron Box isolated. Peak risk mitigated.
              </div>
            )}
          </div>
        )}

        {/* Priority Table of All Recommended Loads */}
        <div className="ls-table-wrap">
          <table className="ls-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Current Power</th>
                <th>Priority</th>
                <th>Action</th>
                <th>Expected Reduction</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {INITIAL_RECOMMENDED_LOADS.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{l.power}</td>
                  <td>
                    <span className={`ls-badge-prio ls-badge-prio--${l.priority.toLowerCase()}`}>
                      {l.priority}
                    </span>
                  </td>
                  <td>
                    {l.action === 'Protected' ? (
                      <span className="ls-protected-tag"><Shield size={12} /> Protected</span>
                    ) : (
                      <span className={`lr-alt-action-pill lr-alt-action-pill--${l.action.toLowerCase()}`}>
                        {l.action}
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: l.expectedReduction !== '0 W' ? '#059669' : '#94a3b8' }}>
                    {l.expectedReduction}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: l.critical ? '#059669' : '#64748b', fontWeight: 600 }}>
                      {l.critical ? '🔒 Excluded' : 'Eligible'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PHASE 3: Recommendation Reason ──────────────────────────────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <HelpCircle size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="lr-section-title">3. Recommendation Reason</h2>
              <p className="lr-section-desc">Transparent algorithmic rationale explaining why the system picked this specific candidate.</p>
            </div>
          </div>
        </div>

        <div className="lr-reason-card">
          <h3 className="lr-reason-title">
            <Info size={16} style={{ color: 'var(--color-accent)' }} />
            Why this device?
          </h3>
          <p className="lr-reason-text">
            <strong>Iron Box</strong> is consuming <strong>1000 W</strong> and is configured as a <strong>non-critical load</strong> with a low priority rating. Shedding it is expected to reduce the current load below the configured peak limit in a single step without disrupting operational continuity.
          </p>

          <div className="lr-reason-tags">
            <span className="lr-reason-tag">High current consumption</span>
            <span className="lr-reason-tag">Low priority</span>
            <span className="lr-reason-tag">Non-critical device</span>
            <span className="lr-reason-tag">Peak threshold approaching</span>
            <span className="lr-reason-tag">Predicted overload</span>
            <span className="lr-reason-tag">Device is currently shiftable</span>
            <span className="lr-reason-tag">Scheduled operation can be delayed</span>
            <span className="lr-reason-tag">Single-step ceiling resolution</span>
          </div>
        </div>
      </div>

      {/* ─── PHASE 4: Before / After Prediction ───────────────────────────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <SlidersHorizontal size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="lr-section-title">4. Before / After Prediction</h2>
              <p className="lr-section-desc">Simulated impact comparison demonstrating the headroom improvement before accepting the recommendation.</p>
            </div>
          </div>
        </div>

        <div className="lr-impact-grid">
          {/* BEFORE */}
          <div className="lr-impact-box">
            <div className="lr-impact-head">
              <span>BEFORE ACTION</span>
              <span style={{ color: '#b91c1c' }}>92.4% of Peak</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 600 }}>
              <span>Current: <strong>4.62 kW</strong></span>
              <span>Ceiling: <strong>5.00 kW</strong></span>
            </div>
            <div className="lr-impact-bar-wrap">
              <div className="lr-impact-bar lr-impact-bar--before" style={{ width: '92.4%' }} />
            </div>
            <span style={{ fontSize: '0.74rem', color: '#b91c1c', fontWeight: 600 }}>
              ⚠ Approaching trip boundary
            </span>
          </div>

          {/* AFTER */}
          <div className="lr-impact-box lr-impact-box--after">
            <div className="lr-impact-head">
              <span style={{ color: '#047857' }}>AFTER SHEDDING</span>
              <span style={{ color: '#047857' }}>72.4% of Peak</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 600 }}>
              <span>Expected: <strong style={{ color: '#047857' }}>3.62 kW</strong></span>
              <span>Ceiling: <strong>5.00 kW</strong></span>
            </div>
            <div className="lr-impact-bar-wrap">
              <div className="lr-impact-bar lr-impact-bar--after" style={{ width: '72.4%' }} />
            </div>
            <span style={{ fontSize: '0.74rem', color: '#047857', fontWeight: 600 }}>
              ✓ Safe headroom restored
            </span>
          </div>
        </div>

        {/* Metric Summary Strip */}
        <div className="lr-impact-summary-strip">
          <div>
            <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Expected Load Reduction</span>
            <strong style={{ color: '#059669', fontSize: '1.1rem' }}>-1.00 kW (20%)</strong>
          </div>
          <div style={{ borderLeft: '1px solid #e2e8f0', height: '28px' }} />
          <div>
            <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Expected Available Headroom</span>
            <strong style={{ color: '#1d64f2', fontSize: '1.1rem' }}>+1.38 kW</strong>
          </div>
          <div style={{ borderLeft: '1px solid #e2e8f0', height: '28px' }} />
          <div>
            <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Confidence Score</span>
            <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>98.4%</strong>
          </div>
        </div>
      </div>

      {/* ─── PHASE 5: Alternative Recommendations ─────────────────────────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <RefreshCw size={18} style={{ color: '#8b5cf6' }} />
            <div>
              <h2 className="lr-section-title">5. Alternative Recommendations</h2>
              <p className="lr-section-desc">Flexible alternatives allowing the operator to choose between abrupt shedding and load shifting.</p>
            </div>
          </div>
        </div>

        <div className="lr-alternatives-list">
          <div className="lr-alt-card">
            <div className="lr-alt-left">
              <span style={{ color: '#ef4444' }}>1.</span>
              <div>
                <span className="lr-alt-name">Shed Iron Box</span>
                <span className="lr-alt-red"> • Reduction: 1000 W</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="lr-alt-action-pill lr-alt-action-pill--shed">SHED</span>
              <button
                type="button"
                className="stg-btn stg-btn--sm stg-btn--primary"
                onClick={() => handleAltAction('Iron Box', 'Shed', '1000 W')}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                Execute Shed
              </button>
            </div>
          </div>

          <div className="lr-alt-card">
            <div className="lr-alt-left">
              <span style={{ color: '#1d64f2' }}>2.</span>
              <div>
                <span className="lr-alt-name">Shift Laptop</span>
                <span className="lr-alt-red"> • Reduction: 65 W (delay charging cycle)</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="lr-alt-action-pill lr-alt-action-pill--shift">SHIFT</span>
              <button
                type="button"
                className="stg-btn stg-btn--sm"
                onClick={() => handleAltAction('Laptop', 'Shift', '65 W')}
                style={{ color: '#1d64f2', borderColor: '#93c5fd' }}
              >
                Shift (Delay)
              </button>
            </div>
          </div>

          <div className="lr-alt-card">
            <div className="lr-alt-left">
              <span style={{ color: '#f59e0b' }}>3.</span>
              <div>
                <span className="lr-alt-name">Shed Mobile Charger</span>
                <span className="lr-alt-red"> • Reduction: 25 W</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="lr-alt-action-pill lr-alt-action-pill--shed">SHED</span>
              <button
                type="button"
                className="stg-btn stg-btn--sm stg-btn--ghost"
                onClick={() => handleAltAction('Mobile Charger', 'Shed', '25 W')}
              >
                Shed
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PHASE 6: Critical Device Protection ──────────────────────────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <Shield size={18} style={{ color: '#059669' }} />
            <div>
              <h2 className="lr-section-title">6. Critical Device Protection</h2>
              <p className="lr-section-desc">Hardware protection guardrails ensuring critical facility services are never interrupted.</p>
            </div>
          </div>
        </div>

        <div className="lr-protected-card">
          <div className="lr-prot-top">
            <Shield size={18} />
            <span>PROTECTED LOADS (Hardware Exclusions)</span>
          </div>

          <div className="lr-prot-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Wi-Fi Router</strong>
              <span className="ls-port-chip">P1 • D4</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#64748b' }}>18 W</span>
              <span className="ls-badge-prio ls-badge-prio--critical">CRITICAL</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="lr-blocked-badge">
                <Shield size={12} /> Auto-Shedding: BLOCKED
              </span>
              <span className="lr-blocked-badge">
                <Shield size={12} /> Auto-Shifting: BLOCKED
              </span>
            </div>
          </div>

          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.78rem', color: '#047857' }}>
            ✓ Critical devices are hard-locked in firmware logic and will never be selected as shedding candidates during automated peak control.
          </p>
        </div>
      </div>

      {/* ─── PHASE 7: Recommendation Controls ─────────────────────────────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <Power size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="lr-section-title">7. Recommendation Controls</h2>
              <p className="lr-section-desc">Execute bulk automated mitigations, override logic, or enforce manual operator gates.</p>
            </div>
          </div>
        </div>

        <div className="lr-controls-bar">
          <div className="lr-mode-radios">
            <label className="lr-mode-option">
              <input
                type="checkbox"
                checked={autoExecuteSafe}
                onChange={e => setAutoExecuteSafe(e.target.checked)}
              />
              <span>Automatically execute safe recommendations</span>
            </label>

            <label className="lr-mode-option">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={e => setRequireApproval(e.target.checked)}
              />
              <span>Require operator approval</span>
            </label>
          </div>

          <div className="lr-btn-group">
            <button
              type="button"
              className="stg-btn stg-btn--primary stg-btn--sm"
              onClick={handleShedNow}
            >
              <Check size={14} /> Accept Recommendation
            </button>
            <button
              type="button"
              className="stg-btn stg-btn--ghost stg-btn--sm"
              onClick={handleAcceptAllSafe}
            >
              Accept All Safe Actions
            </button>
            <button
              type="button"
              className="stg-btn stg-btn--danger stg-btn--sm"
              onClick={handleIgnore}
            >
              Reject
            </button>
            <button
              type="button"
              className="stg-btn stg-btn--ghost stg-btn--sm"
              onClick={() => {
                setToastMessage('Manual Override engaged. Automation temporarily suspended.');
                setTimeout(() => setToastMessage(''), 3000);
              }}
            >
              Manual Override
            </button>
          </div>
        </div>
      </div>

      {/* ─── PHASE 8: Recommendation History ──────────────────────────────────── */}
      <div className="lr-section">
        <div className="lr-section-header">
          <div className="lr-section-title-wrap">
            <Clock size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="lr-section-title">8. Recommendation History</h2>
              <p className="lr-section-desc">Historical timeline of suggestions generated, accepted, rejected, or autonomously executed.</p>
            </div>
          </div>
        </div>

        <div className="ls-table-wrap">
          <table className="lr-history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>Recommendation</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {recHistory.map((h, i) => (
                <tr key={h.id || i}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{h.time}</td>
                  <td style={{ fontWeight: 600 }}>{h.device}</td>
                  <td>
                    <span className={`lr-alt-action-pill ${h.recommendation === 'Shift' ? 'lr-alt-action-pill--shift' : 'lr-alt-action-pill--shed'}`}>
                      {h.recommendation}
                    </span>
                  </td>
                  <td>
                    <span className={`lr-res-pill lr-res-pill--${(h.result || 'Accepted').toLowerCase()}`}>
                      {h.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
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
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
