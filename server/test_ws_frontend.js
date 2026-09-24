const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', () => {
  console.log('Connected to backend WebSocket as frontend client');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'telemetry_update') {
    console.log('Telemetry Update Received:');
    console.log(msg.data);
  } else if (msg.type === 'init_state') {
    console.log('Init State Received:');
    console.log(msg.esp32.latestTelemetry);
  } else {
    console.log('Other message:', msg.type);
  }
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
});
