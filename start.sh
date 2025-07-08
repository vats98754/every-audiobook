#!/bin/bash

# AudioGen Startup Script
echo "🎵 Starting AudioGen - Modern Audiobook Platform"
echo "================================================"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source .venv/bin/activate

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads output

# Set default environment variables if not set
export SECRET_KEY="${SECRET_KEY:-dev-secret-key-change-in-production}"
export DB_PATH="${DB_PATH:-audiobooks.db}"

echo "🌟 Configuration:"
echo "   - Database: ${DB_PATH}"
echo "   - Upload folder: uploads/"
echo "   - Output folder: output/"
echo ""

# Start the application (database auto-initializes)
echo "🚀 Starting application..."
python app_simple.py
