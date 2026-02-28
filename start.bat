@echo off
REM Kalshi Arbitrage Screener - Windows Startup Script

echo Starting Kalshi Arbitrage Screener...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "backend" (
    echo Error: backend directory not found
    echo Please run this script from the 'kalshi screener' directory
    pause
    exit /b 1
)

REM Navigate to backend
cd backend

REM Check if requirements are installed
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

echo Dependencies installed
echo Starting Flask server...
echo.
echo Open your browser and go to: http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo ================================================
echo.

REM Start the Flask app
python app.py

pause
