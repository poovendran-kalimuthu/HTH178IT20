import { useState, useEffect, useRef, useCallback } from 'react';

export function useEsp32() {
  const [esp32, setEsp32] = useState({
    connected: false,
    ip: '10.38.24.77',
    lastSeen: null,
    latencyMs: 0,
    packetsReceived: 0,
    latestTelemetry: null,
    history: []
  });

  const [relayStates, setRelayStates] = useState({
    relay1: false,
    relay2: false,
    relay3: false,
    relay4: false
  });

  const [uartLog, setUartLog] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/esp32/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setEsp32(prev => ({
            ...prev,
            ...json.data
          }));
          if (json.data.relayStates) {
            setRelayStates(json.data.relayStates);
          }
          if (Array.isArray(json.data.uartLog)) {
            setUartLog(json.data.uartLog);
          }
        }
      }
    } catch {
      // Backend might be restarting
    }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:5000/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init_state') {
            setEsp32(prev => ({
              ...prev,
              ...msg.esp32,
              history: msg.history || []
            }));
            if (msg.relayStates) {
              setRelayStates(msg.relayStates);
            }
            if (Array.isArray(msg.uartLog)) {
              setUartLog(msg.uartLog);
            }
          } else if (msg.type === 'telemetry_update') {
            setEsp32(prev => ({
              ...prev,
              ...msg.esp32,
              latestTelemetry: msg.data,
              history: [...(prev.history || []).slice(-19), msg.data]
            }));
          } else if (msg.type === 'relay_state_update') {
            if (msg.relayStates) {
              setRelayStates(msg.relayStates);
            }
            if (msg.lastAction) {
              setUartLog(prev => [msg.lastAction, ...prev.slice(0, 49)]);
            }
          } else if (msg.type === 'esp32_status') {
            setEsp32(prev => ({
              ...prev,
              connected: msg.connected,
              ip: msg.ip || prev.ip,
              lastSeen: msg.lastSeen
            }));
          }
        } catch {
          // Non-JSON message
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    connectWs();

    // Fallback polling every 5s if WebSocket disconnects
    const pollInterval = setInterval(() => {
      if (!wsConnected) {
        fetchStatus();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => socket.close();
        }
      }
    };
  }, [fetchStatus, connectWs, wsConnected]);

  const sendCommand = useCallback(async (command, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'command_to_esp32',
        command,
        payload
      }));
      return { success: true };
    }

    try {
      const res = await fetch('/api/esp32/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Send hardware protocol code (R1_ON, R1_OFF, ALL_OFF, etc.)
  const sendRelayCommand = useCallback(async (code) => {
    const upper = String(code).toUpperCase().trim();

    // Optimistic local state update
    setRelayStates(prev => {
      const next = { ...prev };
      if (upper === 'R1_ON') next.relay1 = true;
      else if (upper === 'R1_OFF') next.relay1 = false;
      else if (upper === 'R2_ON') next.relay2 = true;
      else if (upper === 'R2_OFF') next.relay2 = false;
      else if (upper === 'R3_ON') next.relay3 = true;
      else if (upper === 'R3_OFF') next.relay3 = false;
      else if (upper === 'R4_ON') next.relay4 = true;
      else if (upper === 'R4_OFF') next.relay4 = false;
      else if (upper === 'ALL_OFF') {
        next.relay1 = false;
        next.relay2 = false;
        next.relay3 = false;
        next.relay4 = false;
      } else if (upper === 'ALL_ON') {
        next.relay1 = true;
        next.relay2 = true;
        next.relay3 = true;
        next.relay4 = true;
      }
      return next;
    });

    const logEntry = {
      id: Date.now(),
      code: upper,
      timestamp: new Date().toISOString(),
      source: 'DASHBOARD_WIFI',
      uartTx: `${upper}\n`,
      status: 'SENT'
    };
    setUartLog(prev => [logEntry, ...prev.slice(0, 49)]);

    // 1. Direct browser-to-ESP32 POST request (identical to Postman)
    const espIp = esp32?.ip || '10.38.24.77';
    if (espIp) {
      const postDirect = (num, act) => {
        try {
          fetch(`http://${espIp}/relay/${num}/${act}`, {
            method: 'POST',
            mode: 'no-cors'
          }).catch(() => {});
        } catch {
          // ignore
        }
      };

      // Hardware Polarity Compensation for Relays 3 & 4 (Inverted / Active-HIGH)
      const getPhysicalAction = (num, desiredState) => {
        const n = Number(num);
        if (n === 3 || n === 4) {
          return desiredState === 'on' ? 'off' : 'on';
        }
        return desiredState;
      };

      // For individual relay clicks, direct browser dispatch for instant local LAN execution
      if (upper.startsWith('R') && upper.includes('_')) {
        const parts = upper.substring(1).split('_');
        const num = parseInt(parts[0], 10);
        const action = parts[1].toLowerCase();
        postDirect(num, getPhysicalAction(num, action));
      }
    }

    // 2. Dispatch via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'uart_relay',
        code: upper
      }));
    }

    // 3. Dispatch via backend REST API (handles sequential execution with hardware ACKs)
    try {
      const res = await fetch('/api/esp32/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: upper })
      });
      const data = await res.json();
      if (data && data.relayStates) {
        setRelayStates(data.relayStates);
      }
      return data;
    } catch {
      return { success: true, code: upper };
    }
  }, [esp32?.ip]);

  const pingDevice = useCallback(() => {
    return sendCommand('ping');
  }, [sendCommand]);

  return {
    esp32,
    wsConnected,
    relayStates,
    setRelayStates,
    uartLog,
    sendRelayCommand,
    sendCommand,
    pingDevice,
    refresh: fetchStatus
  };
}
