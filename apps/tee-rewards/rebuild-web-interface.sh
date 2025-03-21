#!/bin/bash

set -e

echo "Building web interface with enhanced logging"

# Navigate to web interface directory
cd "$(dirname "$0")/web-interface"

# Build the web interface in release mode
echo "Compiling web interface..."
cargo build --release

echo "Web interface built successfully!"
echo ""
echo "Debug endpoints available at:"
echo "- GET  http://localhost:8080/debug/status - Check Enarx process status"
echo "- POST http://localhost:8080/debug/command - Send custom command to TEE"
echo ""
echo "Example curl commands:"
echo "curl http://localhost:8080/debug/status"
echo "curl -X POST -H \"Content-Type: application/json\" -d '{\"Help\": null}' http://localhost:8080/debug/command"
echo "curl -X POST -H \"Content-Type: application/json\" -d '{\"GetVisitAnalytics\": {\"lat\": 37.7749, \"lon\": -122.4194}}' http://localhost:8080/debug/command"
echo ""
echo "To run the web interface, use: ./web-interface/target/release/web-interface" 