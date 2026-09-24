@echo off
setlocal enabledelayedexpansion
title KPR Horizon - Fullstack Platform (MERN + MySQL)
color 0b

echo =====================================================================
echo                 KPR HORIZON FULL-STACK LAUNCHER
echo          Node.js + Express API + MySQL 9.4 + React (Vite)
echo =====================================================================
echo.

:: Ensure working directory is the script root
cd /d "%~dp0"

:: 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js from https://nodejs.org and re-run.
    echo.
    pause
    exit /b 1
)

:: 2. Check MySQL Service
echo [1/4] Checking local MySQL service status...
sc query MySQL94 | find /i "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Attempting to start MySQL94 service...
    net start MySQL94 >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Could not auto-start MySQL94 service.
        echo If MySQL is stopped, please ensure your MySQL service or MySQL Workbench is started.
    ) else (
        echo [OK] MySQL94 service started successfully.
    )
) else (
    echo [OK] MySQL94 service is active and running.
)

:: 3. Check and Install Dependencies
echo.
echo [2/4] Verifying dependencies...

if not exist "node_modules\" (
    echo [INSTALL] Installing root workspace dependencies...
    call npm install
)

if not exist "server\node_modules\" (
    echo [INSTALL] Installing backend server dependencies...
    cd server && call npm install && cd ..
)

if not exist "client\node_modules\" (
    echo [INSTALL] Installing frontend client dependencies...
    cd client && call npm install && cd ..
)

echo [OK] All dependencies verified.

:: 4. Launch Application
echo.
echo [3/4] Starting Full-Stack Development Services:
echo       * Express Backend API: http://localhost:5000
echo       * React Vite Client:   http://localhost:5173
echo       * Health Telemetry:    http://localhost:5000/api/health
echo.
echo [4/4] Opening browser to http://localhost:5173 in 4 seconds...
echo.
echo =====================================================================
echo               APP RUNNING - PRESS CTRL+C TO STOP
echo =====================================================================
echo.

:: Automatically open default browser after a brief delay
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5173"

:: Execute both backend and frontend concurrently
call npm run dev

pause
