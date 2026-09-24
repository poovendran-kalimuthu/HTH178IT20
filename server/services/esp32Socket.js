import { WebSocketServer, WebSocket } from 'ws';

// Global state for ESP32 and active connections
const state = {
  esp32: {
    connected: false,
    ip: '10.38.24.77',
    lastSeen: null,
    latencyMs: 0,
    packetsReceived: 0,
    wsClient: null,
    latestTelemetry: {
      voltage: 230.2,
      current: 12.4,
      power: 2.85,
      frequency: 50.02,
      soc: 85.0,
      temperature: 32.5,
      ir_sensor: 1,
      timestamp: new Date().toISOString()
    }
  },
  recentHistory: [],
  frontendClients: new Set()
};

let wss = null;

/**
 * Initialize WebSocket Server attached to Express HTTP server
 * @param {import('http').Server} server 
 */
export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  console.log('📡 WebSocket Server initialized on path /ws');

  wss.on('connection', (ws, req) => {
    const rawIp = req.socket.remoteAddress || '';
    const clientIp = rawIp.replace(/^.*:/, ''); // strip IPv6 prefix if any
    ws.isAlive = true;
    ws.clientIp = clientIp;

    console.log(`🔌 New WebSocket connection from ${clientIp}`);

    // Auto-detect if this client is from ESP32 IP
    if (clientIp === '10.38.24.77' || clientIp.includes('10.38.24.77')) {
      registerEsp32(ws, clientIp);
    } else {
      // Default to frontend viewer until identified
      state.frontendClients.add(ws);
      // Send current state to newly connected frontend
      ws.send(JSON.stringify({
        type: 'init_state',
        esp32: {
          connected: state.esp32.connected,
          ip: state.esp32.ip,
          lastSeen: state.esp32.lastSeen,
          latencyMs: state.esp32.latencyMs,
          packetsReceived: state.esp32.packetsReceived,
          latestTelemetry: state.esp32.latestTelemetry
        },
        history: state.recentHistory.slice(-20)
      }));
    }

    ws.on('pong', () => {
      ws.isAlive = true;
      if (ws === state.esp32.wsClient && ws.pingSentTime) {
        state.esp32.latencyMs = Date.now() - ws.pingSentTime;
      }
    });

    ws.on('message', (data) => {
      try {
        const text = data.toString();
        let payload;
        try {
          payload = JSON.parse(text);
        } catch {
          // If plain string received
          payload = { raw: text };
        }

        handleMessage(ws, payload, clientIp);
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (ws === state.esp32.wsClient) {
        console.log(`⚠️ ESP32 (${state.esp32.ip}) disconnected.`);
        state.esp32.connected = false;
        state.esp32.wsClient = null;
        broadcastToFrontend({
          type: 'esp32_status',
          connected: false,
          ip: state.esp32.ip,
          lastSeen: state.esp32.lastSeen
        });
      }
      state.frontendClients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn(`WebSocket error from ${clientIp}:`, err.message);
    });
  });

  // Heartbeat ping interval to keep connections alive and measure latency
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.pingSentTime = Date.now();
      ws.ping();
    });
  }, 10000);

  wss.on('close', () => clearInterval(interval));
}

function registerEsp32(ws, clientIp) {
  console.log(`✅ ESP32 registered at ${clientIp}`);
  state.esp32.connected = true;
  state.esp32.ip = clientIp || '10.38.24.77';
  state.esp32.wsClient = ws;
  state.esp32.lastSeen = new Date().toISOString();
  state.frontendClients.delete(ws);

  broadcastToFrontend({
    type: 'esp32_status',
    connected: true,
    ip: state.esp32.ip,
    lastSeen: state.esp32.lastSeen
  });
}

function handleMessage(ws, msg, clientIp) {
  // If message identifies client as ESP32
  if (msg.role === 'esp32' || msg.type === 'esp32_handshake' || msg.deviceId === 'esp32-horizon') {
    registerEsp32(ws, msg.ip || clientIp);
    ws.send(JSON.stringify({ type: 'handshake_ack', status: 'connected', serverTime: new Date().toISOString() }));
    return;
  }

  // Telemetry packet from ESP32
  if (msg.type === 'telemetry' || msg.voltage !== undefined || msg.power !== undefined) {
    state.esp32.connected = true;
    state.esp32.ip = clientIp || state.esp32.ip;
    state.esp32.lastSeen = new Date().toISOString();
    state.esp32.packetsReceived += 1;

    const telemetry = {
      voltage: typeof msg.voltage === 'number' ? Number(msg.voltage.toFixed(2)) : (msg.voltage || 230.0),
      current: typeof msg.current === 'number' ? Number(msg.current.toFixed(2)) : (msg.current || 0.0),
      power: typeof msg.power === 'number' ? Number(msg.power.toFixed(3)) : (msg.power || 0.0),
      frequency: typeof msg.frequency === 'number' ? Number(msg.frequency.toFixed(2)) : 50.0,
      soc: typeof msg.soc === 'number' ? Number(msg.soc.toFixed(1)) : 80.0,
      temperature: typeof msg.temperature === 'number' ? Number(msg.temperature.toFixed(1)) : 30.0,
      ir_sensor: msg.ir_sensor !== undefined ? Number(msg.ir_sensor) : 1,
      timestamp: new Date().toISOString(),
      raw: msg
    };

    state.esp32.latestTelemetry = telemetry;
    state.recentHistory.push(telemetry);
    if (state.recentHistory.length > 50) {
      state.recentHistory.shift();
    }

    // Broadcast to all active browser clients
    broadcastToFrontend({
      type: 'telemetry_update',
      esp32: {
        connected: true,
        ip: state.esp32.ip,
        lastSeen: state.esp32.lastSeen,
        latencyMs: state.esp32.latencyMs,
        packetsReceived: state.esp32.packetsReceived
      },
      data: telemetry
    });
    return;
  }

  // If frontend is sending a control command to ESP32
  if (msg.type === 'command_to_esp32') {
    if (state.esp32.wsClient && state.esp32.wsClient.readyState === WebSocket.OPEN) {
      state.esp32.wsClient.send(JSON.stringify(msg.payload || msg));
    }
  }
}

function broadcastToFrontend(payload) {
  const jsonStr = JSON.stringify(payload);
  for (const client of state.frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  }
}

/**
 * Returns the current ESP32 telemetry & connection state
 */
export function getEsp32State() {
  return {
    connected: state.esp32.connected,
    ip: state.esp32.ip,
    lastSeen: state.esp32.lastSeen,
    latencyMs: state.esp32.latencyMs,
    packetsReceived: state.esp32.packetsReceived,
    latestTelemetry: state.esp32.latestTelemetry,
    frontendClientsCount: state.frontendClients.size,
    history: state.recentHistory.slice(-20)
  };
}

/**
 * Sends a command directly to the connected ESP32
 */
export function sendCommandToEsp32(cmd) {
  if (state.esp32.wsClient && state.esp32.wsClient.readyState === WebSocket.OPEN) {
    state.esp32.wsClient.send(JSON.stringify(cmd));
    return { success: true };
  }
  return { success: false, error: 'ESP32 is not connected' };
}
