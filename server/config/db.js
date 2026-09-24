import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'kpr_horizon_db'
} = process.env;

let pool = null;
let dbStatus = {
  connected: false,
  message: 'Initializing connection...',
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  error: null,
  version: null,
  lastChecked: null
};

export const initDB = async () => {
  try {
    // 1. Establish initial root connection to ensure database exists
    const initialConnection = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD
    });

    await initialConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await initialConnection.end();

    // 2. Initialize connection pool targeting the database
    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 3. Test pool connection & fetch MySQL version
    const [rows] = await pool.query('SELECT VERSION() AS version');
    const version = rows[0]?.version || 'Unknown';

    // 4. Ensure demo table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Seed sample records if table is empty
    const [itemCount] = await pool.query('SELECT COUNT(*) as count FROM items');
    if (itemCount[0].count === 0) {
      await pool.query(`
        INSERT INTO items (title, description, status, priority) VALUES 
        ('Setup Fullstack Architecture', 'Express API + MySQL database + React frontend with Vite', 'completed', 'high'),
        ('Configure MySQL Connection Pool', 'Pool configuration with automated DB creation and migrations', 'completed', 'high'),
        ('Build Interactive Dashboard', 'Modern UI with real-time health telemetry & CRUD capabilities', 'in_progress', 'medium')
      `);
      console.log('🌱 Database seeded with initial demo records.');
    }

    // 6. Ensure devices table exists for local database storage
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        port VARCHAR(50) NOT NULL,
        sensor_channel VARCHAR(50) DEFAULT 'Channel 1 (CT-1)',
        type VARCHAR(100),
        location VARCHAR(150),
        description TEXT,
        status ENUM('online', 'offline') DEFAULT 'online',
        image MEDIUMTEXT,
        voltage DECIMAL(8,2) DEFAULT 230.00,
        rated_power DECIMAL(10,2) DEFAULT 500.00,
        max_power DECIMAL(10,2) DEFAULT 600.00,
        power_factor DECIMAL(4,2) DEFAULT 0.95,
        current_limit DECIMAL(8,2) DEFAULT 2.50,
        measure_unit VARCHAR(20) DEFAULT 'W',
        priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'low',
        criticality ENUM('critical', 'non-critical') DEFAULT 'non-critical',
        auto_shed BOOLEAN DEFAULT TRUE,
        auto_shift BOOLEAN DEFAULT FALSE,
        switchable BOOLEAN DEFAULT TRUE,
        shiftable BOOLEAN DEFAULT FALSE,
        min_on INT DEFAULT 5,
        min_off INT DEFAULT 15,
        max_off INT DEFAULT 60,
        recovery_delay INT DEFAULT 10,
        shed_order INT DEFAULT 1,
        schedule VARCHAR(100) DEFAULT '24/7 Continuous',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist on already created tables
    try {
      const [colSensor] = await pool.query("SHOW COLUMNS FROM devices LIKE 'sensor_channel'");
      if (colSensor.length === 0) {
        await pool.query("ALTER TABLE devices ADD COLUMN sensor_channel VARCHAR(50) DEFAULT 'Channel 1 (CT-1)' AFTER port");
      }
      const [colCrit] = await pool.query("SHOW COLUMNS FROM devices LIKE 'criticality'");
      if (colCrit.length === 0) {
        await pool.query("ALTER TABLE devices ADD COLUMN criticality ENUM('critical', 'non-critical') DEFAULT 'non-critical' AFTER priority");
      }
      const [colSched] = await pool.query("SHOW COLUMNS FROM devices LIKE 'schedule'");
      if (colSched.length === 0) {
        await pool.query("ALTER TABLE devices ADD COLUMN schedule VARCHAR(100) DEFAULT '24/7 Continuous' AFTER shed_order");
      }
    } catch (e) {
      console.warn('Column verification notice:', e.message);
    }

    // 7. Ensure standard 4 devices exist in the devices table
    await pool.query(`
      INSERT IGNORE INTO devices (
        id, name, port, sensor_channel, type, location, description, status, image,
        voltage, rated_power, max_power, power_factor, current_limit, measure_unit,
        priority, criticality, auto_shed, auto_shift, switchable, shiftable, min_on, min_off, max_off, recovery_delay, shed_order, schedule
      ) VALUES 
      ('DEV-001', 'Wi-Fi Router', 'Port 1', 'Channel 1 (CT-1)', 'Networking Gateway', 'Main Control Room', 'Primary communications & WebSocket telemetry gateway', 'online', 'preset:wifi_router', 230.00, 25.00, 35.00, 0.98, 0.50, 'W', 'critical', 'critical', FALSE, FALSE, FALSE, FALSE, 60, 0, 0, 0, 99, '24/7 Continuous'),
      ('DEV-002', 'Mobile Charger', 'Port 2', 'Channel 2 (CT-2)', 'Electronics Load', 'Staff Workstation 1', 'Fast 65W GaN dual-port charging station', 'online', 'preset:mobile_charger', 230.00, 65.00, 80.00, 0.92, 1.00, 'W', 'low', 'non-critical', TRUE, TRUE, TRUE, TRUE, 10, 10, 120, 5, 1, '08:00 - 20:00 (Office Hours)'),
      ('DEV-003', 'Laptop Workstation', 'Port 3', 'Channel 3 (CT-3)', 'Computing / IT', 'Engineering Bay', 'High-performance analytics & simulation workstation', 'online', 'preset:laptop', 230.00, 90.00, 135.00, 0.95, 1.50, 'W', 'medium', 'non-critical', TRUE, FALSE, TRUE, FALSE, 30, 15, 45, 15, 2, '09:00 - 22:00 (Active Shift)'),
      ('DEV-004', 'Iron Box', 'Port 4', 'Channel 4 (CT-4)', 'Heating Load', 'Lab Room 1', 'High-power heating load for thermal test bench', 'online', 'preset:electric_iron', 230.00, 1000.00, 1200.00, 0.95, 5.00, 'W', 'low', 'non-critical', TRUE, FALSE, TRUE, FALSE, 5, 15, 60, 10, 1, '10:00 - 18:00 (Lab Test Bench)')
    `);

    // Ensure initial devices have specific sensor channels, criticality, and schedules assigned
    await pool.query(`UPDATE devices SET sensor_channel = 'Channel 1 (CT-1)', criticality = 'critical', schedule = '24/7 Continuous' WHERE id = 'DEV-001' AND (sensor_channel = 'Channel 1 (CT-1)' OR sensor_channel = 'Channel 1' OR sensor_channel IS NULL)`);
    await pool.query(`UPDATE devices SET sensor_channel = 'Channel 2 (CT-2)', criticality = 'non-critical', schedule = '08:00 - 20:00 (Office Hours)' WHERE id = 'DEV-002' AND (sensor_channel = 'Channel 1 (CT-1)' OR sensor_channel = 'Channel 1' OR sensor_channel IS NULL)`);
    await pool.query(`UPDATE devices SET sensor_channel = 'Channel 3 (CT-3)', criticality = 'non-critical', schedule = '09:00 - 22:00 (Active Shift)' WHERE id = 'DEV-003' AND (sensor_channel = 'Channel 1 (CT-1)' OR sensor_channel = 'Channel 1' OR sensor_channel IS NULL)`);
    await pool.query(`UPDATE devices SET sensor_channel = 'Channel 4 (CT-4)', criticality = 'non-critical', schedule = '10:00 - 18:00 (Lab Test Bench)' WHERE id = 'DEV-004' AND (sensor_channel = 'Channel 1 (CT-1)' OR sensor_channel = 'Channel 1' OR sensor_channel IS NULL)`);

    console.log('⚡ Standard 4 devices verified in MySQL database with mandatory fields.');

    // 8. Ensure ports table exists for Port Configuration & Hardware Mapping
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ports (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        port_number INT NOT NULL,
        status ENUM('Online', 'Offline') DEFAULT 'Online',
        type VARCHAR(50) DEFAULT 'AC Output',
        location VARCHAR(150) DEFAULT 'Extension Board',
        connected_device VARCHAR(255) DEFAULT 'Wi-Fi Router',
        controller VARCHAR(100) DEFAULT 'Arduino UNO',
        relay_channel VARCHAR(50) DEFAULT 'Relay 1',
        relay_pin VARCHAR(50) DEFAULT 'D4',
        current_sensor VARCHAR(100) DEFAULT 'ACS712-1',
        current_sensor_pin VARCHAR(50) DEFAULT 'A1',
        voltage_sensor VARCHAR(100) DEFAULT 'ZMPT101B-1',
        voltage_sensor_pin VARCHAR(50) DEFAULT 'A0',
        rated_voltage DECIMAL(8,2) DEFAULT 230.00,
        max_current DECIMAL(8,2) DEFAULT 10.00,
        max_power DECIMAL(10,2) DEFAULT 2300.00,
        measure_unit VARCHAR(20) DEFAULT 'W',
        power_factor DECIMAL(4,2) DEFAULT 0.95,
        live_voltage DECIMAL(8,2) DEFAULT 229.40,
        live_current DECIMAL(8,2) DEFAULT 1.82,
        live_power DECIMAL(10,2) DEFAULT 418.00,
        live_status VARCHAR(50) DEFAULT 'NORMAL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed ports table with the 4 hardware mapped ports
    await pool.query(`
      INSERT IGNORE INTO ports (
        id, name, port_number, status, type, location, connected_device,
        controller, relay_channel, relay_pin, current_sensor, current_sensor_pin, voltage_sensor, voltage_sensor_pin,
        rated_voltage, max_current, max_power, measure_unit, power_factor,
        live_voltage, live_current, live_power, live_status
      ) VALUES
      ('P-001', 'Port 1', 1, 'Online', 'AC Output', 'Extension Board', 'Wi-Fi Router',
       'Arduino UNO', 'Relay 1', 'D4', 'ACS712-1', 'A1', 'ZMPT101B-1', 'A0',
       230.00, 10.00, 2300.00, 'W', 0.95, 229.40, 1.82, 418.00, 'NORMAL'),
      ('P-002', 'Port 2', 2, 'Online', 'AC Output', 'Extension Board', 'Mobile Charger',
       'Arduino UNO', 'Relay 2', 'D5', 'ACS712-2', 'A2', 'ZMPT101B-1', 'A0',
       230.00, 10.00, 2300.00, 'W', 0.92, 230.10, 0.28, 65.00, 'NORMAL'),
      ('P-003', 'Port 3', 3, 'Online', 'AC Output', 'Extension Board', 'Laptop Workstation',
       'Arduino UNO', 'Relay 3', 'D6', 'ACS712-3', 'A3', 'ZMPT101B-1', 'A0',
       230.00, 10.00, 2300.00, 'W', 0.95, 229.80, 0.39, 90.00, 'NORMAL'),
      ('P-004', 'Port 4', 4, 'Online', 'AC Output', 'Extension Board', 'Iron Box',
       'Arduino UNO', 'Relay 4', 'D7', 'ACS712-4', 'A4', 'ZMPT101B-1', 'A0',
       230.00, 10.00, 2300.00, 'W', 0.95, 228.60, 4.38, 1000.00, 'NORMAL')
    `);

    console.log('⚡ Hardware Port Mapping (P-001 to P-004) verified in MySQL database.');

    // 8. Create shedding_config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shedding_config (
        id INT PRIMARY KEY,
        peak_limit DECIMAL(10,2) DEFAULT 5.00,
        current_load DECIMAL(10,2) DEFAULT 3.42,
        predicted_load DECIMAL(10,2) DEFAULT 5.38,
        auto_shedding BOOLEAN DEFAULT TRUE,
        auto_restore BOOLEAN DEFAULT TRUE,
        prediction_enabled BOOLEAN DEFAULT TRUE,
        trigger_threshold DECIMAL(5,2) DEFAULT 90.00,
        restore_threshold DECIMAL(5,2) DEFAULT 75.00,
        min_headroom DECIMAL(10,2) DEFAULT 500.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      INSERT INTO shedding_config (id, peak_limit, current_load, predicted_load, auto_shedding, auto_restore, prediction_enabled, trigger_threshold, restore_threshold, min_headroom)
      VALUES (1, 5.00, 3.42, 5.38, TRUE, TRUE, TRUE, 90.00, 75.00, 500.00)
      ON DUPLICATE KEY UPDATE id=1;
    `);

    // 9. Create load_schedules table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS load_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_name VARCHAR(100) NOT NULL,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL,
        duration VARCHAR(50) DEFAULT '2 hours',
        days VARCHAR(100) DEFAULT 'Mon, Tue, Wed, Thu, Fri',
        shiftable BOOLEAN DEFAULT TRUE,
        max_delay_min INT DEFAULT 60,
        status VARCHAR(50) DEFAULT 'Active',
        next_action VARCHAR(100) DEFAULT 'Shift if peak',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [schedRows] = await pool.query('SELECT COUNT(*) as count FROM load_schedules');
    if (schedRows[0].count === 0) {
      await pool.query(`
        INSERT INTO load_schedules (device_name, start_time, end_time, duration, days, shiftable, max_delay_min, status, next_action)
        VALUES 
        ('Laptop', '09:00', '17:00', '2 hours', 'Mon, Tue, Wed, Thu, Fri', TRUE, 60, 'Active', 'Shift if peak'),
        ('Iron Box', '10:00', '12:00', '2 hours', 'Mon, Tue, Wed, Thu, Fri', TRUE, 60, 'Pending', 'Start 10:00'),
        ('Mobile Charger', '09:00', '18:00', '9 hours', 'Mon, Tue, Wed, Thu, Fri', TRUE, 30, 'Active', '—');
      `);
    }

    // 10. Create shedding_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shedding_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        time_str VARCHAR(50) NOT NULL,
        device_name VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        before_load VARCHAR(50) NOT NULL,
        after_load VARCHAR(50) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [histRows] = await pool.query('SELECT COUNT(*) as count FROM shedding_history');
    if (histRows[0].count === 0) {
      await pool.query(`
        INSERT INTO shedding_history (time_str, device_name, action, before_load, after_load, reason)
        VALUES 
        ('10:42', 'Iron Box', 'SHED', '4.82 kW', '3.82 kW', 'Predicted peak'),
        ('10:48', 'Iron Box', 'RESTORE', '3.70 kW', '4.70 kW', 'Risk cleared');
      `);
    }

    // 11. Create recommendation_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recommendation_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        time_str VARCHAR(50) NOT NULL,
        device_name VARCHAR(100) NOT NULL,
        recommendation VARCHAR(50) NOT NULL,
        result VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [recHistRows] = await pool.query('SELECT COUNT(*) as count FROM recommendation_history');
    if (recHistRows[0].count === 0) {
      await pool.query(`
        INSERT INTO recommendation_history (time_str, device_name, recommendation, result)
        VALUES 
        ('10:42', 'Iron Box', 'Shed', 'Accepted'),
        ('10:44', 'Laptop', 'Shift', 'Rejected'),
        ('10:50', 'Mobile Charger', 'Shed', 'Executed');
      `);
    }

    console.log('⚡ Load Shedding & Scheduling tables initialized in MySQL database.');

    dbStatus = {
      connected: true,
      message: 'Successfully connected to MySQL database',
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      error: null,
      version,
      lastChecked: new Date().toISOString()
    };

    console.log(`✅ MySQL connected (${DB_NAME} on ${DB_HOST}:${DB_PORT}, MySQL ${version})`);
    return true;
  } catch (err) {
    dbStatus = {
      connected: false,
      message: 'Failed to connect to MySQL database',
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      error: err.message,
      code: err.code,
      version: null,
      lastChecked: new Date().toISOString()
    };

    console.error('❌ MySQL Connection Error:', err.message);
    console.warn('⚠️  Please verify credentials in server/.env if needed.');
    return false;
  }
};

export const getDBStatus = () => ({ ...dbStatus, lastChecked: new Date().toISOString() });

export const getPool = () => pool;

export default {
  initDB,
  getDBStatus,
  getPool
};
