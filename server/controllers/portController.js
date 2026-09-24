import { getPool } from '../config/db.js';

// Format port row to dual camelCase + snake_case response
const formatPort = (row) => ({
  id: row.id,
  port_id: row.id,
  name: row.name,
  port_name: row.name,
  portNumber: row.port_number,
  port_number: row.port_number,
  status: row.status || 'Online',
  port_status: row.status || 'Online',
  type: row.type || 'AC Output',
  port_type: row.type || 'AC Output',
  location: row.location || 'Extension Board',
  connectedDevice: row.connected_device || 'Wi-Fi Router',
  connected_device: row.connected_device || 'Wi-Fi Router',
  
  // Hardware Mapping
  controller: row.controller || 'Arduino UNO',
  relayChannel: row.relay_channel || 'Relay 1',
  relay_channel: row.relay_channel || 'Relay 1',
  relayPin: row.relay_pin || 'D4',
  relay_pin: row.relay_pin || 'D4',
  currentSensor: row.current_sensor || 'ACS712-1',
  current_sensor: row.current_sensor || 'ACS712-1',
  currentSensorPin: row.current_sensor_pin || 'A1',
  current_sensor_pin: row.current_sensor_pin || 'A1',
  voltageSensor: row.voltage_sensor || 'ZMPT101B-1',
  voltage_sensor: row.voltage_sensor || 'ZMPT101B-1',
  voltageSensorPin: row.voltage_sensor_pin || 'A0',
  voltage_sensor_pin: row.voltage_sensor_pin || 'A0',

  // Electrical Configuration
  ratedVoltage: row.rated_voltage != null ? Number(row.rated_voltage) : 230,
  rated_voltage: row.rated_voltage != null ? Number(row.rated_voltage) : 230,
  maxCurrent: row.max_current != null ? Number(row.max_current) : 10,
  max_current: row.max_current != null ? Number(row.max_current) : 10,
  maxPower: row.max_power != null ? Number(row.max_power) : 2300,
  max_power: row.max_power != null ? Number(row.max_power) : 2300,
  measureUnit: row.measure_unit || 'W',
  measurement_unit: row.measure_unit || 'W',
  powerFactor: row.power_factor != null ? Number(row.power_factor) : 0.95,
  power_factor: row.power_factor != null ? Number(row.power_factor) : 0.95,

  // Live Telemetry
  liveVoltage: row.live_voltage != null ? Number(row.live_voltage) : 229.4,
  live_voltage: row.live_voltage != null ? Number(row.live_voltage) : 229.4,
  liveCurrent: row.live_current != null ? Number(row.live_current) : 1.82,
  live_current: row.live_current != null ? Number(row.live_current) : 1.82,
  livePower: row.live_power != null ? Number(row.live_power) : 418.0,
  live_power: row.live_power != null ? Number(row.live_power) : 418.0,
  liveStatus: row.live_status || 'NORMAL',
  live_status: row.live_status || 'NORMAL',

  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/ports
export const getPorts = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const [rows] = await pool.query('SELECT * FROM ports ORDER BY port_number ASC');
    res.json({
      success: true,
      count: rows.length,
      data: rows.map(formatPort)
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/ports/:id
export const getPortById = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const [rows] = await pool.query('SELECT * FROM ports WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Port not found' });
    }

    res.json({
      success: true,
      data: formatPort(rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/ports/:id
export const updatePort = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const { id } = req.params;
    const body = req.body;

    const [existing] = await pool.query('SELECT * FROM ports WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Port not found' });
    }

    const nameVal = body.name !== undefined ? body.name : body.port_name;
    const portNumVal = body.portNumber !== undefined ? body.portNumber : body.port_number;
    const statusVal = body.status !== undefined ? body.status : body.port_status;
    const typeVal = body.type !== undefined ? body.type : body.port_type;
    const locationVal = body.location;
    const connectedDevVal = body.connectedDevice !== undefined ? body.connectedDevice : body.connected_device;
    const controllerVal = body.controller;
    const relayChanVal = body.relayChannel !== undefined ? body.relayChannel : body.relay_channel;
    const relayPinVal = body.relayPin !== undefined ? body.relayPin : body.relay_pin;
    const currSensorVal = body.currentSensor !== undefined ? body.currentSensor : body.current_sensor;
    const currPinVal = body.currentSensorPin !== undefined ? body.currentSensorPin : body.current_sensor_pin;
    const voltSensorVal = body.voltageSensor !== undefined ? body.voltageSensor : body.voltage_sensor;
    const voltPinVal = body.voltageSensorPin !== undefined ? body.voltageSensorPin : body.voltage_sensor_pin;
    const ratedVoltVal = body.ratedVoltage !== undefined ? body.ratedVoltage : body.rated_voltage;
    const maxCurrVal = body.maxCurrent !== undefined ? body.maxCurrent : body.max_current;
    const maxPowerVal = body.maxPower !== undefined ? body.maxPower : body.max_power;
    const measUnitVal = body.measureUnit !== undefined ? body.measureUnit : body.measurement_unit;
    const pfVal = body.powerFactor !== undefined ? body.powerFactor : body.power_factor;
    const liveVoltVal = body.liveVoltage !== undefined ? body.liveVoltage : body.live_voltage;
    const liveCurrVal = body.liveCurrent !== undefined ? body.liveCurrent : body.live_current;
    const livePowerVal = body.livePower !== undefined ? body.livePower : body.live_power;
    const liveStatusVal = body.liveStatus !== undefined ? body.liveStatus : body.live_status;

    const query = `
      UPDATE ports SET
        name = COALESCE(?, name),
        port_number = COALESCE(?, port_number),
        status = COALESCE(?, status),
        type = COALESCE(?, type),
        location = COALESCE(?, location),
        connected_device = COALESCE(?, connected_device),
        controller = COALESCE(?, controller),
        relay_channel = COALESCE(?, relay_channel),
        relay_pin = COALESCE(?, relay_pin),
        current_sensor = COALESCE(?, current_sensor),
        current_sensor_pin = COALESCE(?, current_sensor_pin),
        voltage_sensor = COALESCE(?, voltage_sensor),
        voltage_sensor_pin = COALESCE(?, voltage_sensor_pin),
        rated_voltage = COALESCE(?, rated_voltage),
        max_current = COALESCE(?, max_current),
        max_power = COALESCE(?, max_power),
        measure_unit = COALESCE(?, measure_unit),
        power_factor = COALESCE(?, power_factor),
        live_voltage = COALESCE(?, live_voltage),
        live_current = COALESCE(?, live_current),
        live_power = COALESCE(?, live_power),
        live_status = COALESCE(?, live_status)
      WHERE id = ?
    `;

    const values = [
      nameVal !== undefined ? nameVal : null,
      portNumVal !== undefined ? parseInt(portNumVal) : null,
      statusVal !== undefined ? statusVal : null,
      typeVal !== undefined ? typeVal : null,
      locationVal !== undefined ? locationVal : null,
      connectedDevVal !== undefined ? connectedDevVal : null,
      controllerVal !== undefined ? controllerVal : null,
      relayChanVal !== undefined ? relayChanVal : null,
      relayPinVal !== undefined ? relayPinVal : null,
      currSensorVal !== undefined ? currSensorVal : null,
      currPinVal !== undefined ? currPinVal : null,
      voltSensorVal !== undefined ? voltSensorVal : null,
      voltPinVal !== undefined ? voltPinVal : null,
      ratedVoltVal !== undefined ? parseFloat(ratedVoltVal) : null,
      maxCurrVal !== undefined ? parseFloat(maxCurrVal) : null,
      maxPowerVal !== undefined ? parseFloat(maxPowerVal) : null,
      measUnitVal !== undefined ? measUnitVal : null,
      pfVal !== undefined ? parseFloat(pfVal) : null,
      liveVoltVal !== undefined ? parseFloat(liveVoltVal) : null,
      liveCurrVal !== undefined ? parseFloat(liveCurrVal) : null,
      livePowerVal !== undefined ? parseFloat(livePowerVal) : null,
      liveStatusVal !== undefined ? liveStatusVal : null,
      id
    ];

    await pool.query(query, values);

    const [updatedRows] = await pool.query('SELECT * FROM ports WHERE id = ?', [id]);
    const updated = formatPort(updatedRows[0]);

    res.json({
      success: true,
      message: `Port ${id} configuration saved successfully`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
