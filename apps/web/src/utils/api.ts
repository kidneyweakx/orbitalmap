// API utility functions for serverless backend
import { Reward } from './rewardGenerator';

// Base URL for the serverless API - get from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const TEE_API_BASE_URL = import.meta.env.VITE_TEE_API_ENDPOINT || 'http://localhost:8080';

// Function to generate rewards around a location
export async function fetchRewardsAroundLocation(
  coordinates: [number, number],
  radius: number = 0.01,
  count: number = 10,
  spotId: string = 'default-spot'
): Promise<Reward[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/generate-rewards-around`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        centerCoordinates: coordinates,
        radius,
        count,
        spotId,
        seed: `${spotId}-${Date.now()}` // Use a combination of spot ID and timestamp as seed
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.rewards || [];
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return []; // Return empty array on error
  }
}

// Function to generate rewards across a map area
export async function fetchMapRewards(
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
  gridSize: number = 10,
  spotId: string = 'map-default'
): Promise<Reward[]> {
  try {
    // Convert bounds format to match the API
    const boundsArray: [[number, number], [number, number]] = [
      [bounds.west, bounds.south], // Southwest corner
      [bounds.east, bounds.north]  // Northeast corner
    ];

    const response = await fetch(`${API_BASE_URL}/user/generate-map-rewards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bounds: boundsArray,
        gridSize,
        spotId,
        seed: `map-${Date.now()}` // Use a timestamp as seed
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.rewards || [];
  } catch (error) {
    console.error('Error fetching map rewards:', error);
    return []; // Return empty array on error
  }
}

// Function to validate if a reward can be collected
export async function validateReward(
  rewardCoordinates: [number, number],
  hotspotCoordinates: [number, number],
  maxDistance: number = 0.01
): Promise<{ isValid: boolean; distance: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/validate-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rewardCoordinates,
        hotspotCoordinates,
        maxDistance
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error validating reward:', error);
    return { isValid: false, distance: 999 }; // Return failure on error
  }
}

// TEE API functions
export interface TEELocationResponse {
  status: string;
  message: string;
  encrypted_location_id?: string;
  timestamp?: string;
  error?: string;
}

export async function teeRegisterLocation(formData: {
  lat: string;
  lon: string;
  user_id: string;
  device_id: string;
  wifi_networks: Array<{ ssid: string; bssid: string; signal_strength: number }>;
  cell_towers: Array<{ cell_id: string; signal_strength: number }>;
  accelerometer: [number, number, number] | null;
  gyroscope: [number, number, number] | null;
  is_mock_location: boolean;
}): Promise<TEELocationResponse> {
  try {
    const response = await fetch(`${TEE_API_BASE_URL}/api/location/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error registering location:', error);
    return { 
      status: 'error', 
      message: 'Failed to register location',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// NillionLLM chat API functions
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export async function sendChatRequest(request: ChatRequest): Promise<ChatMessage> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending chat request:', error);
    return { 
      role: 'assistant', 
      content: 'Sorry, there was an error processing your request. Please try again later.' 
    };
  }
}

// Travel recommendation API
export interface TravelRecommendationRequest {
  longitude: number;
  latitude: number;
  weather: string;
  interests: string[];
  hotspots: {
    name: string;
    longitude: number;
    latitude: number;
    type: string;
  }[];
}

export interface TravelRecommendation {
  place: string;
  description: string;
  itinerary: string;
}

export async function getTravelRecommendation(request: TravelRecommendationRequest): Promise<TravelRecommendation> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/travel-recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.recommendation;
  } catch (error) {
    console.error('Error getting travel recommendation:', error);
    return {
      place: 'Error',
      description: 'Failed to get travel recommendation. Please try again later.',
      itinerary: ''
    };
  }
}

// Exploration recommendation API
export interface ExplorationRecommendation {
  places: Array<{
    name: string;
    description: string;
    coordinates: [number, number];
    tags: string[];
  }>;
  route?: {
    description: string;
    waypoints: Array<[number, number]>;
  };
}

export async function getExplorationRecommendation(
  latitude: number,
  longitude: number,
  interests: string[]
): Promise<ExplorationRecommendation> {
  try {
    const response = await fetch(`${API_BASE_URL}/user/exploration-recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude,
        longitude,
        interests
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting exploration recommendation:', error);
    return { places: [], route: undefined };
  }
}

// Mapbox interaction API
export interface MapboxInteractionResponse {
  command?: string;
  coordinates?: [number, number];
  zoomLevel?: number;
  message: string;
  places?: Array<{
    name: string;
    coordinates: [number, number];
    description?: string;
  }>;
}

export async function getMapboxInteraction(
  query: string,
  currentLocation?: [number, number]
): Promise<MapboxInteractionResponse> {
  try {
    const requestBody: { query: string; currentLocation?: [number, number] } = { query };
    if (currentLocation) {
      requestBody.currentLocation = currentLocation;
    }

    const response = await fetch(`${API_BASE_URL}/user/mapbox-interaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting mapbox interaction:', error);
    return { message: 'Failed to get mapbox interaction response' };
  }
} 