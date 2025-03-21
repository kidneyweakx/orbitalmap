// API utility functions for serverless backend
import { Reward } from './rewardGenerator';

// Base URL for the serverless API - get from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

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