import { Hono } from 'hono'
import { OpenAPIHono } from '@hono/zod-openapi'

// Define the environment interface
interface Env {
  NILAI_API_URL: string;
  NILAI_API_KEY: string;
  OPEN_METEO_API_URL: string;
}

// Reward types
export enum RewardValue {
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

// Define interfaces
interface Reward {
  id: string;
  coordinates: [number, number];
  value: RewardValue;
  emoji: string;
  linkedSpotId: string;
  isVisible: boolean;
}

interface LandWaterCheckResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  current: {
    is_day: number;
    time: string;
  };
}

// Map reward values to emoji
const rewardValueToEmoji = {
  [RewardValue.High]: '🔥',
  [RewardValue.Medium]: '⭐️',
  [RewardValue.Low]: '🍀'
};

const reward_route = new Hono<{ Bindings: Env }>()

// Simple hash function for deterministic value generation
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) / 2147483647; // Normalize to 0-1
}

// Convert a hash value to a reward value
function getRewardValueFromSeed(seedStr: string): RewardValue {
  const hashValue = simpleHash(seedStr);
  
  if (hashValue < 0.1) {
    return RewardValue.High; // 10% chance of high value
  } else if (hashValue < 0.4) {
    return RewardValue.Medium; // 30% chance of medium value
  } else {
    return RewardValue.Low; // 60% chance of low value
  }
}

// Function to check if coordinates are on land (not sea)
async function isLand(longitude: number, latitude: number, env: Env): Promise<boolean> {
  try {
    // First, check if coordinates are in ranges where there's mostly ocean
    // These are very rough checks to quickly filter out obvious ocean areas
    // Pacific Ocean large areas
    if ((longitude < -120 && longitude > -180) && (latitude < 60 && latitude > -60)) {
      if (
        // Avoid most of Pacific Ocean 
        (longitude < -130 && longitude > -170 && latitude < 30 && latitude > -30) ||
        // Avoid Southern Pacific
        (longitude < -100 && longitude > -160 && latitude < -30 && latitude > -60)
      ) {
        return false;
      }
    }
    
    // Atlantic Ocean
    if ((longitude < -20 && longitude > -70) && (latitude < 60 && latitude > -60)) {
      if (
        // Mid Atlantic
        (longitude < -40 && longitude > -65 && latitude < 40 && latitude > -10)
      ) {
        return false;
      }
    }
    
    // Indian Ocean
    if ((longitude > 50 && longitude < 110) && (latitude < 20 && latitude > -50)) {
      if (
        // Central Indian Ocean
        (longitude > 60 && longitude < 90 && latitude < 0 && latitude > -40)
      ) {
        return false;
      }
    }
    
    // For coordinates that pass the initial filter, make an API call to confirm
    const apiUrl = `${env.OPEN_METEO_API_URL}?latitude=${latitude}&longitude=${longitude}&current=is_day&forecast_days=1`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('Failed to check land/water status');
      return false; // If we can't verify, better to assume it's water
    }
    
    const data: LandWaterCheckResponse = await response.json();
    // Open-Meteo returns data for land points only
    // If we get a valid response with current data, it's on land
    return data && data.current && 'is_day' in data.current;
  } catch (error) {
    console.error('Error checking land/water status:', error);
    return false; // If there's an error, assume it's water to be safe
  }
}

// Generate rewards around a specific location
reward_route.post('/generate-rewards-around', async (c) => {
  try {
    const { centerCoordinates, radius, count, spotId, seed } = await c.req.json();
    
    if (!centerCoordinates || !Array.isArray(centerCoordinates) || centerCoordinates.length !== 2) {
      return c.json({ error: 'Invalid coordinates format' }, 400);
    }
    
    const [centerLng, centerLat] = centerCoordinates;
    const radiusVal = radius || 0.01; // Default radius
    const countVal = count || 10; // Default count
    const seedVal = seed || 'default-seed';
    const spotIdVal = spotId || 'default-spot'; // Default spot ID
    
    const candidateRewards: Reward[] = [];
    const validationPromises: Promise<boolean>[] = [];
    
    // Generate rewards around the center point
    for (let i = 0; i < countVal; i++) {
      // Generate a position within the radius (random distance and angle)
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * radiusVal;
      
      // Convert polar to Cartesian coordinates (approximation for small distances)
      const lng = centerLng + distance * Math.cos(angle);
      const lat = centerLat + distance * Math.sin(angle);
      
      // Get a deterministic reward value based on coordinates and seed
      const seedString = `${seedVal}-${lng.toFixed(6)}-${lat.toFixed(6)}-${i}`;
      const rewardValue = getRewardValueFromSeed(seedString);
      
      const reward: Reward = {
        id: `reward-${seedVal}-${i}`,
        coordinates: [lng, lat],
        value: rewardValue,
        emoji: rewardValueToEmoji[rewardValue],
        linkedSpotId: spotIdVal,
        isVisible: true
      };
      
      candidateRewards.push(reward);
      validationPromises.push(isLand(lng, lat, c.env as Env));
    }
    
    // Filter out rewards that are not on land
    const landChecks = await Promise.all(validationPromises);
    const landRewards = candidateRewards.filter((_, index) => landChecks[index]);
    
    return c.json({ rewards: landRewards });
  } catch (error) {
    console.error('Error generating rewards:', error);
    return c.json({ error: 'Failed to generate rewards' }, 500);
  }
});

// Generate rewards across the map area
reward_route.post('/generate-map-rewards', async (c) => {
  try {
    const { bounds, gridSize, seed, spotId } = await c.req.json();
    
    if (!bounds || 
        !Array.isArray(bounds) || 
        bounds.length !== 2 || 
        !Array.isArray(bounds[0]) || 
        !Array.isArray(bounds[1]) || 
        bounds[0].length !== 2 || 
        bounds[1].length !== 2) {
      return c.json({ error: 'Invalid bounds format' }, 400);
    }
    
    const [[swLng, swLat], [neLng, neLat]] = bounds;
    const gridSizeVal = gridSize || 10; // Default grid size
    const seedVal = seed || 'default-seed';
    const spotIdVal = spotId || 'default-spot'; // Default spot ID
    
    const candidateRewards: Reward[] = [];
    const validationPromises: Promise<boolean>[] = [];
    
    const lngDiff = neLng - swLng;
    const latDiff = neLat - swLat;
    
    // Create a grid of potential rewards
    for (let i = 0; i < gridSizeVal; i++) {
      for (let j = 0; j < gridSizeVal; j++) {
        // Add some jitter to make distribution less regular
        const jitterFactor = 0.2; // 20% jitter
        const jitterX = (Math.random() - 0.5) * jitterFactor * (lngDiff / gridSizeVal);
        const jitterY = (Math.random() - 0.5) * jitterFactor * (latDiff / gridSizeVal);
        
        const jitterLng = swLng + (i * lngDiff / gridSizeVal) + jitterX;
        const jitterLat = swLat + (j * latDiff / gridSizeVal) + jitterY;
        
        // Get a deterministic reward value based on coordinates and seed
        const seedString = `${seedVal}-${jitterLng.toFixed(6)}-${jitterLat.toFixed(6)}-${i}-${j}`;
        const rewardValue = getRewardValueFromSeed(seedString);
        
        const reward: Reward = {
          id: `reward-${seedVal}-${i}-${j}`,
          coordinates: [jitterLng, jitterLat],
          value: rewardValue,
          emoji: rewardValueToEmoji[rewardValue],
          linkedSpotId: spotIdVal,
          isVisible: true
        };
        
        candidateRewards.push(reward);
        validationPromises.push(isLand(jitterLng, jitterLat, c.env as Env));
      }
    }
    
    // Filter out rewards that are not on land
    const landChecks = await Promise.all(validationPromises);
    const landRewards = candidateRewards.filter((_, index) => landChecks[index]);
    
    return c.json({ rewards: landRewards });
  } catch (error) {
    console.error('Error generating map rewards:', error);
    return c.json({ error: 'Failed to generate map rewards' }, 500);
  }
});

// Validate reward endpoint
reward_route.post('/validate-reward', async (c) => {
  try {
    const { rewardCoordinates, hotspotCoordinates, maxDistance } = await c.req.json();
    
    if (!rewardCoordinates || !Array.isArray(rewardCoordinates) || rewardCoordinates.length !== 2 ||
        !hotspotCoordinates || !Array.isArray(hotspotCoordinates) || hotspotCoordinates.length !== 2) {
      return c.json({ error: 'Invalid coordinates format' }, 400);
    }
    
    const [rewardLng, rewardLat] = rewardCoordinates;
    const [hotspotLng, hotspotLat] = hotspotCoordinates;
    const maxDistVal = maxDistance || 0.01; // Default max distance (~1km)
    
    // Calculate distance between reward and hotspot (approximate in degrees)
    const distanceDegrees = Math.sqrt(
      Math.pow(rewardLng - hotspotLng, 2) + 
      Math.pow(rewardLat - hotspotLat, 2)
    );
    
    // Convert to kilometers (very rough approximation)
    // 1 degree is approximately 111km at the equator, but varies with latitude
    const distance = distanceDegrees * 111;
    
    // Validate if the reward is close enough to the hotspot
    const isValid = distanceDegrees <= maxDistVal;
    
    return c.json({
      isValid,
      distance, // in km (approximate)
      distanceDegrees
    });
  } catch (error) {
    console.error('Error validating reward:', error);
    return c.json({ error: 'Failed to validate reward' }, 500);
  }
});

export { reward_route } 