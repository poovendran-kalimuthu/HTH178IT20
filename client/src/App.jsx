import React, { useEffect } from 'react';
import { Esp32Tab } from './Settings.jsx';
import { Zap } from 'lucide-react';
import './Settings.css'; 

export default function App() {
  // Always Light Mode as requested
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.add('light-theme');
  }, []);

  return (
    <div className="stg-root" data-theme="light">
      <header className="ref-navbar">
        <div className="ref-nav-left">
          <div className="ref-brand">
            <span className="ref-brand-icon-wrap">
              <Zap size={20} className="ref-brand-icon" />
            </span>
            <span className="ref-brand-name">Horizon Edge</span>
          </div>

          <div className="ref-nav-path">
            <span className="ref-path-tag">PATH:</span>
            <span className="ref-path-segment ref-path-segment--active">ESP32 IR Sensor Dashboard</span>
          </div>
        </div>
      </header>
      
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <Esp32Tab />
      </div>
    </div>
  );
}
