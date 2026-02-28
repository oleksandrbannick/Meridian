#!/bin/bash

# Kalshi Arbitrage Screener - Startup Script
# This script starts the Flask backend server

echo "🎯 Starting Kalshi Arbitrage Screener..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null
then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found"
    echo "Please run this script from the 'kalshi screener' directory"
    exit 1
fi

# Navigate to backend
cd backend

# Check if requirements are installed
if ! python3 -c "import flask" &> /dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements.txt
fi

echo "✅ Dependencies installed"
echo "🚀 Starting Flask server..."
echo ""
echo "📱 Open your browser and go to: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the Flask app
python3 app.py
