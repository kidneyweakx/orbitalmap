# Serverless API for OrbitalMap

This serverless application provides AI-powered endpoints for map interactions and LLM-based recommendations.

## Features

### NillionLLM API

Endpoint: `/user/chat`

A serverless wrapper around the Nillion LLM API that provides a chat interface. This endpoint forwards requests to the Nillion API with your API key.

Example request:
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What's the weather like today?"}
  ]
}
```

### Map Interaction API

Endpoints:
- `/user/travel-recommendation` - Get travel recommendations based on user location and interests
- `/user/exploration-recommendation` - Get exploration recommendations for nearby points of interest
- `/user/mapbox-interaction` - Interactive Mapbox assistant that can interpret natural language and provide map commands

### Reward Generator API

Endpoints:
- `/user/generate-rewards-around` - Generate rewards around a specific location (land-only)
- `/user/generate-map-rewards` - Generate rewards across the map area (land-only)
- `/user/validate-reward` - Validate if a reward can be collected based on proximity to hotspot

**Note**: All reward generation endpoints include land filtering to ensure rewards only appear on land areas, not in oceans or large bodies of water. This is achieved through:
1. Geographic filtering of known ocean coordinates
2. Verification using the Open-Meteo weather API (which only returns valid data for land areas)

## Example: Travel Recommendation

Request:
```json
{
  "longitude": 121.5654,
  "latitude": 25.0330,
  "weather": "sunny",
  "interests": ["history", "food", "nature"],
  "hotspots": [
    {
      "name": "Taipei 101",
      "longitude": 121.5654,
      "latitude": 25.0330,
      "type": "attraction"
    }
  ]
}
```

Response:
```json
{
  "recommendation": {
    "place": "台北故宮博物院",
    "description": "故宮博物院擁有豐富的中國歷史文物，可滿足您對歷史的興趣...",
    "itinerary": "推薦行程：上午10點抵達故宮博物院，參觀2-3小時..."
  }
}
```

## Example: Reward Generation

Request:
```json
{
  "centerCoordinates": [121.5654, 25.0330],
  "radius": 0.01,
  "count": 10,
  "spotId": "spot-123",
  "seed": "unique-seed-123"
}
```

Response:
```json
{
  "rewards": [
    {
      "id": "reward-unique-seed-123-0",
      "coordinates": [121.5644, 25.0325],
      "value": "medium",
      "emoji": "⭐️",
      "linkedSpotId": "spot-123",
      "isVisible": true
    },
    {
      "id": "reward-unique-seed-123-1",
      "coordinates": [121.5662, 25.0335],
      "value": "high",
      "emoji": "🔥",
      "linkedSpotId": "spot-123",
      "isVisible": true
    }
  ]
}
```

## Example: Reward Validation

Request:
```json
{
  "rewardCoordinates": [121.5654, 25.0330],
  "hotspotCoordinates": [121.5657, 25.0332],
  "maxDistance": 0.01
}
```

Response:
```json
{
  "isValid": true,
  "distance": 0.05,
  "distanceDegrees": 0.0004
}
```

## Setup

1. Create a `.dev.vars` file with your environment variables:
```
AUTH_TOKEN="your_auth_token"
NILAI_API_URL="https://api.nilai.app"
NILAI_API_KEY="your_nilai_api_key"
OPEN_METEO_API_URL="https://api.open-meteo.com/v1/forecast"
```

2. Update `wrangler.toml` with your production environment variables.

3. Run locally:
```bash
npm run dev
```

4. Deploy to Cloudflare:
```bash
npm run deploy
```

## Frontend Integration

See the example React component in `examples/MapboxLLMComponent.tsx` for how to integrate with the serverless API in your frontend application.

```
npm install
npm run dev
```

```
npm run deploy
```
