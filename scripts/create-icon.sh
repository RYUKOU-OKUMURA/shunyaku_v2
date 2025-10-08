#!/bin/bash

# Shunyaku v2 Icon Creation Script
# This script creates an .icns file from a high-resolution PNG image (1024x1024)

if [ $# -eq 0 ]; then
    echo "Usage: $0 <input-png-file>"
    echo "Input PNG should be 1024x1024 pixels"
    exit 1
fi

INPUT_PNG="$1"
OUTPUT_ICONSET="assets/icon.iconset"
OUTPUT_ICNS="assets/icon.icns"

# Check if input file exists
if [ ! -f "$INPUT_PNG" ]; then
    echo "Error: Input file $INPUT_PNG does not exist"
    exit 1
fi

# Create iconset directory
mkdir -p "$OUTPUT_ICONSET"

# Generate different sizes
sips -z 16 16     "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_16x16.png"
sips -z 32 32     "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_16x16@2x.png"
sips -z 32 32     "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_32x32.png"
sips -z 64 64     "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_32x32@2x.png"
sips -z 128 128   "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_128x128.png"
sips -z 256 256   "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_128x128@2x.png"
sips -z 256 256   "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_256x256.png"
sips -z 512 512   "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_256x256@2x.png"
sips -z 512 512   "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_512x512.png"
sips -z 1024 1024 "$INPUT_PNG" --out "$OUTPUT_ICONSET/icon_512x512@2x.png"

# Convert to icns
iconutil -c icns "$OUTPUT_ICONSET" -o "$OUTPUT_ICNS"

# Clean up iconset directory
rm -rf "$OUTPUT_ICONSET"

echo "Icon created: $OUTPUT_ICNS"
echo "Note: This script requires macOS with sips and iconutil commands"