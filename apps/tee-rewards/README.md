# TEE Location Services with Enarx in Docker

This project demonstrates how to run secure location services in a Trusted Execution Environment (TEE) using Enarx, containerized with Docker, and exposed via an Actix-web API.

## Project Structure

```
tee-rewards/
├── src/                    # Source code for the WASM application
├── web-interface/          # Actix-web API to interact with the WASM app
├── Dockerfile              # Docker configuration for building and running
├── docker-compose.yml      # Docker Compose setup for easy deployment
└── README.md               # This file
```

## Prerequisites

- Docker
- Docker Compose

## Getting Started

1. Clone this repository
2. Navigate to the project directory
3. Run the application with Docker Compose:

```bash
docker-compose up --build
```

This will:
- Build the Rust application for the WebAssembly target (`wasm32-wasi`)
- Package it with Enarx in a Docker container
- Set up the Actix-web API to interact with it
- Expose the API on port 8080

## Secure Location Services Features

### 1. Private Location Encryption & Decryption

User location data is securely processed within the TEE:
- Locations are encrypted using asymmetric cryptography (X25519 + ChaCha20-Poly1305)
- Frontend receives only encrypted location IDs
- Only authorized processes can decrypt locations within the TEE

### 2. Anti-Spoofing Protection (Proof of Location)

TEE validates location authenticity:
- Verifies that GPS data comes from real hardware sensors
- Compares with known WiFi networks and cell towers in the area
- Prevents users from spoofing locations to claim rewards

### 3. Secure Privacy-Preserving Heatmaps

Anonymized location analytics:
- Aggregates user locations into grid cells
- Processes data inside TEE to prevent individual user tracking
- Outputs only aggregated results

### 4. Anonymous Location Analytics

Privacy-preserving visit metrics:
- Provides 24-hour visit counts for locations
- Shows unique visitor estimates
- Identifies peak hour information
- All while protecting individual user privacy

## API Endpoints

The web interface provides REST API endpoints to interact with the TEE:

### Location Registration
```
POST /api/location/register
{
  "lat": 37.7749,
  "lon": -122.4194,
  "user_id": "user123",
  "device_id": "device456",
  "wifi_networks": [...],
  "cell_towers": [...],
  "accelerometer": [0.1, 0.2, 0.3],
  "gyroscope": [0.1, 0.2, 0.3],
  "is_mock_location": false
}
```

### Location Lookup
```
POST /api/location/get
{
  "encrypted_location_id": "ENCRYPTED_ID_FROM_REGISTRATION"
}
```

### Heatmap Generation
```
POST /api/heatmap
{
  "min_lat": 37.7,
  "min_lon": -122.5,
  "max_lat": 37.8,
  "max_lon": -122.3
}
```

### Visit Analytics
```
POST /api/analytics/visits
{
  "lat": 37.7749,
  "lon": -122.4194
}
```

### Health Check
```
GET /health
```

## Security Considerations

- The Enarx runtime provides TEE capabilities, ensuring that the code runs in a secure enclave
- All sensitive operations (encryption, decryption, verification) happen only within the TEE
- Communication between the web interface and TEE is securely managed
- CORS is configured to allow any origin in this demo - modify for production use

## License

This project is licensed under the MIT License - see the LICENSE file for details. 