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
