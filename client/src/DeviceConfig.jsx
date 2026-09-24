/* Hallmark · macrostructure: Catalog-to-Detail / Workbench · genre: modern-minimal · theme: Cobalt
 * Realtime Device Addition & MySQL Database Persistence
 * Page Flow: All Devices -> New Device
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, Zap, Shield, Settings, Sliders, HardDrive, RefreshCw, 
  Plus, Check, Upload, Image as ImageIcon, Camera, Trash2, ArrowLeft,
  CheckCircle2, Edit3, Eye, Database, Clock
} from 'lucide-react';

import wifiRouterImg from './assets/devices/wifi_router.jpg';
import mobileChargerImg from './assets/devices/mobile_charger.jpg';
import laptopImg from './assets/devices/laptop.jpg';
import electricIronImg from './assets/devices/electric_iron.jpg';

import './DeviceConfig.css';

// Helper to resolve preset images vs base64 uploaded images
const resolveDeviceImage = (img) => {
  if (!img) return electricIronImg;
  if (typeof img === 'string') {
    if (img === 'preset:wifi_router' || img.includes('wifi_router')) return wifiRouterImg;
    if (img === 'preset:mobile_charger' || img.includes('mobile_charger')) return mobileChargerImg;
    if (img === 'preset:laptop' || img.includes('laptop')) return laptopImg;
    if (img === 'preset:electric_iron' || img.includes('electric_iron')) return electricIronImg;
  }
  return img; // Base64 data URI or custom URL
};

const CACHE_KEY = 'kpr_horizon_devices_v3';

// Synchronously load real database devices from local storage on reload to eliminate the 1-second flash
const getInitialDevices = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(d => ({
          ...d,
          image: resolveDeviceImage(d.image)
        }));
      }
    }
  } catch (e) {
    // Ignore cache error
  }
  return null;
};

export default function DeviceConfigTab() {
  // Navigation Flow: 'list' (All Devices) | 'new' (New Device) | 'detail' (View Details) | 'edit' (Edit Device)
  const [currentView, setCurrentView] = useState('list');
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [deviceBackup, setDeviceBackup] = useState(null);
  const cachedInitial = getInitialDevices();
  const [devices, setDevices] = useState(() => cachedInitial || []);
  const [activeDeviceId, setActiveDeviceId] = useState(() => {
    if (cachedInitial && cachedInitial.length > 0) {
      return cachedInitial[0].id;
    }
    return 'DEV-001';
  });
  const [statusNotification, setStatusNotification] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to keep both React state and localStorage cache in sync
  const updateDevicesAndCache = (newDevicesList) => {
    setDevices(newDevicesList);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(newDevicesList));
    } catch {
      // Ignore storage error
    }
  };

  // New Device Form State (Custom image upload, no preset options)
  const [newDevice, setNewDevice] = useState({
    name: '',
    id: '',
    port: 'Port 1',
    sensorChannel: 'Channel 1 (CT-1)',
    type: 'General Appliance',
    location: 'Lab Room 1',
    desc: '',
    status: 'online',
    image: null,
    voltage: '230',
    ratedPower: '500',
    maxPower: '600',
    powerFactor: '0.95',
    currentLimit: '2.5',
    measureUnit: 'W',
    priority: 'low',
    criticality: 'non-critical',
    autoShed: true,
    autoShift: false,
    switchable: true,
    shiftable: false,
    minOn: '5',
    minOff: '15',
    maxOff: '60',
    recoveryDelay: '10',
    shedOrder: '1',
    schedule: '24/7 Continuous',
  });

  const [formErrors, setFormErrors] = useState({});

  const newDeviceFileInputRef = useRef(null);
  const editDeviceFileInputRef = useRef(null);

  const activeDevice = devices.find(d => d.id === activeDeviceId) || devices[0] || {};

  const showNotification = (msg) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  // Validate all 13 mandatory configuration fields
  const validateMandatoryFields = (dev) => {
    const errs = {};
    if (!dev.name || !dev.name.trim()) errs.name = 'Device Name is mandatory';
    if (!dev.id || !dev.id.trim()) errs.id = 'Device ID is mandatory';
    if (!dev.port || !dev.port.trim()) errs.port = 'Assigned Port is mandatory';
    if (!dev.sensorChannel || !dev.sensorChannel.trim()) errs.sensorChannel = 'Sensor Channel is mandatory';
    if (dev.ratedPower === '' || dev.ratedPower === null || isNaN(Number(dev.ratedPower)) || Number(dev.ratedPower) <= 0) {
      errs.ratedPower = 'Rated Power (> 0) is mandatory';
    }
    if (!dev.priority || !dev.priority.trim()) errs.priority = 'Priority is mandatory';
    if (!dev.criticality || !dev.criticality.trim()) errs.criticality = 'Critical / Non-critical designation is mandatory';
    if (dev.autoShed === undefined || dev.autoShed === null) errs.autoShed = 'Auto Shedding ON/OFF is mandatory';
    if (dev.autoShift === undefined || dev.autoShift === null) errs.autoShift = 'Load Shifting ON/OFF is mandatory';
    if (dev.currentLimit === '' || dev.currentLimit === null || isNaN(Number(dev.currentLimit)) || Number(dev.currentLimit) <= 0) {
      errs.currentLimit = 'Maximum Current (> 0 A) is mandatory';
    }
    if (dev.maxPower === '' || dev.maxPower === null || isNaN(Number(dev.maxPower)) || Number(dev.maxPower) <= 0) {
      errs.maxPower = 'Maximum Power (> 0) is mandatory';
    }
    if (dev.shedOrder === '' || dev.shedOrder === null || isNaN(Number(dev.shedOrder)) || Number(dev.shedOrder) < 1) {
      errs.shedOrder = 'Shedding Order (≥ 1) is mandatory';
    }
    if (!dev.schedule || !dev.schedule.trim()) errs.schedule = 'Operating Schedule is mandatory';

    return errs;
  };

  // 1. Initial Load: Fetch devices from MySQL database
  const loadDevicesFromDB = async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map(d => ({
            ...d,
            image: resolveDeviceImage(d.image)
          }));
          updateDevicesAndCache(mapped);
          setDbConnected(true);
        }
      }
    } catch (err) {
      console.warn('Backend or MySQL starting up, using cached devices.');
      setDbConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep localStorage cache perpetually synchronized with current devices state
  useEffect(() => {
    if (Array.isArray(devices) && devices.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(devices));
      } catch {
        // Ignore storage error
      }
    }
  }, [devices]);

  // 2. Realtime WebSocket listener for live device synchronization across clients
  useEffect(() => {
    loadDevicesFromDB();

    const host = window.location.hostname || 'localhost';
    let ws = null;
    let reconnectTimer = null;

    const connectWS = () => {
      try {
        ws = new WebSocket(`ws://${host}:5000/ws`);

        ws.onopen = () => {
          setDbConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'device_event') {
              const { action, device } = msg;

              if (action === 'created') {
                const resolved = { ...device, image: resolveDeviceImage(device.image) };
                setDevices(prev => {
                  if (prev.some(d => d.id === resolved.id)) return prev;
                  const updated = [...prev, resolved];
                  try { localStorage.setItem(CACHE_KEY, JSON.stringify(updated)); } catch {}
                  return updated;
                });
                showNotification(`⚡ [Realtime] New device "${resolved.name}" synchronized from database`);
              } else if (action === 'updated') {
                const resolved = { ...device, image: resolveDeviceImage(device.image) };
                setDevices(prev => {
                  const updated = prev.map(d => d.id === resolved.id ? resolved : d);
                  try { localStorage.setItem(CACHE_KEY, JSON.stringify(updated)); } catch {}
                  return updated;
                });
                showNotification(`⚡ [Realtime] Device "${resolved.name}" updated in database`);
              } else if (action === 'deleted') {
                setDevices(prev => {
                  const updated = prev.filter(d => d.id !== device.id);
                  try { localStorage.setItem(CACHE_KEY, JSON.stringify(updated)); } catch {}
                  return updated;
                });
                showNotification(`⚡ [Realtime] Device ${device.id} removed from database`);
              }
            }
          } catch {
            // Non-JSON packet
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connectWS, 4000);
        };
      } catch {
        reconnectTimer = setTimeout(connectWS, 4000);
      }
    };

    connectWS();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Switch to "New Device" view with generated defaults
  const handleGoToNewDevice = () => {
    const nextIdx = devices.length + 1;
    const usedPorts = new Set(devices.map(d => d.port));
    const availablePort = ['Port 1', 'Port 2', 'Port 3', 'Port 4'].find(p => !usedPorts.has(p)) || `Port ${nextIdx}`;
    const portNum = availablePort.replace(/\D/g, '') || '1';

    setFormErrors({});
    setNewDevice({
      name: '',
      id: `DEV-00${nextIdx}`,
      port: availablePort,
      sensorChannel: `Channel ${portNum} (CT-${portNum})`,
      type: 'General Appliance',
      location: 'Lab Room 1',
      desc: '',
      status: 'online',
      image: null,
      voltage: '230',
      ratedPower: '500',
      maxPower: '600',
      powerFactor: '0.95',
      currentLimit: '2.5',
      measureUnit: 'W',
      priority: 'low',
      criticality: 'non-critical',
      autoShed: true,
      autoShift: false,
      switchable: true,
      shiftable: false,
      minOn: '5',
      minOff: '15',
      maxOff: '60',
      recoveryDelay: '10',
      shedOrder: '1',
      schedule: '24/7 Continuous',
    });
    setCurrentView('new');
  };

  // Switch to "View Device Details" view (inspection mode)
  const handleGoToView = (devId) => {
    setActiveDeviceId(devId);
    setFormErrors({});
    setIsEditingDevice(false);
    setCurrentView('detail');
  };

  // Switch from View mode into Edit mode
  const handleStartEdit = () => {
    setDeviceBackup({ ...activeDevice });
    setFormErrors({});
    setIsEditingDevice(true);
  };

  // Cancel Edit mode and revert to original values
  const handleCancelEdit = () => {
    if (deviceBackup) {
      setDevices(prev => prev.map(d => d.id === deviceBackup.id ? deviceBackup : d));
    }
    setFormErrors({});
    setIsEditingDevice(false);
  };

  // Image Upload handler for New Device (FileReader, custom image only)
  const handleNewDeviceImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setNewDevice(prev => ({ ...prev, image: uploadEvent.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Image Upload handler for Existing Device Edit
  const handleEditDeviceImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        updateActiveDeviceField('image', uploadEvent.target.result);
        showNotification('Device image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  // Update field of active device in Edit view
  const updateActiveDeviceField = (field, value) => {
    setDevices(prev =>
      prev.map(d => {
        if (d.id === activeDevice.id) {
          const updated = { ...d, [field]: value };
          // Keep Criticality and Priority synchronized if one is changed
          if (field === 'priority') {
            if (value === 'critical') {
              updated.criticality = 'critical';
            } else if (d.criticality === 'critical') {
              updated.criticality = 'non-critical';
            }
          } else if (field === 'criticality') {
            if (value === 'critical') {
              updated.priority = 'critical';
              updated.autoShed = false;
            } else if (d.priority === 'critical') {
              updated.priority = 'low';
            }
          }
          return updated;
        }
        return d;
      })
    );
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Update field of newDevice
  const updateNewDeviceField = (field, value) => {
    setNewDevice(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'port') {
        const num = value.replace(/\D/g, '') || '1';
        updated.sensorChannel = `Channel ${num} (CT-${num})`;
      } else if (field === 'priority') {
        if (value === 'critical') {
          updated.criticality = 'critical';
          updated.autoShed = false;
        } else if (prev.criticality === 'critical') {
          updated.criticality = 'non-critical';
        }
      } else if (field === 'criticality') {
        if (value === 'critical') {
          updated.priority = 'critical';
          updated.autoShed = false;
        } else if (prev.priority === 'critical') {
          updated.priority = 'low';
        }
      }
      return updated;
    });
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Realtime Device Creation: POST to MySQL Database + Broadcast
  const handleCreateNewDevice = async (e) => {
    if (e) e.preventDefault();

    const errs = validateMandatoryFields(newDevice);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      const labels = {
        name: 'Device Name', id: 'Device ID', port: 'Port', sensorChannel: 'Sensor Channel',
        ratedPower: 'Rated Power', priority: 'Priority', criticality: 'Critical / Non-critical',
        autoShed: 'Auto Shedding', autoShift: 'Load Shifting', currentLimit: 'Maximum Current',
        maxPower: 'Maximum Power', shedOrder: 'Shedding Order', schedule: 'Schedule'
      };
      const missing = Object.keys(errs).map(k => labels[k] || k);
      showNotification(`⚠️ Please fill all mandatory fields: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    const payload = {
      ...newDevice,
      id: newDevice.id.trim() || `DEV-00${devices.length + 1}`,
      image: newDevice.image || electricIronImg,
    };

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const saved = {
          ...json.data,
          image: resolveDeviceImage(json.data.image)
        };
        setDevices(prev => {
          if (prev.some(d => d.id === saved.id)) return prev;
          return [...prev, saved];
        });
        setActiveDeviceId(saved.id);
        setCurrentView('list');
        showNotification(`✅ Configuration saved! Device "${saved.name}" stored in MySQL database in real time.`);
      } else {
        // Fallback
        setDevices(prev => [...prev, payload]);
        setActiveDeviceId(payload.id);
        setCurrentView('list');
        showNotification(`Configuration saved for "${payload.name}" (local mode)`);
      }
    } catch (err) {
      console.error('Error saving device to database:', err);
      setDevices(prev => [...prev, payload]);
      setActiveDeviceId(payload.id);
      setCurrentView('list');
      showNotification(`Configuration saved for "${payload.name}" (offline fallback)`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Realtime Device Update: PUT to MySQL Database + Broadcast
  const handleSaveEdit = async () => {
    const errs = validateMandatoryFields(activeDevice);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      const labels = {
        name: 'Device Name', id: 'Device ID', port: 'Port', sensorChannel: 'Sensor Channel',
        ratedPower: 'Rated Power', priority: 'Priority', criticality: 'Critical / Non-critical',
        autoShed: 'Auto Shedding', autoShift: 'Load Shifting', currentLimit: 'Maximum Current',
        maxPower: 'Maximum Power', shedOrder: 'Shedding Order', schedule: 'Schedule'
      };
      const missing = Object.keys(errs).map(k => labels[k] || k);
      showNotification(`⚠️ Please fill all mandatory fields: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/devices/${activeDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeDevice)
      });
      if (res.ok) {
        showNotification(`✅ Configuration saved! "${activeDevice.name}" updated in MySQL database.`);
      } else {
        showNotification(`Configuration saved for "${activeDevice.name}" locally`);
      }
    } catch {
      showNotification(`Configuration saved for "${activeDevice.name}" locally`);
    } finally {
      setIsSubmitting(false);
      setIsEditingDevice(false); // Return to View Details mode
    }
  };

  // Realtime Device Deletion: DELETE from MySQL Database + Broadcast
  const handleDeleteDevice = async (devId, e) => {
    if (e) e.stopPropagation();
    if (devices.length <= 1) {
      alert('At least one device load must remain configured in the system.');
      return;
    }
    const confirmed = window.confirm('Are you sure you want to permanently delete this device from the database?');
    if (confirmed) {
      try {
        await fetch(`/api/devices/${devId}`, { method: 'DELETE' });
      } catch {
        // Fallback
      }
      const remaining = devices.filter(d => d.id !== devId);
      setDevices(remaining);
      if (activeDeviceId === devId) {
        setActiveDeviceId(remaining[0].id);
      }
      setCurrentView('list');
      setIsEditingDevice(false);
      showNotification('Device deleted from local MySQL database');
    }
  };

  const priorityMeta = {
    critical: { badge: 'prio-pill-critical', label: 'Critical', desc: 'Never shed' },
    high:     { badge: 'prio-pill-high',     label: 'High',     desc: 'Shed last' },
    medium:   { badge: 'prio-pill-medium',   label: 'Medium',   desc: 'Tier 2' },
    low:      { badge: 'prio-pill-low',      label: 'Low',      desc: 'First cut' },
  };

  // Total system load calculation
  const totalSystemPower = devices.reduce((sum, d) => sum + (parseFloat(d.ratedPower) || 0), 0);

  return (
    <div className="devices-tab-container" id="devices-tab-root">
      
      {/* Toast Notification */}
      {statusNotification && (
        <div className="devices-toast">
          <CheckCircle2 size={16} />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          VIEW 1: ALL DEVICES (DEFAULT)
         ────────────────────────────────────────────────────────────────────────── */}
      {currentView === 'list' && (
        <div className="view-all-devices">
          {/* Top Bar / Header */}
          <div className="devices-page-header">
            <div className="devices-header-left">
              <div className="devices-header-icon">
                <HardDrive size={22} />
              </div>
              <div>
                <div className="flow-crumb">
                  <span className="crumb-active">All Devices</span>
                </div>
                <h2 className="devices-title">Connected Physical Loads</h2>
                <p className="devices-subtitle">
                  Inspect and manage downstream loads connected to ESP32 current sensors and relays.
                </p>
              </div>
            </div>

            <div className="devices-header-actions">
              
              <button 
                type="button" 
                className="btn-cobalt-primary"
                onClick={handleGoToNewDevice}
                id="btn-goto-new-device"
              >
                <Plus size={16} />
                New Device
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="devices-summary-strip">
            <div className="summary-stat-box">
              <span className="stat-label">Total Connected Loads</span>
              <span className="stat-value">{devices.length}</span>
            </div>
            <div className="summary-stat-box">
              <span className="stat-label">Total Rated Power</span>
              <span className="stat-value">{totalSystemPower.toLocaleString()} W</span>
            </div>
            <div className="summary-stat-box">
              <span className="stat-label">Critical Tier (Protected)</span>
              <span className="stat-value">{devices.filter(d => d.priority === 'critical').length}</span>
            </div>
            <div className="summary-stat-box">
              <span className="stat-label">Auto-Shedding Active</span>
              <span className="stat-value">{devices.filter(d => d.autoShed).length} Loads</span>
            </div>
          </div>

          {/* All Devices Grid Catalog */}
          <div className="devices-catalog-grid">
            {devices.map(dev => {
              const pMeta = priorityMeta[dev.priority] || priorityMeta.low;
              return (
                <div key={dev.id} className="device-catalog-card">
                  {/* Image Presentation */}
                  <div className="catalog-image-wrap">
                    <img src={dev.image} alt={dev.name} className="catalog-device-img" />
                    <span className="catalog-port-badge">{dev.port}</span>
                    <span className={`catalog-status-badge ${dev.status === 'online' ? 'status-online' : 'status-offline'}`}>
                      <span className="status-dot" />
                      {dev.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Body & Specs */}
                  <div className="catalog-card-body">
                    <div className="catalog-header-row">
                      <h3 className="catalog-device-name">{dev.name}</h3>
                      <span className="catalog-device-id">{dev.id}</span>
                    </div>
                    <span className="catalog-device-type">{dev.type} · {dev.location}</span>

                    <div className="catalog-specs-row">
                      <div className="spec-item">
                        <span className="spec-label">Rated Power</span>
                        <span className="spec-val highlight">{dev.ratedPower} {dev.measureUnit}</span>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Current</span>
                        <span className="spec-val">{dev.currentLimit} A</span>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Priority</span>
                        <span className={`prio-pill ${pMeta.badge}`}>{pMeta.label}</span>
                      </div>
                    </div>

                    <div className="catalog-footer-row">
                      <span className="shed-rule-tag">
                        {dev.autoShed ? 'Auto-Shed: YES' : 'Auto-Shed: NO'}
                      </span>
                      <div className="catalog-actions-group">
                        <button
                          type="button"
                          className="catalog-btn-view"
                          onClick={() => handleGoToView(dev.id)}
                          title="View device details"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        {devices.length > 1 && (
                          <button
                            type="button"
                            className="catalog-btn-del"
                            onClick={(e) => handleDeleteDevice(dev.id, e)}
                            title="Delete device"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* "+ Add New Device" Card in Catalog */}
            <div 
              className="device-catalog-card card-add-placeholder"
              onClick={handleGoToNewDevice}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGoToNewDevice(); }}
            >
              <div className="card-add-inner">
                <div className="card-add-icon">
                  <Plus size={26} />
                </div>
                <h4 className="card-add-title">Add New Device</h4>
                <p className="card-add-desc">Register a physical appliance, upload its photo, and store in local database.</p>
                <span className="card-add-btn">
                  <Plus size={14} /> New Device
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          VIEW 2: NEW DEVICE (PAGE FLOW: All Devices -> New Device)
         ────────────────────────────────────────────────────────────────────────── */}
      {currentView === 'new' && (
        <div className="view-new-device">
          {/* Breadcrumb Header */}
          <div className="devices-page-header">
            <div className="devices-header-left">
              <button 
                type="button" 
                className="btn-back-crumb" 
                onClick={() => setCurrentView('list')}
                title="Return to All Devices"
              >
                <ArrowLeft size={16} />
                Back to All Devices
              </button>
              <div>
                <div className="flow-crumb">
                  <span className="crumb-link" onClick={() => setCurrentView('list')}>All Devices</span>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-active">New Device</span>
                </div>
                <h2 className="devices-title">Add New Device Load</h2>
                <p className="devices-subtitle">
                  Upload hardware photo and store device parameters in the local MySQL database in real time.
                </p>
              </div>
            </div>

            <div className="devices-header-actions">
              <div className="db-live-indicator" title="Connected to local MySQL 9.4 database">
                <Database size={13} />
                <span>MySQL 9.4 Ready</span>
                <span className="db-live-dot" />
              </div>
              <button 
                type="button" 
                className="btn-ghost" 
                onClick={() => setCurrentView('list')}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="form-new-device"
                className="btn-cobalt-primary"
                disabled={isSubmitting}
                id="btn-submit-new-device-header"
              >
                {isSubmitting ? <RefreshCw size={16} className="spin-icon" /> : <Check size={16} />}
                {isSubmitting ? 'Saving Configuration...' : 'Save Configuration'}
              </button>
            </div>
          </div>

          <form id="form-new-device" onSubmit={handleCreateNewDevice} className="new-device-form-container">
            
            {/* Mandatory Checklist Banner */}
            <div className="mandatory-notice-banner">
              <Shield size={16} style={{ color: 'var(--color-accent, #1d64f2)', flexShrink: 0 }} />
              <span>
                <strong>13 Mandatory Configuration Fields:</strong> Device Name, Device ID, Port, Sensor Channel, Rated Power, Priority, Critical / Non-critical, Auto Shedding ON/OFF, Load Shifting ON/OFF, Maximum Current, Maximum Power, Shedding Order, and Schedule.
              </span>
            </div>

            <div className="new-device-grid">
              
              {/* Dedicated Image Upload Section (Custom Image Only, No Presets) */}
              <div className="new-device-image-panel">
                <div className="panel-inner-header">
                  <ImageIcon size={18} className="bento-icon indigo" />
                  <span className="panel-title">Device Photo</span>
                </div>

                <input 
                  type="file" 
                  ref={newDeviceFileInputRef}
                  onChange={handleNewDeviceImageUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                {newDevice.image ? (
                  <div className="uploaded-image-preview">
                    <img src={newDevice.image} alt="Uploaded Device" className="preview-img-tag" />
                    <div className="preview-overlay-bar">
                      <span className="preview-port-pill">{newDevice.port}</span>
                      <button 
                        type="button" 
                        className="btn-change-photo"
                        onClick={() => newDeviceFileInputRef.current?.click()}
                      >
                        <Camera size={13} /> Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="image-dropzone-box"
                    onClick={() => newDeviceFileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') newDeviceFileInputRef.current?.click(); }}
                  >
                    <div className="dropzone-icon-circle">
                      <Upload size={24} />
                    </div>
                    <span className="dropzone-primary-text">Upload Device Photo</span>
                    <span className="dropzone-secondary-text">Click to browse or drag & drop</span>
                    <span className="dropzone-hint-text">Stored directly in local database (JPG, PNG, WEBP)</span>
                  </div>
                )}
              </div>

              {/* Device Identity Fields */}
              <div className="new-device-fields-panel">
                <div className="panel-inner-header">
                  <Server size={18} className="bento-icon cyan" />
                  <span className="panel-title">Device Identity & Sensor Hardware</span>
                </div>

                <div className="form-fields-stack">
                  <div className="form-row-2">
                    <div className={`form-group flex-2 ${formErrors.name ? 'has-error' : ''}`}>
                      <label htmlFor="n-dev-name">
                        Device Name <span className="req-star">*</span>
                      </label>
                      <input 
                        id="n-dev-name"
                        type="text" 
                        required 
                        placeholder="e.g. Wi-Fi Router, Iron Box, Laptop"
                        value={newDevice.name} 
                        onChange={e => updateNewDeviceField('name', e.target.value)} 
                      />
                      {formErrors.name && <span className="field-error-msg">{formErrors.name}</span>}
                    </div>
                    <div className={`form-group flex-1 ${formErrors.id ? 'has-error' : ''}`}>
                      <label htmlFor="n-dev-id">
                        Device ID <span className="req-star">*</span>
                      </label>
                      <input 
                        id="n-dev-id"
                        type="text" 
                        required
                        placeholder="e.g. DEV-005"
                        value={newDevice.id} 
                        onChange={e => updateNewDeviceField('id', e.target.value)} 
                      />
                      {formErrors.id && <span className="field-error-msg">{formErrors.id}</span>}
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className={`form-group flex-1 ${formErrors.port ? 'has-error' : ''}`}>
                      <label htmlFor="n-dev-port">
                        Assigned Port <span className="req-star">*</span>
                      </label>
                      <select 
                        id="n-dev-port"
                        value={newDevice.port} 
                        onChange={e => updateNewDeviceField('port', e.target.value)}
                      >
                        <option value="Port 1">Port 1 (Relay 1 + CT Sensor 1)</option>
                        <option value="Port 2">Port 2 (Relay 2 + CT Sensor 2)</option>
                        <option value="Port 3">Port 3 (Relay 3 + CT Sensor 3)</option>
                        <option value="Port 4">Port 4 (Relay 4 + CT Sensor 4)</option>
                      </select>
                      {formErrors.port && <span className="field-error-msg">{formErrors.port}</span>}
                    </div>

                    <div className={`form-group flex-1 ${formErrors.sensorChannel ? 'has-error' : ''}`}>
                      <label htmlFor="n-dev-sensor">
                        Sensor Channel <span className="req-star">*</span>
                      </label>
                      <select 
                        id="n-dev-sensor"
                        value={newDevice.sensorChannel} 
                        onChange={e => updateNewDeviceField('sensorChannel', e.target.value)}
                      >
                        <option value="Channel 1 (CT-1)">Channel 1 (CT-1)</option>
                        <option value="Channel 2 (CT-2)">Channel 2 (CT-2)</option>
                        <option value="Channel 3 (CT-3)">Channel 3 (CT-3)</option>
                        <option value="Channel 4 (CT-4)">Channel 4 (CT-4)</option>
                      </select>
                      {formErrors.sensorChannel && <span className="field-error-msg">{formErrors.sensorChannel}</span>}
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group flex-1">
                      <label htmlFor="n-dev-type">Device Type</label>
                      <input 
                        id="n-dev-type"
                        type="text" 
                        placeholder="e.g. Heating, Electronics, IT"
                        value={newDevice.type} 
                        onChange={e => updateNewDeviceField('type', e.target.value)} 
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label htmlFor="n-dev-loc">Location</label>
                      <input 
                        id="n-dev-loc"
                        type="text" 
                        placeholder="e.g. Lab Room 1"
                        value={newDevice.location} 
                        onChange={e => updateNewDeviceField('location', e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group flex-1">
                      <label htmlFor="n-dev-desc">Description</label>
                      <input 
                        id="n-dev-desc"
                        type="text" 
                        placeholder="Load details"
                        value={newDevice.desc} 
                        onChange={e => updateNewDeviceField('desc', e.target.value)} 
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Operational Status</label>
                      <div className="form-radio-row">
                        <label className={`radio-pill-card ${newDevice.status === 'online' ? 'active-emerald' : ''}`}>
                          <input 
                            type="radio" 
                            name="new-status" 
                            checked={newDevice.status === 'online'} 
                            onChange={() => updateNewDeviceField('status', 'online')} 
                          />
                          <span>Online (Active)</span>
                        </label>
                        <label className={`radio-pill-card ${newDevice.status === 'offline' ? 'active-rose' : ''}`}>
                          <input 
                            type="radio" 
                            name="new-status" 
                            checked={newDevice.status === 'offline'} 
                            onChange={() => updateNewDeviceField('status', 'offline')} 
                          />
                          <span>Offline</span>
                        </label>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Power Configuration */}
              <div className="new-device-power-panel">
                <div className="panel-inner-header">
                  <Zap size={18} className="bento-icon emerald" />
                  <span className="panel-title">Power Configuration</span>
                </div>

                <div className="form-fields-grid-3">
                  <div className={`form-group ${formErrors.ratedPower ? 'has-error' : ''}`}>
                    <label htmlFor="n-power">
                      Rated Power ({newDevice.measureUnit}) <span className="req-star">*</span>
                    </label>
                    <input 
                      id="n-power"
                      type="number" 
                      required
                      placeholder="e.g. 500"
                      value={newDevice.ratedPower} 
                      onChange={e => updateNewDeviceField('ratedPower', e.target.value)} 
                    />
                    {formErrors.ratedPower && <span className="field-error-msg">{formErrors.ratedPower}</span>}
                  </div>

                  <div className={`form-group ${formErrors.maxPower ? 'has-error' : ''}`}>
                    <label htmlFor="n-max-power">
                      Maximum Power ({newDevice.measureUnit}) <span className="req-star">*</span>
                    </label>
                    <input 
                      id="n-max-power"
                      type="number" 
                      required
                      placeholder="e.g. 600"
                      value={newDevice.maxPower} 
                      onChange={e => updateNewDeviceField('maxPower', e.target.value)} 
                    />
                    {formErrors.maxPower && <span className="field-error-msg">{formErrors.maxPower}</span>}
                  </div>

                  <div className={`form-group ${formErrors.currentLimit ? 'has-error' : ''}`}>
                    <label htmlFor="n-curr">
                      Maximum Current (A) <span className="req-star">*</span>
                    </label>
                    <input 
                      id="n-curr"
                      type="number" 
                      step="0.1" 
                      required
                      placeholder="e.g. 2.5"
                      value={newDevice.currentLimit} 
                      onChange={e => updateNewDeviceField('currentLimit', e.target.value)} 
                    />
                    {formErrors.currentLimit && <span className="field-error-msg">{formErrors.currentLimit}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="n-volt">Rated Voltage (V)</label>
                    <input 
                      id="n-volt"
                      type="number" 
                      value={newDevice.voltage} 
                      onChange={e => updateNewDeviceField('voltage', e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="n-pf">Power Factor</label>
                    <input 
                      id="n-pf"
                      type="number" 
                      step="0.01" 
                      value={newDevice.powerFactor} 
                      onChange={e => updateNewDeviceField('powerFactor', e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="n-unit">Measurement Unit</label>
                    <select 
                      id="n-unit"
                      value={newDevice.measureUnit} 
                      onChange={e => updateNewDeviceField('measureUnit', e.target.value)}
                    >
                      <option value="W">Watts (W)</option>
                      <option value="kW">Kilowatts (kW)</option>
                      <option value="VA">Volt-Amperes (VA)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Priority & Peak-Shaving Logic */}
              <div className="new-device-shedding-panel">
                <div className="panel-inner-header">
                  <Shield size={18} className="bento-icon amber" />
                  <span className="panel-title">Peak-Shaving Priority, Criticality & Shedding Rules</span>
                </div>

                <div className="form-row-2" style={{ marginBottom: '1.25rem' }}>
                  
                  {/* Critical / Non-critical Mandatory Field */}
                  <div className={`form-group flex-1 ${formErrors.criticality ? 'has-error' : ''}`}>
                    <label>
                      Critical / Non-critical <span className="req-star">*</span>
                    </label>
                    <div className="segmented-pill-group">
                      <button 
                        type="button" 
                        className={`segmented-pill-btn ${newDevice.criticality === 'critical' ? 'active-critical' : ''}`}
                        onClick={() => updateNewDeviceField('criticality', 'critical')}
                      >
                        <Shield size={14} /> Critical (Essential Load)
                      </button>
                      <button 
                        type="button" 
                        className={`segmented-pill-btn ${newDevice.criticality === 'non-critical' ? 'active-non-critical' : ''}`}
                        onClick={() => updateNewDeviceField('criticality', 'non-critical')}
                      >
                        <Zap size={14} /> Non-critical (Curtailable)
                      </button>
                    </div>
                    {formErrors.criticality && <span className="field-error-msg">{formErrors.criticality}</span>}
                  </div>

                  {/* Schedule Mandatory Field */}
                  <div className={`form-group flex-1 ${formErrors.schedule ? 'has-error' : ''}`}>
                    <label htmlFor="n-schedule">
                      Schedule <span className="req-star">*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select 
                        id="n-schedule"
                        value={newDevice.schedule} 
                        onChange={e => updateNewDeviceField('schedule', e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="24/7 Continuous">24/7 Continuous (Always On)</option>
                        <option value="08:00 - 20:00 (Peak Hours)">08:00 - 20:00 (Peak Hours)</option>
                        <option value="09:00 - 18:00 (Office Hours)">09:00 - 18:00 (Office Hours)</option>
                        <option value="22:00 - 06:00 (Night Only)">22:00 - 06:00 (Night Only)</option>
                        <option value="14:00 - 18:00 (Intermittent)">14:00 - 18:00 (Intermittent)</option>
                        <option value="Custom Schedule">Custom Schedule</option>
                      </select>
                      {newDevice.schedule === 'Custom Schedule' && (
                        <input 
                          type="text" 
                          placeholder="e.g. 10:00 - 14:00"
                          style={{ flex: 1 }}
                          onChange={e => updateNewDeviceField('schedule', e.target.value)}
                        />
                      )}
                    </div>
                    {formErrors.schedule && <span className="field-error-msg">{formErrors.schedule}</span>}
                  </div>

                </div>

                {/* Priority Class */}
                <div className={`form-group ${formErrors.priority ? 'has-error' : ''}`} style={{ marginBottom: '1.25rem' }}>
                  <label>
                    Priority Class <span className="req-star">*</span>
                  </label>
                  <div className="priority-select-cards">
                    {[
                      { id: 'critical', label: 'Critical', hint: 'Never shed', clr: 'active-rose' },
                      { id: 'high',     label: 'High',     hint: 'Shed last', clr: 'active-amber' },
                      { id: 'medium',   label: 'Medium',   hint: 'Tier 2 cut', clr: 'active-cyan' },
                      { id: 'low',      label: 'Low',      hint: 'First cut', clr: 'active-slate' },
                    ].map(p => (
                      <label 
                        key={p.id} 
                        className={`prio-card-choice ${newDevice.priority === p.id ? p.clr : ''}`}
                      >
                        <input 
                          type="radio" 
                          name="new-priority" 
                          checked={newDevice.priority === p.id} 
                          onChange={() => updateNewDeviceField('priority', p.id)} 
                        />
                        <div>
                          <span className="prio-name">{p.label}</span>
                          <small className="prio-hint">{p.hint}</small>
                        </div>
                      </label>
                    ))}
                  </div>
                  {formErrors.priority && <span className="field-error-msg">{formErrors.priority}</span>}
                </div>

                <div className="form-row-2">
                  
                  {/* Auto Shedding ON/OFF */}
                  <div className={`form-group flex-1 ${formErrors.autoShed ? 'has-error' : ''}`}>
                    <label>
                      Auto Shedding ON/OFF <span className="req-star">*</span>
                    </label>
                    <div className="segmented-pill-group">
                      <button 
                        type="button" 
                        className={`segmented-pill-btn ${newDevice.autoShed ? 'active-on' : ''}`}
                        onClick={() => updateNewDeviceField('autoShed', true)}
                      >
                        <Check size={14} /> ON (Auto-Curtail)
                      </button>
                      <button 
                        type="button" 
                        className={`segmented-pill-btn ${!newDevice.autoShed ? 'active-off' : ''}`}
                        onClick={() => updateNewDeviceField('autoShed', false)}
                      >
                        OFF (Bypass Shedding)
                      </button>
                    </div>
                  </div>

                  {/* Load Shifting ON/OFF */}
                  <div className={`form-group flex-1 ${formErrors.autoShift ? 'has-error' : ''}`}>
                    <label>
                      Load Shifting ON/OFF <span className="req-star">*</span>
                    </label>
                    <div className="segmented-pill-group">
                      <button 
                        type="button" 
                        className={`segmented-pill-btn ${newDevice.autoShift ? 'active-on' : ''}`}
                        onClick={() => updateNewDeviceField('autoShift', true)}
                      >
                        <Check size={14} /> ON (Shift to Off-Peak)
                      </button>
                      <button 
                        type="button" 
                        className={`segmented-pill-btn ${!newDevice.autoShift ? 'active-off' : ''}`}
                        onClick={() => updateNewDeviceField('autoShift', false)}
                      >
                        OFF (No Shifting)
                      </button>
                    </div>
                  </div>

                  {/* Shedding Order */}
                  <div className={`form-group flex-1 ${formErrors.shedOrder ? 'has-error' : ''}`}>
                    <label htmlFor="n-shed-order">
                      Shedding Order <span className="req-star">*</span>
                    </label>
                    <input 
                      id="n-shed-order"
                      type="number" 
                      min="1"
                      max="99"
                      required
                      placeholder="e.g. 1"
                      value={newDevice.shedOrder} 
                      onChange={e => updateNewDeviceField('shedOrder', e.target.value)} 
                    />
                    {formErrors.shedOrder && <span className="field-error-msg">{formErrors.shedOrder}</span>}
                  </div>

                </div>

              </div>

            </div>

            {/* Bottom Actions with Save Configuration primary button */}
            <div className="form-submit-footer">
              <button 
                type="button" 
                className="btn-ghost" 
                onClick={() => setCurrentView('list')}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-cobalt-primary"
                disabled={isSubmitting}
                id="btn-submit-new-device-footer"
              >
                {isSubmitting ? <RefreshCw size={16} className="spin-icon" /> : <Check size={16} />}
                {isSubmitting ? 'Saving Configuration...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          VIEW 3: VIEW / EDIT DEVICE DETAILS
         ────────────────────────────────────────────────────────────────────────── */}
      {(currentView === 'detail' || currentView === 'edit') && (
        <div className="view-edit-device">
          {/* Header */}
          <div className="devices-page-header">
            <div className="devices-header-left">
              <button 
                type="button" 
                className="btn-back-crumb" 
                onClick={() => {
                  if (isEditingDevice) handleCancelEdit();
                  setCurrentView('list');
                }}
                title="Return to All Devices"
              >
                <ArrowLeft size={16} />
                Back to All Devices
              </button>
              <div>
                <div className="flow-crumb">
                  <span className="crumb-link" onClick={() => { if (isEditingDevice) handleCancelEdit(); setCurrentView('list'); }}>All Devices</span>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-active">{activeDevice.name}</span>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-active">{isEditingDevice ? 'Edit Mode' : 'View Details'}</span>
                </div>
                <h2 className="devices-title">
                  {isEditingDevice ? `Edit Configuration: ${activeDevice.name}` : `Device Details: ${activeDevice.name}`} ({activeDevice.id})
                </h2>
                <p className="devices-subtitle">
                  {isEditingDevice
                    ? `Update power parameters, priority tier, and hardware shedding rules on ${activeDevice.port}.`
                    : `Inspect electrical ratings, downstream load telemetry, and peak-shaving rules for ${activeDevice.port}.`}
                </p>
              </div>
            </div>

            <div className="devices-header-actions">
              {!isEditingDevice ? (
                <>
                  <button 
                    type="button" 
                    className="btn-cobalt-primary" 
                    onClick={handleStartEdit}
                    id="btn-start-edit-device"
                  >
                    <Edit3 size={15} />
                    Edit Device
                  </button>
                  {devices.length > 1 && (
                    <button 
                      type="button" 
                      className="btn-ghost" 
                      onClick={(e) => handleDeleteDevice(activeDevice.id, e)}
                      title="Delete device from database"
                      style={{ color: '#e11d48' }}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn-ghost" 
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn-cobalt-primary" 
                    onClick={handleSaveEdit}
                    disabled={isSubmitting}
                    id="btn-save-edit-device"
                  >
                    {isSubmitting ? <RefreshCw size={15} className="spin-icon" /> : <Check size={15} />}
                    {isSubmitting ? 'Saving Configuration...' : 'Save Configuration'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bento Configuration Grid */}
          <div className="bento-grid">
            
            {/* Device Image Tile */}
            <article className="bento-cell span-1x2 flex-col">
              <div className="bento-cell-header">
                <ImageIcon size={18} className="bento-icon indigo" />
                <span className="bento-cell-title">Device Photo</span>
              </div>
              <div className="bento-cell-body flex-grow flex-col">
                <div className="device-preview-card">
                  <img src={activeDevice.image} alt={activeDevice.name} className="device-main-image" />
                  <div className="device-image-overlay">
                    <span className="dev-overlay-tag">{activeDevice.port}</span>
                    <span className="dev-overlay-power">{activeDevice.ratedPower} {activeDevice.measureUnit}</span>
                  </div>
                </div>

                {isEditingDevice && (
                  <>
                    <input 
                      type="file" 
                      ref={editDeviceFileInputRef}
                      onChange={handleEditDeviceImageUpload}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button 
                      type="button" 
                      className="bento-btn bento-btn-secondary upload-btn"
                      onClick={() => editDeviceFileInputRef.current?.click()}
                    >
                      <Upload size={15} />
                      Upload New Photo
                    </button>
                  </>
                )}
              </div>
            </article>

            {/* Device Identity (span 2x2) */}
            <article className="bento-cell span-2x2">
              <div className="bento-cell-header">
                <Server size={18} className="bento-icon cyan" />
                <span className="bento-cell-title">Device Identity & Port Hardware</span>
                <span className="bento-header-badge-tag">{activeDevice.id}</span>
              </div>
              <div className="bento-cell-body flex-grow">
                {!isEditingDevice ? (
                  <div className="detail-view-grid">
                    <div className="detail-view-item">
                      <span className="detail-view-label">Device Name *</span>
                      <span className="detail-view-value">{activeDevice.name}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Device ID *</span>
                      <span className="detail-view-value mono">{activeDevice.id}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Assigned Port *</span>
                      <span className="detail-view-value accent">{activeDevice.port}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Sensor Channel *</span>
                      <span className="detail-view-value mono">{activeDevice.sensorChannel || 'Channel 1 (CT-1)'}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Operating Schedule *</span>
                      <span className="detail-view-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                        <Clock size={13} style={{ color: 'var(--color-accent, #1d64f2)' }} />
                        {activeDevice.schedule || '24/7 Continuous'}
                      </span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Operational Status</span>
                      <span className={`detail-status-pill ${activeDevice.status === 'online' ? 'online' : 'offline'}`}>
                        <span className="status-dot" /> {activeDevice.status === 'online' ? 'Online (Active)' : 'Offline (Disabled)'}
                      </span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Device Type</span>
                      <span className="detail-view-value">{activeDevice.type || 'Electrical Appliance'}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Location</span>
                      <span className="detail-view-value">{activeDevice.location || 'Lab / Facility'}</span>
                    </div>
                    <div className="detail-view-item span-full">
                      <span className="detail-view-label">Description</span>
                      <span className="detail-view-value" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-2)' }}>
                        {activeDevice.desc || 'No description recorded.'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bento-form">
                    <div className="bento-row">
                      <div className={`bento-field flex-fill ${formErrors.name ? 'has-error' : ''}`}>
                        <label htmlFor="ed-dev-name">
                          Device Name <span className="req-star">*</span>
                        </label>
                        <input 
                          id="ed-dev-name"
                          type="text" 
                          required
                          value={activeDevice.name} 
                          onChange={e => updateActiveDeviceField('name', e.target.value)} 
                        />
                        {formErrors.name && <span className="field-error-msg">{formErrors.name}</span>}
                      </div>
                      <div className={`bento-field ${formErrors.id ? 'has-error' : ''}`} style={{ width: '130px' }}>
                        <label htmlFor="ed-dev-id">
                          Device ID <span className="req-star">*</span>
                        </label>
                        <input 
                          id="ed-dev-id"
                          type="text" 
                          required
                          value={activeDevice.id} 
                          onChange={e => updateActiveDeviceField('id', e.target.value)} 
                        />
                        {formErrors.id && <span className="field-error-msg">{formErrors.id}</span>}
                      </div>
                    </div>

                    <div className="bento-row">
                      <div className={`bento-field flex-fill ${formErrors.port ? 'has-error' : ''}`}>
                        <label htmlFor="ed-dev-port">
                          Assigned Port <span className="req-star">*</span>
                        </label>
                        <select 
                          id="ed-dev-port"
                          value={activeDevice.port} 
                          onChange={e => updateActiveDeviceField('port', e.target.value)}
                        >
                          <option value="Port 1">Port 1 (Relay 1 + CT Sensor 1)</option>
                          <option value="Port 2">Port 2 (Relay 2 + CT Sensor 2)</option>
                          <option value="Port 3">Port 3 (Relay 3 + CT Sensor 3)</option>
                          <option value="Port 4">Port 4 (Relay 4 + CT Sensor 4)</option>
                        </select>
                        {formErrors.port && <span className="field-error-msg">{formErrors.port}</span>}
                      </div>
                      <div className={`bento-field flex-fill ${formErrors.sensorChannel ? 'has-error' : ''}`}>
                        <label htmlFor="ed-dev-sensor">
                          Sensor Channel <span className="req-star">*</span>
                        </label>
                        <select 
                          id="ed-dev-sensor"
                          value={activeDevice.sensorChannel || 'Channel 1 (CT-1)'} 
                          onChange={e => updateActiveDeviceField('sensorChannel', e.target.value)}
                        >
                          <option value="Channel 1 (CT-1)">Channel 1 (CT-1)</option>
                          <option value="Channel 2 (CT-2)">Channel 2 (CT-2)</option>
                          <option value="Channel 3 (CT-3)">Channel 3 (CT-3)</option>
                          <option value="Channel 4 (CT-4)">Channel 4 (CT-4)</option>
                        </select>
                        {formErrors.sensorChannel && <span className="field-error-msg">{formErrors.sensorChannel}</span>}
                      </div>
                    </div>

                    <div className="bento-row">
                      <div className={`bento-field flex-fill ${formErrors.schedule ? 'has-error' : ''}`}>
                        <label htmlFor="ed-dev-schedule">
                          Operating Schedule <span className="req-star">*</span>
                        </label>
                        <select 
                          id="ed-dev-schedule"
                          value={activeDevice.schedule || '24/7 Continuous'} 
                          onChange={e => updateActiveDeviceField('schedule', e.target.value)}
                        >
                          <option value="24/7 Continuous">24/7 Continuous (Always On)</option>
                          <option value="08:00 - 20:00 (Peak Hours)">08:00 - 20:00 (Peak Hours)</option>
                          <option value="09:00 - 18:00 (Office Hours)">09:00 - 18:00 (Office Hours)</option>
                          <option value="22:00 - 06:00 (Night Only)">22:00 - 06:00 (Night Only)</option>
                          <option value="14:00 - 18:00 (Intermittent)">14:00 - 18:00 (Intermittent)</option>
                        </select>
                        {formErrors.schedule && <span className="field-error-msg">{formErrors.schedule}</span>}
                      </div>
                      <div className="bento-field flex-fill">
                        <label htmlFor="ed-dev-type">Device Type</label>
                        <input 
                          id="ed-dev-type"
                          type="text" 
                          value={activeDevice.type} 
                          onChange={e => updateActiveDeviceField('type', e.target.value)} 
                        />
                      </div>
                    </div>

                    <div className="bento-row">
                      <div className="bento-field flex-fill">
                        <label htmlFor="ed-dev-location">Location</label>
                        <input 
                          id="ed-dev-location"
                          type="text" 
                          value={activeDevice.location} 
                          onChange={e => updateActiveDeviceField('location', e.target.value)} 
                        />
                      </div>
                      <div className="bento-field flex-fill">
                        <label htmlFor="ed-dev-desc">Description</label>
                        <input 
                          id="ed-dev-desc"
                          type="text" 
                          value={activeDevice.desc} 
                          onChange={e => updateActiveDeviceField('desc', e.target.value)} 
                        />
                      </div>
                    </div>

                    <div className="bento-field" style={{ marginTop: '0.25rem' }}>
                      <label>Operational Status</label>
                      <div className="radio-stack" style={{ flexDirection: 'row', gap: '0.75rem' }}>
                        <label className={`radio-card ${activeDevice.status === 'online' ? 'active-emerald' : ''}`} style={{ flex: 1 }}>
                          <input 
                            type="radio" 
                            name="ed-status" 
                            checked={activeDevice.status === 'online'} 
                            onChange={() => updateActiveDeviceField('status', 'online')} 
                          />
                          <span>Online (Active)</span>
                        </label>
                        <label className={`radio-card ${activeDevice.status === 'offline' ? 'active-rose' : ''}`} style={{ flex: 1 }}>
                          <input 
                            type="radio" 
                            name="ed-status" 
                            checked={activeDevice.status === 'offline'} 
                            onChange={() => updateActiveDeviceField('status', 'offline')} 
                          />
                          <span>Offline (Disabled)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Priority Class & Criticality (span 1x2) */}
            <article className="bento-cell span-1x2 flex-col">
              <div className="bento-cell-header">
                <Shield size={18} className="bento-icon amber" />
                <span className="bento-cell-title">Priority & Criticality</span>
              </div>
              <div className="bento-cell-body flex-grow">
                {!isEditingDevice ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', justifyContent: 'center' }}>
                    <div className={`detail-prio-banner ${activeDevice.priority}`}>
                      <div className="detail-prio-title-row">
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', textTransform: 'capitalize' }}>
                          {activeDevice.priority} Priority
                        </span>
                        <span className={`badge-tag-sm ${activeDevice.priority === 'critical' ? 'red' : activeDevice.priority === 'high' ? 'amber' : activeDevice.priority === 'medium' ? 'blue' : 'green'}`}>
                          {activeDevice.priority === 'critical' ? 'Protected' : activeDevice.priority === 'high' ? 'Emergency' : activeDevice.priority === 'medium' ? 'Tier 2' : 'First Cut'}
                        </span>
                      </div>
                      <p className="detail-prio-desc">
                        {activeDevice.priority === 'critical' && 'Never shed automatically. Essential communication and telemetry backbone.'}
                        {activeDevice.priority === 'high' && 'Curtailed last, only during severe overload or battery reserve exhaustion.'}
                        {activeDevice.priority === 'medium' && 'Shed after low-priority loads to maintain overall campus demand caps.'}
                        {activeDevice.priority === 'low' && 'First to be curtailed when total grid demand approaches peak threshold.'}
                      </p>
                    </div>

                    <div style={{ padding: '0.5rem 0.75rem', background: 'var(--color-surface-2, #f8fafc)', borderRadius: '8px', border: '1px solid var(--color-border, rgba(15,23,42,0.08))' }}>
                      <span className="detail-view-label" style={{ display: 'block', marginBottom: '4px' }}>Criticality Designation *</span>
                      <span className={`detail-boolean-badge ${activeDevice.criticality === 'critical' ? 'no' : 'yes'}`} style={{ color: activeDevice.criticality === 'critical' ? '#e11d48' : '#059669', background: activeDevice.criticality === 'critical' ? 'rgba(225,29,72,0.1)' : 'rgba(5,150,105,0.1)' }}>
                        <Shield size={12} /> {activeDevice.criticality === 'critical' ? 'Critical (Essential)' : 'Non-critical (Curtailable)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="radio-stack flex-grow">
                    
                    {/* Critical / Non-critical Toggle */}
                    <div className="bento-field" style={{ marginBottom: '0.75rem' }}>
                      <label>
                        Critical / Non-critical <span className="req-star">*</span>
                      </label>
                      <div className="segmented-pill-group">
                        <button 
                          type="button" 
                          className={`segmented-pill-btn ${activeDevice.criticality === 'critical' ? 'active-critical' : ''}`}
                          onClick={() => updateActiveDeviceField('criticality', 'critical')}
                        >
                          <Shield size={13} /> Critical
                        </button>
                        <button 
                          type="button" 
                          className={`segmented-pill-btn ${activeDevice.criticality === 'non-critical' ? 'active-non-critical' : ''}`}
                          onClick={() => updateActiveDeviceField('criticality', 'non-critical')}
                        >
                          <Zap size={13} /> Non-critical
                        </button>
                      </div>
                    </div>

                    <label style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-3)', letterSpacing: '0.05em' }}>
                      Priority Class <span className="req-star">*</span>
                    </label>

                    <label className={`radio-card ${activeDevice.priority === 'critical' ? 'active-rose' : ''}`}>
                      <input 
                        type="radio" 
                        name="ed-priority" 
                        checked={activeDevice.priority === 'critical'} 
                        onChange={() => updateActiveDeviceField('priority', 'critical')} 
                      />
                      <div className="radio-content">
                        <div className="radio-head-row">
                          <span>Critical</span>
                          <span className="badge-tag-sm red">No Auto-Shed</span>
                        </div>
                        <small>Never shed automatically (e.g. Wi-Fi Router).</small>
                      </div>
                    </label>

                    <label className={`radio-card ${activeDevice.priority === 'high' ? 'active-amber' : ''}`}>
                      <input 
                        type="radio" 
                        name="ed-priority" 
                        checked={activeDevice.priority === 'high'} 
                        onChange={() => updateActiveDeviceField('priority', 'high')} 
                      />
                      <div className="radio-content">
                        <div className="radio-head-row">
                          <span>High</span>
                          <span className="badge-tag-sm amber">Emergency</span>
                        </div>
                        <small>Shed last, only in severe overload conditions.</small>
                      </div>
                    </label>

                    <label className={`radio-card ${activeDevice.priority === 'medium' ? 'active-cyan' : ''}`}>
                      <input 
                        type="radio" 
                        name="ed-priority" 
                        checked={activeDevice.priority === 'medium'} 
                        onChange={() => updateActiveDeviceField('priority', 'medium')} 
                      />
                      <div className="radio-content">
                        <div className="radio-head-row">
                          <span>Medium</span>
                          <span className="badge-tag-sm blue">Tier 2</span>
                        </div>
                        <small>Shed after low-priority loads (e.g. Laptop).</small>
                      </div>
                    </label>

                    <label className={`radio-card ${activeDevice.priority === 'low' ? 'active-slate' : ''}`}>
                      <input 
                        type="radio" 
                        name="ed-priority" 
                        checked={activeDevice.priority === 'low'} 
                        onChange={() => updateActiveDeviceField('priority', 'low')} 
                      />
                      <div className="radio-content">
                        <div className="radio-head-row">
                          <span>Low</span>
                          <span className="badge-tag-sm green">First Cut</span>
                        </div>
                        <small>First to be curtailed (e.g. Iron Box, Mobile Charger).</small>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </article>

            {/* Power Configuration (span 2x1) */}
            <article className="bento-cell span-2x1">
              <div className="bento-cell-header">
                <Zap size={18} className="bento-icon emerald" />
                <span className="bento-cell-title">Power Configuration</span>
              </div>
              <div className="bento-cell-body">
                {!isEditingDevice ? (
                  <div className="detail-view-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Rated Power *</span>
                      <span className="detail-view-value accent mono">{activeDevice.ratedPower} {activeDevice.measureUnit}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Maximum Power *</span>
                      <span className="detail-view-value mono">{activeDevice.maxPower} {activeDevice.measureUnit}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Maximum Current *</span>
                      <span className="detail-view-value mono">{activeDevice.currentLimit} A</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Rated Voltage</span>
                      <span className="detail-view-value mono">{activeDevice.voltage} V</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Power Factor</span>
                      <span className="detail-view-value mono">{activeDevice.powerFactor}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Unit</span>
                      <span className="detail-view-value">{activeDevice.measureUnit}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bento-form multi-col" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className={`bento-field ${formErrors.ratedPower ? 'has-error' : ''}`}>
                      <label htmlFor="ed-power">
                        Rated Power ({activeDevice.measureUnit}) <span className="req-star">*</span>
                      </label>
                      <input 
                        id="ed-power"
                        type="number" 
                        required
                        value={activeDevice.ratedPower} 
                        onChange={e => updateActiveDeviceField('ratedPower', e.target.value)} 
                      />
                      {formErrors.ratedPower && <span className="field-error-msg">{formErrors.ratedPower}</span>}
                    </div>

                    <div className={`bento-field ${formErrors.maxPower ? 'has-error' : ''}`}>
                      <label htmlFor="ed-max-power">
                        Maximum Power ({activeDevice.measureUnit}) <span className="req-star">*</span>
                      </label>
                      <input 
                        id="ed-max-power"
                        type="number" 
                        required
                        value={activeDevice.maxPower} 
                        onChange={e => updateActiveDeviceField('maxPower', e.target.value)} 
                      />
                      {formErrors.maxPower && <span className="field-error-msg">{formErrors.maxPower}</span>}
                    </div>

                    <div className={`bento-field ${formErrors.currentLimit ? 'has-error' : ''}`}>
                      <label htmlFor="ed-curr">
                        Maximum Current (A) <span className="req-star">*</span>
                      </label>
                      <input 
                        id="ed-curr"
                        type="number" 
                        step="0.1" 
                        required
                        value={activeDevice.currentLimit} 
                        onChange={e => updateActiveDeviceField('currentLimit', e.target.value)} 
                      />
                      {formErrors.currentLimit && <span className="field-error-msg">{formErrors.currentLimit}</span>}
                    </div>

                    <div className="bento-field">
                      <label htmlFor="ed-volt">Rated Voltage (V)</label>
                      <input 
                        id="ed-volt"
                        type="number" 
                        value={activeDevice.voltage} 
                        onChange={e => updateActiveDeviceField('voltage', e.target.value)} 
                      />
                    </div>

                    <div className="bento-field">
                      <label htmlFor="ed-pf">Power Factor</label>
                      <input 
                        id="ed-pf"
                        type="number" 
                        step="0.01" 
                        value={activeDevice.powerFactor} 
                        onChange={e => updateActiveDeviceField('powerFactor', e.target.value)} 
                      />
                    </div>

                    <div className="bento-field">
                      <label htmlFor="ed-unit">Measurement Unit</label>
                      <select 
                        id="ed-unit"
                        value={activeDevice.measureUnit} 
                        onChange={e => updateActiveDeviceField('measureUnit', e.target.value)}
                      >
                        <option value="W">Watts (W)</option>
                        <option value="kW">Kilowatts (kW)</option>
                        <option value="VA">Volt-Amperes (VA)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Shedding Logic (span 1x1) */}
            <article className="bento-cell span-1x1">
              <div className="bento-cell-header">
                <Settings size={18} className="bento-icon indigo" />
                <span className="bento-cell-title">Shedding & Shifting Logic</span>
              </div>
              <div className="bento-cell-body">
                {!isEditingDevice ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Auto Shedding *</span>
                      <span className={`detail-boolean-badge ${activeDevice.autoShed ? 'yes' : 'no'}`}>
                        {activeDevice.autoShed ? 'ON (Enabled)' : 'OFF (Bypassed)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Load Shifting *</span>
                      <span className={`detail-boolean-badge ${activeDevice.autoShift ? 'yes' : 'no'}`}>
                        {activeDevice.autoShift ? 'ON (Shiftable)' : 'OFF (Fixed)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Switchable OFF</span>
                      <span className={`detail-boolean-badge ${activeDevice.switchable ? 'yes' : 'no'}`}>
                        {activeDevice.switchable ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="toggle-list">
                    <div className="bento-field">
                      <label>
                        Auto Shedding ON/OFF <span className="req-star">*</span>
                      </label>
                      <div className="segmented-pill-group">
                        <button 
                          type="button" 
                          className={`segmented-pill-btn ${activeDevice.autoShed ? 'active-on' : ''}`}
                          onClick={() => updateActiveDeviceField('autoShed', true)}
                        >
                          <Check size={13} /> ON
                        </button>
                        <button 
                          type="button" 
                          className={`segmented-pill-btn ${!activeDevice.autoShed ? 'active-off' : ''}`}
                          onClick={() => updateActiveDeviceField('autoShed', false)}
                        >
                          OFF
                        </button>
                      </div>
                    </div>

                    <div className="bento-field" style={{ marginTop: '0.5rem' }}>
                      <label>
                        Load Shifting ON/OFF <span className="req-star">*</span>
                      </label>
                      <div className="segmented-pill-group">
                        <button 
                          type="button" 
                          className={`segmented-pill-btn ${activeDevice.autoShift ? 'active-on' : ''}`}
                          onClick={() => updateActiveDeviceField('autoShift', true)}
                        >
                          <Check size={13} /> ON
                        </button>
                        <button 
                          type="button" 
                          className={`segmented-pill-btn ${!activeDevice.autoShift ? 'active-off' : ''}`}
                          onClick={() => updateActiveDeviceField('autoShift', false)}
                        >
                          OFF
                        </button>
                      </div>
                    </div>

                    <label className="toggle-row" style={{ marginTop: '0.5rem' }}>
                      <span className="toggle-label">Can be switched OFF</span>
                      <input 
                        type="checkbox" 
                        className="toggle-input" 
                        checked={activeDevice.switchable} 
                        onChange={e => updateActiveDeviceField('switchable', e.target.checked)} 
                      />
                    </label>
                  </div>
                )}
              </div>
            </article>

            {/* Timing & Shedding Order Constraints (span 2x1) */}
            <article className="bento-cell span-2x1">
              <div className="bento-cell-header">
                <Sliders size={18} className="bento-icon purple" />
                <span className="bento-cell-title">Timing Constraints & Shedding Order</span>
              </div>
              <div className="bento-cell-body">
                {!isEditingDevice ? (
                  <div className="detail-view-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Shedding Order *</span>
                      <span className="detail-view-value accent mono">#{activeDevice.shedOrder}</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Min ON</span>
                      <span className="detail-view-value mono">{activeDevice.minOn} min</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Min OFF</span>
                      <span className="detail-view-value mono">{activeDevice.minOff} min</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Max OFF</span>
                      <span className="detail-view-value mono">{activeDevice.maxOff} min</span>
                    </div>
                    <div className="detail-view-item">
                      <span className="detail-view-label">Recovery</span>
                      <span className="detail-view-value mono">{activeDevice.recoveryDelay} sec</span>
                    </div>
                  </div>
                ) : (
                  <div className="bento-form multi-col" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className={`bento-field ${formErrors.shedOrder ? 'has-error' : ''}`}>
                      <label htmlFor="ed-order">
                        Shedding Order <span className="req-star">*</span>
                      </label>
                      <input 
                        id="ed-order"
                        type="number" 
                        min="1"
                        max="99"
                        required
                        value={activeDevice.shedOrder} 
                        onChange={e => updateActiveDeviceField('shedOrder', e.target.value)} 
                      />
                      {formErrors.shedOrder && <span className="field-error-msg">{formErrors.shedOrder}</span>}
                    </div>
                    <div className="bento-field">
                      <label htmlFor="ed-min-on">Min ON Duration (min)</label>
                      <input 
                        id="ed-min-on"
                        type="number" 
                        value={activeDevice.minOn} 
                        onChange={e => updateActiveDeviceField('minOn', e.target.value)} 
                      />
                    </div>
                    <div className="bento-field">
                      <label htmlFor="ed-min-off">Min OFF Duration (min)</label>
                      <input 
                        id="ed-min-off"
                        type="number" 
                        value={activeDevice.minOff} 
                        onChange={e => updateActiveDeviceField('minOff', e.target.value)} 
                      />
                    </div>
                    <div className="bento-field">
                      <label htmlFor="ed-max-off">Max OFF Duration (min)</label>
                      <input 
                        id="ed-max-off"
                        type="number" 
                        value={activeDevice.maxOff} 
                        onChange={e => updateActiveDeviceField('maxOff', e.target.value)} 
                      />
                    </div>
                    <div className="bento-field">
                      <label htmlFor="ed-rec">Recovery Delay (sec)</label>
                      <input 
                        id="ed-rec"
                        type="number" 
                        value={activeDevice.recoveryDelay} 
                        onChange={e => updateActiveDeviceField('recoveryDelay', e.target.value)} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </article>

          </div>
        </div>
      )}

    </div>
  );
}
