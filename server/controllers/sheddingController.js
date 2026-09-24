import { getPool } from '../config/db.js';

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

// POST /api/shedding/action
export const triggerAction = async (req, res, next) => {
  try {
    const pool = getPool();
    const { device, action, beforeLoad, afterLoad, reason } = req.body;

    const timeStr = new Date().toTimeString().slice(0, 5);
    if (pool) {
      await pool.query(`
        INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        timeStr,
        device || 'Unknown Device',
        (action || 'SHED').toUpperCase(),
        beforeLoad || '4.82 kW',
        afterLoad || '3.82 kW',
        reason || 'Manual operator action'
      ]);
    }

    res.json({
      success: true,
      message: `Action ${action} executed for ${device}`
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

    res.json({
      success: true,
      message: `Recorded ${result} decision for ${device}`
    });
  } catch (err) {
    next(err);
  }
};
