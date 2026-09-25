import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { getPool } from '../config/db.js';
import { updateRelayState, getEsp32State, broadcastToFrontend } from '../services/esp32Socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PREDICTOR_SCRIPT = path.resolve(__dirname, '../ml/lightgbm_peak_predictor.py');

/**
 * Resolves device name or port identifier to hardware relay channel (1 - 4)
 */
export function resolveDeviceRelay(identifier) {
  if (!identifier) return null;
  const str = String(identifier).toLowerCase().trim();
  if (str.includes('p1') || str.includes('port 1') || str.includes('router') || str.includes('wifi') || str.includes('wi-fi') || str.includes('r1') || str.includes('relay 1')) return 1;
  if (str.includes('p2') || str.includes('port 2') || str.includes('charger') || str.includes('mobile') || str.includes('phone') || str.includes('r2') || str.includes('relay 2')) return 2;
  if (str.includes('p3') || str.includes('port 3') || str.includes('laptop') || str.includes('workstation') || str.includes('pc') || str.includes('computer') || str.includes('r3') || str.includes('relay 3')) return 3;
  if (str.includes('p4') || str.includes('port 4') || str.includes('iron') || str.includes('water') || str.includes('heater') || str.includes('thermal') || str.includes('kettle') || str.includes('r4') || str.includes('relay 4')) return 4;
  const match = str.match(/\b(?:p|r|port|relay)?[-_\s]?([1-4])\b/);
  if (match) return parseInt(match[1], 10);
  return null;
}

// GET /api/shedding/config
export const getConfig = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const [rows] = await pool.query('SELECT * FROM shedding_config WHERE id = 1');
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          peakLimit: 5.00,
          currentLoad: 3.42,
          predictedLoad: 5.38,
          autoShedding: true,
          autoRestore: true,
          predictionEnabled: true,
          triggerThreshold: 90.0,
          restoreThreshold: 75.0,
          minHeadroom: 500.0
        }
      });
    }

    const c = rows[0];
    res.json({
      success: true,
      data: {
        peakLimit: Number(c.peak_limit),
        currentLoad: Number(c.current_load),
        predictedLoad: Number(c.predicted_load),
        autoShedding: Boolean(c.auto_shedding),
        autoRestore: Boolean(c.auto_restore),
        predictionEnabled: Boolean(c.prediction_enabled),
        triggerThreshold: Number(c.trigger_threshold),
        restoreThreshold: Number(c.restore_threshold),
        minHeadroom: Number(c.min_headroom)
      }
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/shedding/config
export const updateConfig = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const b = req.body;
    await pool.query(`
      UPDATE shedding_config SET
        peak_limit = COALESCE(?, peak_limit),
        current_load = COALESCE(?, current_load),
        predicted_load = COALESCE(?, predicted_load),
        auto_shedding = COALESCE(?, auto_shedding),
        auto_restore = COALESCE(?, auto_restore),
        prediction_enabled = COALESCE(?, prediction_enabled),
        trigger_threshold = COALESCE(?, trigger_threshold),
        restore_threshold = COALESCE(?, restore_threshold),
        min_headroom = COALESCE(?, min_headroom)
      WHERE id = 1
    `, [
      b.peakLimit !== undefined ? b.peakLimit : null,
      b.currentLoad !== undefined ? b.currentLoad : null,
      b.predictedLoad !== undefined ? b.predictedLoad : null,
      b.autoShedding !== undefined ? b.autoShedding : null,
      b.autoRestore !== undefined ? b.autoRestore : null,
      b.predictionEnabled !== undefined ? b.predictionEnabled : null,
      b.triggerThreshold !== undefined ? b.triggerThreshold : null,
      b.restoreThreshold !== undefined ? b.restoreThreshold : null,
      b.minHeadroom !== undefined ? b.minHeadroom : null
    ]);

    res.json({ success: true, message: 'Load shedding configuration updated' });
  } catch (err) {
    next(err);
  }
};

// GET /api/shedding/schedules
export const getSchedules = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const [rows] = await pool.query('SELECT * FROM load_schedules ORDER BY id ASC');
    res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        device: r.device_name,
        startTime: r.start_time,
        endTime: r.end_time,
        duration: r.duration,
        days: r.days,
        shiftable: Boolean(r.shiftable),
        maxDelay: r.max_delay_min,
        status: r.status,
        nextAction: r.next_action
      }))
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/shedding/schedules
export const createSchedule = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const { device, startTime, endTime, duration, days, shiftable, maxDelay, status, nextAction } = req.body;
    const [result] = await pool.query(`
      INSERT INTO load_schedules (device_name, start_time, end_time, duration, days, shiftable, max_delay_min, status, next_action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      device || 'Laptop',
      startTime || '09:00',
      endTime || '17:00',
      duration || '2 hours',
      days || 'Mon, Tue, Wed, Thu, Fri',
      shiftable !== undefined ? shiftable : true,
      maxDelay || 60,
      status || 'Active',
      nextAction || 'Shift if peak'
    ]);

    res.json({
      success: true,
      id: result.insertId,
      message: 'Schedule created successfully'
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/shedding/schedules/:id
export const deleteSchedule = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    await pool.query('DELETE FROM load_schedules WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/shedding/schedules/:id/toggle (Toggle Active / Paused)
export const toggleScheduleStatus = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const [rows] = await pool.query('SELECT * FROM load_schedules WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Schedule not found' });

    const newStatus = rows[0].status === 'Active' ? 'Paused' : 'Active';
    await pool.query('UPDATE load_schedules SET status = ? WHERE id = ?', [newStatus, req.params.id]);

    res.json({ success: true, message: `Schedule status updated to ${newStatus}`, status: newStatus });
  } catch (err) {
    next(err);
  }
};

// POST /api/shedding/schedules/:id/run-now (Realtime Operator Trigger on Physical Relay)
export const triggerScheduleNow = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const [rows] = await pool.query('SELECT * FROM load_schedules WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Schedule not found' });

    const sch = rows[0];
    let relayNum = resolveDeviceRelay(sch.device_name);
    if (!relayNum) {
      const [dRows] = await pool.query('SELECT port FROM devices WHERE name = ? LIMIT 1', [sch.device_name]);
      if (dRows.length > 0 && dRows[0].port) {
        relayNum = parseInt(String(dRows[0].port).replace(/\D/g, ''), 10);
      }
    }
    if (!relayNum) {
      return res.status(400).json({ success: false, error: `Could not resolve relay for ${sch.device_name}` });
    }

    const relayCode = `R${relayNum}_ON`;
    console.log(`⚡ [REALTIME SCHEDULE TRIGGER NOW] Actuating ${relayCode} on ESP32 for ${sch.device_name}`);
    await updateRelayState(relayCode);

    const currentTimeStr = new Date().toTimeString().slice(0, 5);
    if (pool) {
      await pool.query(`
        INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason)
        VALUES (?, ?, 'SCHEDULE_RUN', '3.42 kW', '4.42 kW', ?)
      `, [
        currentTimeStr,
        sch.device_name,
        `Realtime run trigger: schedule window ${sch.start_time}–${sch.end_time} energized on Relay ${relayNum}`
      ]).catch(() => {});
    }

    res.json({
      success: true,
      message: `Triggered real-time run for ${sch.device_name} (Relay ${relayNum} energized)`,
      relayCode,
      relayNum
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/shedding/history
export const getHistory = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const [rows] = await pool.query('SELECT * FROM shedding_history ORDER BY id DESC LIMIT 50');
    res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        time: r.time_str,
        device: r.device_name,
        action: r.action,
        before: r.before_load,
        after: r.after_load,
        reason: r.reason,
        timestamp: r.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/shedding/action (Ties Device Shed/Restore directly to Hardware Relay Pin)
export const triggerAction = async (req, res, next) => {
  try {
    const pool = getPool();
    const { device, action, beforeLoad, afterLoad, reason } = req.body;
    const actionUpper = (action || 'SHED').toUpperCase();

    // 1. Resolve to physical relay channel
    const relayNum = resolveDeviceRelay(device);
    let relayCode = null;

    if (relayNum) {
      // SHED = turn relay OFF; RESTORE = turn relay ON
      const desiredState = actionUpper === 'SHED' ? 'OFF' : 'ON';
      relayCode = `R${relayNum}_${desiredState}`;
      
      console.log(`🔌 [SHEDDING ACTION] Actuating physical relay: ${relayCode} for device: ${device}`);
      await updateRelayState(relayCode);
    }

    // 2. Update device status in database
    if (pool && device) {
      const devStatus = actionUpper === 'SHED' ? 'shed' : 'online';
      await pool.query(
        'UPDATE devices SET status = ? WHERE name LIKE ? OR port LIKE ?',
        [devStatus, `%${device}%`, `%${device}%`]
      ).catch(() => {});
    }

    // 3. Record in shedding history
    const timeStr = new Date().toTimeString().slice(0, 5);
    if (pool) {
      await pool.query(`
        INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        timeStr,
        device || 'Unknown Device',
        actionUpper,
        beforeLoad || '4.82 kW',
        afterLoad || '3.82 kW',
        reason || (relayCode ? `Hardware actuation ${relayCode}` : 'Manual operator action')
      ]);
    }

    res.json({
      success: true,
      message: `Action ${actionUpper} executed on hardware relay ${relayCode || 'N/A'} for ${device}`,
      relayCode,
      device
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/shedding/recommendations/history
export const getRecommendationHistory = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database not connected' });

    const [rows] = await pool.query('SELECT * FROM recommendation_history ORDER BY id DESC LIMIT 50');
    res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        time: r.time_str,
        device: r.device_name,
        recommendation: r.recommendation,
        result: r.result,
        timestamp: r.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/shedding/recommendations/decision
export const recordRecommendationDecision = async (req, res, next) => {
  try {
    const pool = getPool();
    const { device, recommendation, result } = req.body;
    const timeStr = new Date().toTimeString().slice(0, 5);

    if (pool) {
      await pool.query(`
        INSERT INTO recommendation_history (time_str, device_name, recommendation, result)
        VALUES (?, ?, ?, ?)
      `, [
        timeStr,
        device || 'Iron Box',
        recommendation || 'Shed',
        result || 'Accepted'
      ]);
    }

    // If accepted shedding, trigger physical relay off
    if (result === 'Accepted') {
      const relayNum = resolveDeviceRelay(device);
      if (relayNum) {
        const isShed = (recommendation || '').toLowerCase().includes('shed');
        await updateRelayState(`R${relayNum}_${isShed ? 'OFF' : 'ON'}`);
      }
    }

    res.json({
      success: true,
      message: `Recorded ${result} decision for ${device}`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/shedding/predict-lgb
 * Runs genuine LightGBM regression model to predict 24h load profile,
 * detect peak ceiling breaches, calculate ToU economics & provide shedding plan
 */
export const getLgbPredictions = async (req, res, next) => {
  try {
    const pool = getPool();
    let peakLimit = 5.00;
    let currentLoad = 3.42;

    if (req.query.limit) {
      peakLimit = parseFloat(req.query.limit) || 5.00;
    } else if (pool) {
      const [rows] = await pool.query('SELECT peak_limit, current_load FROM shedding_config WHERE id = 1');
      if (rows.length > 0) {
        peakLimit = parseFloat(rows[0].peak_limit) || 5.00;
        currentLoad = parseFloat(rows[0].current_load) || 3.42;
      }
    }

    // Check live ESP32 telemetry power if available
    const esp = getEsp32State();
    if (esp?.latestTelemetry?.power) {
      currentLoad = parseFloat(esp.latestTelemetry.power) || currentLoad;
    }

    const args = [
      PREDICTOR_SCRIPT,
      '--predict',
      '--limit', String(peakLimit),
      '--current', String(currentLoad)
    ];

    execFile('python', args, { maxBuffer: 1024 * 1024 * 5 }, async (err, stdout, stderr) => {
      if (err) {
        console.error('LightGBM execution error:', err.message, stderr);
        return res.status(500).json({
          success: false,
          error: 'LightGBM predictor failed to execute',
          details: err.message
        });
      }

      try {
        const lgbData = JSON.parse(stdout);

        // Update database with latest predicted peak load
        if (pool && lgbData?.summary?.max_predicted_peak_kw) {
          await pool.query(
            'UPDATE shedding_config SET current_load = ?, predicted_load = ? WHERE id = 1',
            [currentLoad, lgbData.summary.max_predicted_peak_kw]
          ).catch(() => {});
        }

        res.json({
          success: true,
          data: lgbData
        });
      } catch (parseErr) {
        console.error('JSON parse error from LightGBM output:', parseErr, stdout);
        res.status(500).json({
          success: false,
          error: 'Failed to parse LightGBM JSON output',
          raw: stdout
        });
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Background Shedding & Scheduling Daemon
 * Connects Relay Controller -> Device -> Realtime Scheduling and Shedding
 */
let daemonStarted = false;
export function startSheddingEngine() {
  if (daemonStarted) return;
  daemonStarted = true;

  console.log('⚡ [SHEDDING ENGINE] LightGBM Realtime Automation & Scheduler Daemon active');

  setInterval(async () => {
    try {
      const pool = getPool();
      if (!pool) return;

      const [cfgRows] = await pool.query('SELECT * FROM shedding_config WHERE id = 1');
      if (cfgRows.length === 0) return;
      const cfg = cfgRows[0];

      const esp = getEsp32State();
      const currentPower = esp?.latestTelemetry?.power != null
        ? parseFloat(esp.latestTelemetry.power)
        : parseFloat(cfg.current_load) || 3.42;

      const peakLimit = parseFloat(cfg.peak_limit) || 5.00;
      const triggerThreshold = parseFloat(cfg.trigger_threshold) || 90.0;
      const restoreThreshold = parseFloat(cfg.restore_threshold) || 75.0;

      // ─── 1. REALTIME SCHEDULE EVALUATION ───
      const [schedules] = await pool.query("SELECT * FROM load_schedules WHERE status = 'Active'");
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeVal = currentHours * 60 + currentMinutes;
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
      const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];

      for (const sch of schedules) {
        if (sch.days && !sch.days.includes(currentDay)) continue;

        let relayNum = resolveDeviceRelay(sch.device_name);
        if (!relayNum) {
          const [dRows] = await pool.query('SELECT port FROM devices WHERE name = ? LIMIT 1', [sch.device_name]);
          if (dRows.length > 0 && dRows[0].port) {
            relayNum = parseInt(String(dRows[0].port).replace(/\D/g, ''), 10);
          }
        }
        if (!relayNum || relayNum < 1 || relayNum > 4) continue;

        // Parse schedule start/end into minute values
        const [startH, startM] = (sch.start_time || '09:00').split(':').map(Number);
        const [endH, endM] = (sch.end_time || '17:00').split(':').map(Number);
        const startVal = startH * 60 + startM;
        const endVal = endH * 60 + endM;

        const isInWindow = (endVal >= startVal)
          ? (currentTimeVal >= startVal && currentTimeVal < endVal)
          : (currentTimeVal >= startVal || currentTimeVal < endVal); // spans midnight

        const currentRelayState = esp.relayStates?.[`relay${relayNum}`];

        // If inside the window and relay is OFF, turn relay ON
        if (isInWindow && !currentRelayState) {
          console.log(`⏰ [REALTIME SCHEDULE ACTIVE] Within window ${sch.start_time}-${sch.end_time}: Actuating R${relayNum}_ON for ${sch.device_name}`);
          await updateRelayState(`R${relayNum}_ON`);
          await pool.query(
            'INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [currentTimeStr, sch.device_name, 'SCHEDULE_ON', `${currentPower.toFixed(2)} kW`, `${(currentPower + 0.1).toFixed(2)} kW`, `Realtime schedule (${sch.start_time}–${sch.end_time}) activated on Relay ${relayNum}`]
          ).catch(() => {});
        }
      }

      // ─── 2. AUTOMATED LIGHTGBM PEAK SHEDDING ───
      if (cfg.auto_shedding) {
        const triggerKW = (peakLimit * triggerThreshold) / 100.0;
        const predictedPeak = parseFloat(cfg.predicted_load) || currentPower;

        // If actual load OR predicted load breaches threshold
        if (currentPower >= triggerKW || predictedPeak >= peakLimit) {
          // Check if Iron Box (Relay 4, 1000W) is currently active
          const isR4On = esp.relayStates?.relay4 !== false;
          if (isR4On) {
            console.log(`🚨 [AUTO SHED] Load ${currentPower.toFixed(2)} kW exceeds ceiling ${peakLimit} kW. Shedding Relay 4 (Iron Box)...`);
            await updateRelayState('R4_OFF');

            await pool.query(`
              INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason)
              VALUES (?, 'Iron Box', 'SHED', ?, ?, 'Auto-shed by LightGBM: Peak contract ceiling protection')
            `, [
              currentTimeStr,
              `${currentPower.toFixed(2)} kW`,
              `${Math.max(1.0, currentPower - 1.0).toFixed(2)} kW`
            ]).catch(() => {});

            await pool.query("UPDATE devices SET status = 'shed' WHERE name LIKE '%Iron%' OR port LIKE '%4%'").catch(() => {});
          }
        }
      }

      // ─── 3. AUTOMATED RESTORE WHEN SAFE HEADROOM CLEARED ───
      if (cfg.auto_restore) {
        const restoreKW = (peakLimit * restoreThreshold) / 100.0;
        if (currentPower <= restoreKW) {
          const isR4Off = esp.relayStates?.relay4 === false;
          if (isR4Off) {
            console.log(`🟢 [AUTO RESTORE] Load ${currentPower.toFixed(2)} kW is safe below restore ceiling ${restoreKW.toFixed(2)} kW. Restoring Relay 4...`);
            await updateRelayState('R4_ON');

            await pool.query(`
              INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason)
              VALUES (?, 'Iron Box', 'RESTORE', ?, ?, 'Auto-restore: Headroom safely recovered')
            `, [
              currentTimeStr,
              `${currentPower.toFixed(2)} kW`,
              `${(currentPower + 1.0).toFixed(2)} kW`
            ]).catch(() => {});

            await pool.query("UPDATE devices SET status = 'online' WHERE name LIKE '%Iron%' OR port LIKE '%4%'").catch(() => {});
          }
        }
      }

    } catch (err) {
      console.warn('⚠️ [SHEDDING ENGINE ERROR]', err.message);
    }
  }, 10000); // 10s realtime cycle
}
