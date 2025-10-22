#!/bin/bash
# Setup script for usql-mcp development environment

set -e

echo "🚀 Setting up usql-mcp..."
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

if ! command -v usql &> /dev/null; then
    echo "⚠️  usql CLI not found. Install it for full functionality:"
    echo "   macOS: brew install usql"
    echo "   Linux: https://github.com/xo/usql#installation"
    read -p "Continue without usql? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version must be 16 or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"
echo "✅ npm $(npm -v)"
command -v usql &> /dev/null && echo "✅ usql $(usql --version 2>&1 | head -1)" || echo "⚠️  usql not in PATH"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Build
echo "🔨 Building TypeScript..."
npm run build
echo ""

# Setup test database (if sqlite3 is available)
if command -v sqlite3 &> /dev/null; then
    echo "🗄️  Setting up test database..."
    mkdir -p tests/fixtures
    sqlite3 tests/fixtures/test.db < tests/fixtures/schema.sql
    echo "✅ Test database created at tests/fixtures/test.db"
else
    echo "⚠️  sqlite3 not found. Skipping test database setup."
    echo "   Install it to run integration tests:"
    echo "   macOS: brew install sqlite"
    echo "   Linux: sudo apt-get install sqlite3"
fi
echo ""

# Run unit tests
echo "🧪 Running unit tests..."
npm run test:unit
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your databases:"
echo "   cp config.example.json config.json"
echo "   # Edit config.json with your database connections"
echo ""
echo "2. Or set environment variables:"
echo "   export USQL_POSTGRES='postgres://user:pass@localhost/db'"
echo ""
echo "3. Run the server:"
echo "   npm start"
echo ""
echo "4. For development:"
echo "   npm run dev          # Watch mode"
echo "   npm test             # Run all tests"
echo "   DEBUG=usql-mcp:* npm start  # With logging"
echo ""
echo "📖 See QUICKSTART.md for more details."
