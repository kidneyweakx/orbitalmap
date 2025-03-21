# OrbitalMap Web Application

This is the frontend web application for OrbitalMap, providing an interactive mapping experience with reward collection features.

## Features

- Interactive Mapbox integration
- Location-based rewards and hotspots
- Serverless API integration
- Dark and light theme support
- Multi-language support
- User-created spots with custom images
- Secure authentication with web3 and email options

## Setup

1. Clone the repository
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update the `.env` file with your API keys:
   ```
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   VITE_API_BASE_URL=http://localhost:8787
   VITE_PRIVY_APP_ID=your_privy_app_id_here
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## Integration with Serverless API

This web application communicates with the serverless API for the following features:

- Generating rewards around locations
- Generating rewards across map bounds
- Validating reward collection

The API base URL can be configured in the `.env` file using the `VITE_API_BASE_URL` variable.

## Authentication

The application uses Privy for authentication, which supports:

- Email-based login
- Wallet connections (MetaMask, Coinbase, etc.)
- Social logins (Google, Apple, Discord)
- Embedded wallet creation for users without existing wallets

To set up authentication:

1. Create an account at [Privy](https://privy.io/)
2. Create a new application to get your App ID
3. Add the App ID to your `.env` file
4. Configure your allowed redirect URLs in the Privy dashboard

## Building for Production

```bash
npm run build
```

The built application will be available in the `dist` directory and can be served using any static file server.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
