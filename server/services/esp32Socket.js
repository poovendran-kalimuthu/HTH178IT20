import { WebSocketServer, WebSocket } from 'ws';

// Global state for ESP32 and active connections
const state = {
  esp32: {
    connected: true,
    ip: '10.38.24.77',
    lastSeen: new Date().toISOString(),
    latencyMs: 12,
    packetsReceived: 1,
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
  relayStates: {
    relay1: false,
    relay2: false,
    relay3: false,
    relay4: false
  },
  uartLog: [],
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
        relayStates: state.relayStates,
        uartLog: state.uartLog.slice(-20),
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

  // If frontend is sending a control command or UART relay action
  if (msg.type === 'command_to_esp32' || msg.type === 'uart_relay') {
    const code = msg.code || msg.payload?.code || msg.command;
    if (code) {
      updateRelayState(code);
    }
  }
}

/**
 * Updates relay states based on protocol codes (e.g. R1_ON, R1_OFF, ALL_OFF)
 * and dispatches to ESP32 physical node over WebSocket and REST
 */
export async function updateRelayState(code) {
  if (!code) return state.relayStates;
  const upper = String(code).toUpperCase().trim();

  // Optimistic initial mapping
  if (upper === 'R1_ON') state.relayStates.relay1 = true;
  else if (upper === 'R1_OFF') state.relayStates.relay1 = false;
  else if (upper === 'R2_ON') state.relayStates.relay2 = true;
  else if (upper === 'R2_OFF') state.relayStates.relay2 = false;
  else if (upper === 'R3_ON') state.relayStates.relay3 = true;
  else if (upper === 'R3_OFF') state.relayStates.relay3 = false;
  else if (upper === 'R4_ON') state.relayStates.relay4 = true;
  else if (upper === 'R4_OFF') state.relayStates.relay4 = false;
  else if (upper === 'ALL_OFF') {
    state.relayStates.relay1 = false;
    state.relayStates.relay2 = false;
    state.relayStates.relay3 = false;
    state.relayStates.relay4 = false;
  } else if (upper === 'ALL_ON') {
    state.relayStates.relay1 = true;
    state.relayStates.relay2 = true;
    state.relayStates.relay3 = true;
    state.relayStates.relay4 = true;
  }

  const logEntry = {
    id: Date.now(),
    code: upper,
    timestamp: new Date().toISOString(),
    source: 'DASHBOARD_WIFI',
    uartTx: `${upper}\n`,
    status: 'FORWARDED_TO_ARDUINO'
  };
  state.uartLog.push(logEntry);
  if (state.uartLog.length > 50) state.uartLog.shift();

  // Forward to physical ESP32 if connected via WebSocket
  if (state.esp32.wsClient && state.esp32.wsClient.readyState === WebSocket.OPEN) {
    state.esp32.wsClient.send(JSON.stringify({
      type: 'uart_relay',
      code: upper,
      rawUart: `${upper}\n`,
      sentAt: logEntry.timestamp
    }));
  }

  // Also dispatch direct HTTP POST to ESP32 Web Server (http://<ESP32_IP>/relay/1/on)
  if (state.esp32.ip) {
    const ip = state.esp32.ip;

    // Hardware Polarity Compensation:
    // Relays 1 & 2 are standard Active-LOW
    // Relays 3 & 4 are Inverted (Active-HIGH / NC contact)
    const getPhysicalAction = (num, desiredState) => {
      const n = Number(num);
      if (n === 3 || n === 4) {
        return desiredState === 'on' ? 'off' : 'on';
      }
      return desiredState;
    };

    const postRelay = async (num, action) => {
      const url = `http://${ip}/relay/${num}/${action}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(2500)
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          console.log(`[ESP32 HARDWARE ACK] ${url} ->`, data);

          // Reconcile true hardware state from ESP32 response {"relay": 1, "status": "ON"}
          if (data && data.relay !== undefined && data.status) {
            const rNum = Number(data.relay);
            const statusUpper = String(data.status).toUpperCase();
            
            // Channels 3 & 4 inverted logic compensation
            const isConfirmedActive = (rNum === 3 || rNum === 4)
              ? (statusUpper === 'OFF')
              : (statusUpper === 'ON');

            state.relayStates[`relay${rNum}`] = isConfirmedActive;

            // Broadcast verified hardware state update to dashboard
            broadcastToFrontend({
              type: 'relay_state_update',
              relayStates: { ...state.relayStates },
              confirmedByHardware: true,
              lastAction: {
                id: Date.now(),
                code: `R${rNum}_${isConfirmedActive ? 'ON' : 'OFF'}`,
                timestamp: new Date().toISOString(),
                source: 'ESP32_HARDWARE_ACK',
                uartTx: `ACK:R${rNum}_${statusUpper}`,
                status: 'CONFIRMED'
              }
            });
          }
          return data;
        }
      } catch (err) {
        console.warn(`[ESP32 REST POST Failed] ${url}:`, err.message);
      }
    };

    // Sequential execution with delays to prevent TCP connection collision on embedded ESP32 WebServer
    if (upper === 'ALL_OFF') {
      for (const n of [1, 2, 3, 4]) {
        await postRelay(n, getPhysicalAction(n, 'off'));
        await new Promise(r => setTimeout(r, 120));
      }
    } else if (upper === 'ALL_ON') {
      for (const n of [1, 2, 3, 4]) {
        await postRelay(n, getPhysicalAction(n, 'on'));
        await new Promise(r => setTimeout(r, 120));
      }
    } else if (upper.startsWith('R') && upper.includes('_')) {
      const parts = upper.substring(1).split('_');
      const num = parseInt(parts[0], 10);
      const action = parts[1].toLowerCase();
      await postRelay(num, getPhysicalAction(num, action));
    }
  }

  // Final confirmed broadcast to frontends
  broadcastToFrontend({
    type: 'relay_state_update',
    relayStates: { ...state.relayStates },
    lastAction: logEntry
  });

  return { ...state.relayStates };
}

export function broadcastToFrontend(payload) {
  const jsonStr = JSON.stringify(payload);
  for (const client of state.frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  }
}

/**
 * Returns the current ESP32 telemetry, relay states & connection state
 */
export function getEsp32State() {
  return {
    connected: state.esp32.connected,
    ip: state.esp32.ip,
    lastSeen: state.esp32.lastSeen,
    latencyMs: state.esp32.latencyMs,
    packetsReceived: state.esp32.packetsReceived,
    latestTelemetry: state.esp32.latestTelemetry,
    relayStates: state.relayStates,
    uartLog: state.uartLog.slice(-20),
    frontendClientsCount: state.frontendClients.size,
    history: state.recentHistory.slice(-20)
  };
}

/**
 * Sends a command directly to the connected ESP32
 */
export function sendCommandToEsp32(cmd) {
  if (cmd?.code) {
    updateRelayState(cmd.code);
  }
  if (state.esp32.wsClient && state.esp32.wsClient.readyState === WebSocket.OPEN) {
    state.esp32.wsClient.send(JSON.stringify(cmd));
    return { success: true };
  }
  return { success: true, simulated: true, message: 'Command recorded and simulated in memory' };
}

/**
 * Broadcast device updates (creation, modification, deletion) to all connected clients in real time
 */
export function broadcastDeviceEvent(action, device) {
  broadcastToFrontend({
    type: 'device_event',
    action, // 'created' | 'updated' | 'deleted'
    device,
    timestamp: new Date().toISOString()
  });
}

