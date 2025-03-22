# OrbitalMap

OrbitalMap is a privacy-focused, web3 mapping platform that combines Zero-Knowledge proofs, Trusted Execution Environments (TEE), and interactive mapping to create a secure and private geospatial experience.

## Project Structure

The project is organized as a Turborepo monorepo with the following components:

### Apps

- **web**: The main frontend application built with React, Vite, and MapBox
- **serverless**: Cloudflare Workers-based API backend
- **zk_noir**: Zero-Knowledge proof circuits using Noir language
- **tee-rewards**: Trusted Execution Environment for secure reward generation

### Key Technologies

- **Frontend**: React 19, TypeScript, Vite, MapBox GL
- **Backend**: Cloudflare Workers, Hono, OpenAPI
- **Privacy Tech**: Noir ZK proofs, Nillion for secure computations
- **Authentication**: Privy for web3 authentication
- **Internationalization**: i18next for multi-language support

## Features

OrbitalMap offers the following key features:

- **Interactive Map Interface**: Explore and interact with a privacy-preserving map.
- **Privacy-Preserving Location Sharing**: Share location data with Zero-Knowledge proofs.
- **Web3 Authentication**: Secure login with blockchain-based identity.
- **Reward System**: Earn rewards through secure TEE-validated interactions.
- **Multi-language Support**: Internationalized interface.

## API Endpoints

The API is documented with OpenAPI and accessible via Swagger UI:

- **Documentation**: `/docs` endpoint
- **User Routes**:
  - `/user/chat`: Secure LLM interactions via Nillion
  - `/user/map`: Map interaction endpoints
  - `/user/reward`: Reward generation endpoints

## Getting Started

### Prerequisites

- Node.js 18+
- Bun 1.2.5+ (package manager)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/25trifecta/orbitalmap.git
   cd orbitalmap
   ```

2. Install dependencies:
   ```
   bun install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in the `apps/web` directory
   - Copy `.dev.vars.example` to `.dev.vars` in the `apps/serverless` directory (if available)

### Running the Development Environment

To start all services in development mode:

```
bun dev
```

To run specific applications:

```
# Frontend
cd apps/web
bun dev

# Serverless backend
cd apps/serverless
bun dev
```

### Building for Production

```
bun build
```

## Project-Specific Information

### ZK Noir

The Zero-Knowledge proofs are implemented in Noir. To build the ZK circuits:

```
cd apps/zk_noir
nargo build
```

### TEE Rewards

The TEE-based reward system requires Docker:

```
cd apps/tee-rewards
./build-and-run.sh
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the LGPL LICENSE
