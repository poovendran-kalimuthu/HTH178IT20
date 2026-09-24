import React, { useEffect } from 'react';
import SettingsPage from './Settings.jsx';
import './Settings.css'; 

export default function App() {
  // Always Light Mode as requested
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.add('light-theme');
  }, []);

  return <SettingsPage defaultTab="esp32" />;
}
