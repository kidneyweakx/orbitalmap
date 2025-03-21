# TEE Rewards with Enarx in Docker

This project demonstrates how to run a Rust application in a Trusted Execution Environment (TEE) using Enarx, containerized with Docker, and exposed via an Actix-web API.

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

## Interactive WASM Application

The WASM application supports the following modes:

- **Direct usage**: `enarx run tee-rewards.wasm 10` calculates the 10th Fibonacci number
- **Interactive mode**: `enarx run tee-rewards.wasm` enters an interactive prompt where you can:
  - Enter a number to calculate its Fibonacci value
  - Type `help` to see available commands
  - Type `exit` or `quit` to exit the program
- **Commands**:
  - `help`: Display usage information
  - `interactive`: Enter interactive mode
  - Any number: Calculate the Fibonacci number at that index

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /fibonacci` - Calculate Fibonacci number using the TEE

### Example Usage

```bash
# Health check
curl http://localhost:8080/health

# Calculate Fibonacci number
curl -X POST -H "Content-Type: application/json" -d '{"n": 10}' http://localhost:8080/fibonacci
```

## Building Manually

If you want to build and run the components manually:

```bash
# Build the WASM application
cargo build --release --target=wasm32-wasi

# Run with Enarx (interactive mode)
enarx run target/wasm32-wasi/release/tee-rewards.wasm

# Run with Enarx (calculate 10th Fibonacci)
enarx run target/wasm32-wasi/release/tee-rewards.wasm 10

# Build and run the web interface
cd web-interface
cargo run --release
```

## Security Considerations

- The Enarx runtime provides TEE capabilities, ensuring that the code runs in a secure enclave
- The web interface serves as a proxy to interact with the secure application
- CORS is configured to allow any origin in this demo - modify for production use

## License

This project is licensed under the MIT License - see the LICENSE file for details. 