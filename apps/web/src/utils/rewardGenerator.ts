import { createNoise2D } from 'simplex-noise';

// Reward types
export enum RewardValue {
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

export interface Reward {
  id: string;
  coordinates: [number, number];
  value: RewardValue;
  emoji: string;
  linkedSpotId?: string;
  isVisible: boolean;
}

// Map reward values to emoji
export const rewardEmoji = {
  [RewardValue.High]: '🔥',
  [RewardValue.Medium]: '⭐️',
  [RewardValue.Low]: '🍀'
};

// Map reward values to colors for heatmap
export const rewardColors = {
  [RewardValue.High]: [255, 59, 48, 150],    // Red with transparency
  [RewardValue.Medium]: [255, 149, 0, 150],  // Orange with transparency
  [RewardValue.Low]: [52, 199, 89, 150]      // Green with transparency
};

// Create a seed-based noise generator
const noise2D = createNoise2D(Math.random);

/**
 * Generate a random reward value based on a noise value
 * @param noiseValue A noise value between -1 and 1
 */
export function getRewardValueFromNoise(noiseValue: number): RewardValue {
  // Map noise value (-1 to 1) to 0-1 range
  const mappedValue = (noiseValue + 1) / 2;
  
  if (mappedValue > 0.8) {
    return RewardValue.High; // 20% chance high value
  } else if (mappedValue > 0.5) {
    return RewardValue.Medium; // 30% chance medium value
  } else {
    return RewardValue.Low; // 50% chance low value
  }
}

/**
 * Generate rewards around a specific location using noise for natural distribution
 */
export function generateRewardsAroundLocation(
  centerCoordinates: [number, number],
  radius: number = 0.01,
  count: number = 10,
  spotId?: string
): Reward[] {
  const rewards: Reward[] = [];
  const [centerLng, centerLat] = centerCoordinates;
  
  for (let i = 0; i < count; i++) {
    // Generate points in a circle around the center
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    
    // Convert polar to cartesian coordinates
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    const lng = centerLng + offsetX;
    const lat = centerLat + offsetY;
    
    // Use noise to determine reward value (adds spatial consistency)
    // Scale coordinates to get reasonable noise variation
    const noiseValue = noise2D(lng * 100, lat * 100);
    const value = getRewardValueFromNoise(noiseValue);
    
    rewards.push({
      id: `reward-${Date.now()}-${i}`,
      coordinates: [lng, lat],
      value,
      emoji: rewardEmoji[value],
      linkedSpotId: spotId,
      isVisible: true
    });
  }
  
  return rewards;
}

/**
 * Generate a set of rewards across the map area
 */
export function generateMapRewards(
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
  density: number = 50
): Reward[] {
  const rewards: Reward[] = [];
  const { north, south, east, west } = bounds;
  
  // Generate a grid of points
  const latStep = (north - south) / Math.sqrt(density);
  const lngStep = (east - west) / Math.sqrt(density);
  
  let id = 0;
  
  for (let lat = south; lat <= north; lat += latStep) {
    for (let lng = west; lng <= east; lng += lngStep) {
      // Add some randomness to the grid
      const jitterLng = lng + (Math.random() - 0.5) * lngStep * 0.5;
      const jitterLat = lat + (Math.random() - 0.5) * latStep * 0.5;
      
      // Use noise for reward value
      const noiseValue = noise2D(jitterLng * 50, jitterLat * 50);
      
      // Only place rewards where noise is positive (creates clusters)
      if (noiseValue > 0) {
        const value = getRewardValueFromNoise(noiseValue);
        
        rewards.push({
          id: `reward-map-${Date.now()}-${id++}`,
          coordinates: [jitterLng, jitterLat],
          value,
          emoji: rewardEmoji[value],
          isVisible: true
        });
      }
    }
  }
  
  return rewards;
}

/**
 * Convert rewards to a format suitable for Mapbox heatmap
 */
export function rewardsToHeatmapFormat(rewards: Reward[]): GeoJSON.FeatureCollection {
  const features = rewards.map(reward => ({
    type: 'Feature' as const,
    properties: {
      value: reward.value === RewardValue.High ? 3 : 
             reward.value === RewardValue.Medium ? 2 : 1
    },
    geometry: {
      type: 'Point' as const,
      coordinates: reward.coordinates
    }
  }));
  
  return {
    type: 'FeatureCollection',
    features
  };
} 