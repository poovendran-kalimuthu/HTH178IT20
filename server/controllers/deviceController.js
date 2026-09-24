import { getPool, getDBStatus } from '../config/db.js';
import { broadcastDeviceEvent } from '../services/esp32Socket.js';

// Map database row to frontend camelCase device object
const formatDevice = (row) => ({
  id: row.id,
  name: row.name,
  port: row.port,
  sensorChannel: row.sensor_channel || (row.port ? `Channel ${row.port.replace(/\D/g, '') || '1'} (CT-${row.port.replace(/\D/g, '') || '1'})` : 'Channel 1 (CT-1)'),
  type: row.type || '',
  location: row.location || '',
  desc: row.description || '',
  status: row.status || 'online',
  image: row.image || null,
  voltage: row.voltage != null ? String(row.voltage) : '230',
  ratedPower: row.rated_power != null ? String(row.rated_power) : '500',
  maxPower: row.max_power != null ? String(row.max_power) : '600',
  powerFactor: row.power_factor != null ? String(row.power_factor) : '0.95',
  currentLimit: row.current_limit != null ? String(row.current_limit) : '2.5',
  measureUnit: row.measure_unit || 'W',
  priority: row.priority || 'low',
  criticality: row.criticality || (row.priority === 'critical' ? 'critical' : 'non-critical'),
  autoShed: Boolean(row.auto_shed),
  autoShift: Boolean(row.auto_shift),
  switchable: Boolean(row.switchable),
  shiftable: Boolean(row.shiftable),
  minOn: row.min_on != null ? String(row.min_on) : '5',
  minOff: row.min_off != null ? String(row.min_off) : '15',
  maxOff: row.max_off != null ? String(row.max_off) : '60',
  recoveryDelay: row.recovery_delay != null ? String(row.recovery_delay) : '10',
  shedOrder: row.shed_order != null ? String(row.shed_order) : '1',
  schedule: row.schedule || '24/7 Continuous',
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/devices
export const getDevices = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database connection is not ready.',
        dbStatus: getDBStatus()
      });
    }

    const [rows] = await pool.query('SELECT * FROM devices ORDER BY port ASC, created_at ASC');
    const formatted = rows.map(formatDevice);

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/devices/:id
export const getDeviceById = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    res.json({
      success: true,
      data: formatDevice(rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/devices (Realtime addition stored in local MySQL)
export const createDevice = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const body = req.body;
    if (!body.name || !body.port) {
      return res.status(400).json({
        success: false,
        error: 'Device name and assigned port are required'
      });
    }

    // Auto-generate ID if omitted
    let deviceId = body.id;
    if (!deviceId || deviceId.trim() === '') {
      const [countResult] = await pool.query('SELECT COUNT(*) as cnt FROM devices');
      deviceId = `DEV-00${(countResult[0]?.cnt || 0) + 1}`;
    }

    const query = `
      INSERT INTO devices (
        id, name, port, sensor_channel, type, location, description, status, image,
        voltage, rated_power, max_power, power_factor, current_limit, measure_unit,
        priority, criticality, auto_shed, auto_shift, switchable, shiftable, min_on, min_off, max_off, recovery_delay, shed_order, schedule
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      deviceId,
      body.name.trim(),
      body.port.trim(),
      body.sensorChannel || `Channel ${body.port.replace(/\D/g, '') || '1'} (CT-${body.port.replace(/\D/g, '') || '1'})`,
      body.type || 'General Appliance',
      body.location || 'Lab Room 1',
      body.desc || '',
      body.status === 'offline' ? 'offline' : 'online',
      body.image || null,
      parseFloat(body.voltage) || 230.00,
      parseFloat(body.ratedPower) || 500.00,
      parseFloat(body.maxPower) || 600.00,
      parseFloat(body.powerFactor) || 0.95,
      parseFloat(body.currentLimit) || 2.50,
      body.measureUnit || 'W',
      ['critical', 'high', 'medium', 'low'].includes(body.priority) ? body.priority : 'low',
      body.criticality || (body.priority === 'critical' ? 'critical' : 'non-critical'),
      body.autoShed !== undefined ? Boolean(body.autoShed) : true,
      body.autoShift !== undefined ? Boolean(body.autoShift) : false,
      body.switchable !== undefined ? Boolean(body.switchable) : true,
      body.shiftable !== undefined ? Boolean(body.shiftable) : false,
      parseInt(body.minOn) || 5,
      parseInt(body.minOff) || 15,
      parseInt(body.maxOff) || 60,
      parseInt(body.recoveryDelay) || 10,
      parseInt(body.shedOrder) || 1,
      body.schedule || '24/7 Continuous'
    ];

    await pool.query(query, values);

    // Fetch the newly created record
    const [insertedRows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
    const createdDevice = formatDevice(insertedRows[0]);

    // Realtime WebSocket broadcast to all connected clients
    broadcastDeviceEvent('created', createdDevice);

    console.log(`📡 [Realtime] Device "${createdDevice.name}" (${createdDevice.id}) created and stored in MySQL.`);

    res.status(201).json({
      success: true,
      message: 'Device created and stored in local database successfully',
      data: createdDevice
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: `A device with ID "${req.body.id}" already exists.`
      });
    }
    next(err);
  }
};

// PUT /api/devices/:id
export const updateDevice = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const { id } = req.params;
    const body = req.body;

    // Check if device exists
    const [existing] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const query = `
      UPDATE devices SET
        name = COALESCE(?, name),
        port = COALESCE(?, port),
        sensor_channel = COALESCE(?, sensor_channel),
        type = COALESCE(?, type),
        location = COALESCE(?, location),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        image = COALESCE(?, image),
        voltage = COALESCE(?, voltage),
        rated_power = COALESCE(?, rated_power),
        max_power = COALESCE(?, max_power),
        power_factor = COALESCE(?, power_factor),
        current_limit = COALESCE(?, current_limit),
        measure_unit = COALESCE(?, measure_unit),
        priority = COALESCE(?, priority),
        criticality = COALESCE(?, criticality),
        auto_shed = COALESCE(?, auto_shed),
        auto_shift = COALESCE(?, auto_shift),
        switchable = COALESCE(?, switchable),
        shiftable = COALESCE(?, shiftable),
        min_on = COALESCE(?, min_on),
        min_off = COALESCE(?, min_off),
        max_off = COALESCE(?, max_off),
        recovery_delay = COALESCE(?, recovery_delay),
        shed_order = COALESCE(?, shed_order),
        schedule = COALESCE(?, schedule)
      WHERE id = ?
    `;

    const values = [
      body.name !== undefined ? body.name.trim() : null,
      body.port !== undefined ? body.port.trim() : null,
      body.sensorChannel !== undefined ? body.sensorChannel : null,
      body.type !== undefined ? body.type : null,
      body.location !== undefined ? body.location : null,
      body.desc !== undefined ? body.desc : null,
      body.status !== undefined ? body.status : null,
      body.image !== undefined ? body.image : null,
      body.voltage !== undefined ? parseFloat(body.voltage) : null,
      body.ratedPower !== undefined ? parseFloat(body.ratedPower) : null,
      body.maxPower !== undefined ? parseFloat(body.maxPower) : null,
      body.powerFactor !== undefined ? parseFloat(body.powerFactor) : null,
      body.currentLimit !== undefined ? parseFloat(body.currentLimit) : null,
      body.measureUnit !== undefined ? body.measureUnit : null,
      body.priority !== undefined ? body.priority : null,
      body.criticality !== undefined ? body.criticality : (body.priority === 'critical' ? 'critical' : (body.priority ? 'non-critical' : null)),
      body.autoShed !== undefined ? Boolean(body.autoShed) : null,
      body.autoShift !== undefined ? Boolean(body.autoShift) : null,
      body.switchable !== undefined ? Boolean(body.switchable) : null,
      body.shiftable !== undefined ? Boolean(body.shiftable) : null,
      body.minOn !== undefined ? parseInt(body.minOn) : null,
      body.minOff !== undefined ? parseInt(body.minOff) : null,
      body.maxOff !== undefined ? parseInt(body.maxOff) : null,
      body.recoveryDelay !== undefined ? parseInt(body.recoveryDelay) : null,
      body.shedOrder !== undefined ? parseInt(body.shedOrder) : null,
      body.schedule !== undefined ? body.schedule : null,
      id
    ];

    await pool.query(query, values);

    const [updatedRows] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    const updatedDevice = formatDevice(updatedRows[0]);

    // Broadcast realtime update
    broadcastDeviceEvent('updated', updatedDevice);

    res.json({
      success: true,
      message: 'Device updated successfully',
      data: updatedDevice
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/devices/:id
export const deleteDevice = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    await pool.query('DELETE FROM devices WHERE id = ?', [id]);

    // Broadcast deletion in real time
    broadcastDeviceEvent('deleted', { id });

    res.json({
      success: true,
      message: `Device ${id} deleted successfully`
    });
  } catch (err) {
    next(err);
  }
};
