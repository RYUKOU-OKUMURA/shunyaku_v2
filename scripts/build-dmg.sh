#!/bin/bash

# Shunyaku v2 DMG Build Script
# This script builds the macOS DMG installer for Shunyaku v2

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
LOG_FILE="$PROJECT_ROOT/build.log"

echo "🚀 Building Shunyaku v2 DMG..."
echo "Project root: $PROJECT_ROOT"
echo "Distribution directory: $DIST_DIR"
echo ""

cd "$PROJECT_ROOT"

# Clean previous build artifacts
echo "🧹 Cleaning previous build artifacts..."
rm -rf "$DIST_DIR"
rm -f "$LOG_FILE"

# Run lint and format checks
echo "🔍 Running code quality checks..."
npm run lint:fix || {
    echo "❌ Lint check failed. Please fix linting errors."
    exit 1
}

npm run format || {
    echo "❌ Format check failed. Please run npm run format:check"
    exit 1
}

# Run tests
echo "🧪 Running tests..."
npm run test:unit || {
    echo "❌ Unit tests failed. Please fix failing tests."
    exit 1
}

# Build the application
echo "📦 Building Electron application..."
npm run build:dmg 2>&1 | tee "$LOG_FILE"

# Check if build was successful
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    
    # List generated files
    if [ -d "$DIST_DIR" ]; then
        echo ""
        echo "📁 Generated files:"
        ls -la "$DIST_DIR"
        
        # Find and display DMG file info
        DMG_FILE=$(find "$DIST_DIR" -name "*.dmg" | head -1)
        if [ -n "$DMG_FILE" ]; then
            echo ""
            echo "🎉 DMG file created: $(basename "$DMG_FILE")"
            echo "   Size: $(du -h "$DMG_FILE" | cut -f1)"
            echo "   Path: $DMG_FILE"
        else
            echo "⚠️  No DMG file found in dist directory"
        fi
    else
        echo "⚠️  Distribution directory not created"
    fi
else
    echo ""
    echo "❌ Build failed. Check the log file for details: $LOG_FILE"
    exit 1
fi

echo ""
echo "📋 Build Summary:"
echo "   - Project: Shunyaku v2"
echo "   - Build type: macOS DMG"
echo "   - Target architectures: x64, arm64"
echo "   - Output directory: $DIST_DIR"
echo "   - Log file: $LOG_FILE"
echo ""
echo "🎯 Next steps:"
echo "   1. Test the DMG installation manually"
echo "   2. Run the installed application"
echo "   3. Verify all features work correctly"
echo ""