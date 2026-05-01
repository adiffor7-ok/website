#!/bin/bash
# Setup script for Google Photos integration
# Creates a virtual environment and installs dependencies

set -e  # Exit on error

echo "🔧 Setting up Python virtual environment..."

# Check if python3-venv is installed
if ! dpkg -l | grep -q python3-venv; then
    echo "📦 Installing python3-venv package..."
    sudo apt install -y python3-venv python3-full
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "✅ Virtual environment created!"
echo ""
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "Then install dependencies with:"
echo "  pip install -r requirements.txt"
echo ""
echo "Or run this script again with --install flag to auto-install:"
echo "  bash setup_venv.sh --install"

# If --install flag is provided, automatically install dependencies
if [ "$1" == "--install" ]; then
    echo ""
    echo "🔧 Activating virtual environment and installing dependencies..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    echo ""
    echo "✅ Setup complete! Virtual environment is active."
    echo "You can now run: python3 scripts/fetch_google_photos.py"
fi

