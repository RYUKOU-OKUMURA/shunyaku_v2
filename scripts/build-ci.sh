#!/bin/bash

# Shunyaku v2 CI Build Script
# This script is designed for continuous integration environments

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "🔄 CI Build for Shunyaku v2"
echo "Project root: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# Environment validation
echo "🔧 Environment validation..."
node --version
npm --version
echo "Platform: $(uname -s) $(uname -m)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm ci || npm install

# Code quality checks
echo "✅ Code quality checks..."
npm run lint
npm run format:check

# Run tests
echo "🧪 Running test suite..."
npm run test:unit

# Build check (without creating actual DMG in CI)
echo "🏗️  Build validation..."
echo "Skipping actual DMG creation in CI environment"
echo "Use 'npm run build:dmg' for local DMG creation"

echo ""
echo "✅ CI Build completed successfully!"