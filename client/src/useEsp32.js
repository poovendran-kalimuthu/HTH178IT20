import { useState, useEffect, useRef, useCallback } from 'react';

export function useEsp32() {
  const [esp32, setEsp32] = useState({
    connected: false,
    ip: '10.38.24.77',
    lastSeen: null,
    latencyMs: 0,
    packetsReceived: 0,
    latestTelemetry: {
      voltage: 230.2,
      current: 12.4,
      power: 2.85,
      frequency: 50.02,
      soc: 85.0,
      temperature: 32.5,
      ir_sensor: 1,
      timestamp: new Date().toISOString()
    },
    history: []
  });

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
        }
      }
    } catch (err) {
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
          } else if (msg.type === 'telemetry_update') {
            setEsp32(prev => ({
              ...prev,
              ...msg.esp32,
              latestTelemetry: msg.data,
              history: [...(prev.history || []).slice(-19), msg.data]
            }));
          } else if (msg.type === 'esp32_status') {
            setEsp32(prev => ({
              ...prev,
              connected: msg.connected,
              ip: msg.ip || prev.ip,
              lastSeen: msg.lastSeen
            }));
          }
        } catch (e) {
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
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
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

  const pingDevice = useCallback(() => {
    return sendCommand('ping');
  }, [sendCommand]);

  return {
    esp32,
    wsConnected,
    sendCommand,
    pingDevice,
    refresh: fetchStatus
  };
}
