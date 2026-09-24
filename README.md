# KPR Horizon - Full-Stack MERN (MySQL + Express + React + Node.js)

A modern full-stack web application built with **Node.js, Express, MySQL 9.4, React, and Vite**.

---

## 🏗️ Architecture

```
d:\Projects\KPR - Horizon\
├── package.json             # Root workspace scripts (runs server & client together)
├── server/                  # Backend Node.js & Express API
│   ├── config/
│   │   └── db.js            # MySQL2 connection pool with automated database/table creation
│   ├── controllers/
│   │   └── itemController.js # RESTful CRUD & analytics controllers
│   ├── routes/
│   │   ├── api.js           # API route router (/api/items, /api/stats)
│   │   └── health.js        # Server & MySQL ping latency telemetry (/api/health)
│   ├── .env                 # Environment config (Port & MySQL credentials)
│   ├── .env.example         # Environment template
│   ├── server.js            # Express app entry point
│   └── package.json         # Backend dependencies
└── client/                  # Frontend React + Vite
    ├── src/
    │   ├── App.jsx          # Interactive full-stack dashboard & MySQL CRUD explorer
    │   ├── index.css        # Premium dark glassmorphism design system
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js       # Vite config with proxy to Express backend (:5000)
    └── package.json
```

---

## ⚡ Quick Start

### 1. One-Click Launch (Windows)
Double-click [**`run.bat`**](file:///d:/Projects/KPR%20-%20Horizon/run.bat) in the project root, or execute:
```cmd
.\run.bat
```
This script automatically:
1. Verifies Node.js & MySQL service status.
2. Checks and installs any missing `node_modules`.
3. Concurrently launches both Express backend (`:5000`) and React Vite frontend (`:5173`).
4. Automatically opens [http://localhost:5173](http://localhost:5173) in your default browser.

---

### 2. Manual Terminal Start
Alternatively, from the project root:
```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Telemetry**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server uptime & MySQL ping/latency telemetry |
| `GET` | `/api/stats` | Record counts by status & priority |
| `GET` | `/api/items` | List records (supports `?status=...` & `?search=...`) |
| `GET` | `/api/items/:id` | Fetch single record by ID |
| `POST` | `/api/items` | Create a new record in MySQL |
| `PUT` | `/api/items/:id` | Update an existing record |
| `DELETE` | `/api/items/:id` | Delete a record |

---

## 🎨 Frontend Features
- **Live Health Telemetry**: Shows real-time backend connection status, MySQL version, and query ping latency.
- **Interactive Database Explorer**: Live search filter, status filtering, and sorting.
- **CRUD Operations**: Directly insert, edit via modal, or delete rows from the local MySQL database.
- **Design System**: Vanilla CSS dark glassmorphism, responsive cards, micro-animations, and modern typography.
