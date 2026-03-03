#!/bin/bash
# Generate placeholder PNG icons from SVG
# Requires: none (creates minimal valid PNGs)
# Replace these with real icons before publishing

for size in 16 48 128; do
  # Create a minimal SVG
  cat > "/tmp/icon-${size}.svg" << SVG
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="3" fill="#161b22"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-weight="bold" font-size="${size/2}" fill="#58a6ff">S</text>
</svg>
SVG
done
echo "SVG icons created in /tmp. Convert to PNG with: rsvg-convert or similar tool."
echo "For development, you can use SVG icons directly by changing manifest.json icon paths."
