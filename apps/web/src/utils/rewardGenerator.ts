import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

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

// Initialize noise generator with fixed seed for consistent results
const prng = alea('orbital-map-fixed-seed-25trifecta');
const noise2D = createNoise2D(prng);

// Get reward value based on noise
function getRewardValueFromNoise(noiseValue: number): RewardValue {
  // Higher noise values are rarer, so they should be high-value rewards
  if (noiseValue > 0.7) {
    return RewardValue.High;
  } else if (noiseValue > 0.3) {
    return RewardValue.Medium;
  } else {
    return RewardValue.Low;
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
 * 確保添加國家邊界圖層，但不等待完成
 */
function ensureCountryBoundariesLayer(map: mapboxgl.Map): void {
  try {
    // 只在圖層不存在且地圖樣式已加載時添加
    if (map.isStyleLoaded() && !map.getSource('country-boundaries')) {
      console.log("Adding country boundaries layer");
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });
      
      map.addLayer({
        id: 'country-boundaries',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': 'rgba(0, 0, 0, 0)', // 透明填充
          'fill-outline-color': 'rgba(0, 0, 0, 0)' // 透明邊框
        },
        filter: ['all', 
          ['==', ['get', 'disputed'], 'false'],
          ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]]
        ]
      });
    }
  } catch (error) {
    console.error("Error adding country boundaries layer:", error);
  }
}

/**
 * 快速檢查一個點是否可能在陸地上
 */
function isPointOnLand(lng: number, lat: number): boolean {
  try {
    // 海洋通常在 -65 ~ -7000 米之間，而陸地則高於 -65 米
    // 使用此範圍的偽隨機數值近似判斷是否在陸地上
    const seed = Math.abs(noise2D(lng, lat));
    
    // 使用經緯度與固定種子計算一個值
    // 這個值越高越可能是陸地
    const landProbability = seed * 100;
    
    // 根據經緯度調整判斷閾值
    // 越接近赤道的地方陸地越多
    let threshold = 65;
    
    // 根據經度調整閾值 (主要大陸集中在特定經度範圍)
    if ((lng > 100 && lng < 150) || // 東亞和澳洲
        (lng > -10 && lng < 40) ||  // 歐洲和非洲
        (lng > -100 && lng < -60)) { // 美洲
      threshold = 55; // 這些區域有更多陸地
    }
    
    // 高緯度地區大多是海洋
    const absLat = Math.abs(lat);
    if (absLat > 60) {
      threshold = 85; // 極地地區多為冰蓋或海洋
    } else if (absLat > 45) {
      threshold = 75; // 較高緯度
    }
    
    return landProbability > threshold;
  } catch (error) {
    console.error("Error in simplified land check:", error);
    return false;
  }
}

/**
 * Generate a set of rewards across the map area, with preference for land
 */
export async function generateMapRewardsOnLand(
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
  density: number = 50,
  map: mapboxgl.Map
): Promise<Reward[]> {
  const rewards: Reward[] = [];
  const { north, south, east, west } = bounds;
  
  // 嘗試添加 country layer，但不等待
  ensureCountryBoundariesLayer(map);
  
  // Generate a grid of points
  const latStep = (north - south) / Math.sqrt(density);
  const lngStep = (east - west) / Math.sqrt(density);
  
  let id = 0;
  
  // Create potential points first
  const potentialPoints: Array<{lng: number, lat: number, noiseValue: number}> = [];
  
  // 使用固定的種子確保每次都生成相同的隨機點
  const rng = alea('reward-points-seed-25trifecta');
  
  for (let lat = south; lat <= north; lat += latStep) {
    for (let lng = west; lng <= east; lng += lngStep) {
      // Add some randomness to the grid
      const jitterLng = lng + (rng() - 0.5) * lngStep * 0.5;
      const jitterLat = lat + (rng() - 0.5) * latStep * 0.5;
      
      // Use noise for reward value
      const noiseValue = noise2D(jitterLng * 50, jitterLat * 50);
      
      // Only consider points where noise is positive (creates clusters)
      if (noiseValue > 0) {
        potentialPoints.push({lng: jitterLng, lat: jitterLat, noiseValue});
      }
    }
  }
  
  // 先生成一些獎勵，確保地圖上有內容
  let landRewardsCount = 0;
  
  // 檢查每個點，優先選擇可能在陸地上的點
  for (const point of potentialPoints) {
    // 使用簡化的方法檢查是否在陸地上
    const onLand = isPointOnLand(point.lng, point.lat);
    
    // 如果點在陸地上，或者我們還沒有足夠的獎勵，則添加它
    if (onLand || rewards.length < Math.min(10, density / 5)) {
      if (onLand) landRewardsCount++;
      
      const value = getRewardValueFromNoise(point.noiseValue);
      
      rewards.push({
        id: `reward-map-${Date.now()}-${id++}`,
        coordinates: [point.lng, point.lat],
        value,
        emoji: rewardEmoji[value],
        isVisible: true
      });
    }
  }
  
  // 如果找不到足夠的陸地上的點，添加一些備用點
  if (rewards.length < 10) {
    console.log("Not enough land rewards found, adding more points");
    
    // 再從剩餘的點中選擇一些
    const remainingPoints = potentialPoints.filter(point => 
      !rewards.some(r => r.coordinates[0] === point.lng && r.coordinates[1] === point.lat)
    ).slice(0, 20);
    
    for (const point of remainingPoints) {
      const value = getRewardValueFromNoise(point.noiseValue);
      rewards.push({
        id: `reward-map-fallback-${Date.now()}-${id++}`,
        coordinates: [point.lng, point.lat],
        value,
        emoji: rewardEmoji[value],
        isVisible: true
      });
    }
  }
  
  // 如果仍然沒有足夠獎勵，添加一些固定位置的備用點
  if (rewards.length === 0) {
    console.log("No rewards found, adding fallback points");
    // 添加幾個預設點（大概是陸地的位置）
    const fallbackPoints = [
      { lng: 120.9605, lat: 23.6978 }, // 台灣
      { lng: 139.6503, lat: 35.6762 }, // 東京
      { lng: 100.5018, lat: 13.7563 }, // 曼谷
      { lng: 103.8198, lat: 1.3521 },  // 新加坡
      { lng: 114.1095, lat: 22.3964 }  // 香港
    ];
    
    for (const point of fallbackPoints) {
      const noiseValue = noise2D(point.lng * 50, point.lat * 50);
      const value = getRewardValueFromNoise(Math.abs(noiseValue));
      rewards.push({
        id: `reward-map-fallback-${Date.now()}-${id++}`,
        coordinates: [point.lng, point.lat],
        value,
        emoji: rewardEmoji[value],
        isVisible: true
      });
    }
  }
  
  console.log(`Generated ${landRewardsCount} rewards on land out of ${rewards.length} total rewards`);
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

/**
 * Find rewards near a specific location
 * @param location The location coordinates [lng, lat]
 * @param rewards Array of all rewards
 * @param radius The search radius in kilometers
 * @returns Array of rewards within the radius
 */
export function findRewardsNearLocation(
  location: [number, number], 
  rewards: Reward[],
  radius: number = 0.5
): Reward[] {
  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
    point1: [number, number], 
    point2: [number, number]
  ): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    
    const dLat = toRad(point2[1] - point1[1]);
    const dLon = toRad(point2[0] - point1[0]);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(point1[1])) * Math.cos(toRad(point2[1])) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Filter rewards by distance
  return rewards.filter(reward => {
    const distance = calculateDistance(location, reward.coordinates);
    return distance <= radius && reward.isVisible;
  });
} 