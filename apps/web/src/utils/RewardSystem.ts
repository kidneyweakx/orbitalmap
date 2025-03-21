import { Reward, findRewardsNearLocation, generateRewardsAroundLocation } from './rewardGenerator';
import { generateProofOfVisit, verifyProof } from './ZKService';

export interface ExplorationStats {
  visitedRewardsCount: number;
  totalPossibleRewards: number;
  explorationIndex: number; // percentage from 0-100
  collectedRewards: string[]; // ids of collected rewards
}

/**
 * Validate if a user can collect a reward based on proximity
 * @param userLocation Current user GPS coordinates [longitude, latitude]
 * @param rewards Array of all rewards on the map
 * @param proximityThreshold Maximum distance in km to collect (default: 0.05 km = 50m)
 * @returns Object with validation result, nearby rewards and distance
 */
export async function validateRewardCollection(
  userLocation: [number, number],
  rewards: Reward[],
  proximityThreshold: number = 0.05
): Promise<{
  isValid: boolean;
  nearbyRewards: Reward[];
  distance: number;
  zkProof?: unknown;
}> {
  // Find rewards near user location
  const nearbyRewards = findRewardsNearLocation(userLocation, rewards, proximityThreshold);
  
  if (nearbyRewards.length === 0) {
    return { isValid: false, nearbyRewards: [], distance: 0 };
  }
  
  // Calculate distance to closest reward
  const closestReward = nearbyRewards[0];
  
  // Calculate Haversine distance
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
  
  const distance = calculateDistance(userLocation, closestReward.coordinates);
  
  // Generate ZK proof to verify location legitimacy
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    const zkProof = await generateProofOfVisit(
      userLocation[1], // latitude
      userLocation[0], // longitude
      currentTime
    );
    
    // Verify the proof
    const isProofValid = await verifyProof(zkProof);
    
    return {
      isValid: isProofValid && distance <= proximityThreshold,
      nearbyRewards,
      distance,
      zkProof
    };
  } catch (error) {
    console.error("Error generating ZK proof:", error);
    return {
      isValid: false,
      nearbyRewards,
      distance,
    };
  }
}

/**
 * Generate new rewards around the user's current location
 * @param userLocation Current user location [longitude, latitude]
 * @param count Number of rewards to generate
 * @param radius Radius around user to generate rewards
 * @returns Array of newly generated rewards
 */
export function generateRewardsAroundUser(
  userLocation: [number, number],
  count: number = 5,
  radius: number = 0.01
): Reward[] {
  return generateRewardsAroundLocation(userLocation, radius, count);
}

/**
 * Calculate and update user's exploration stats
 * @param visitedRewardIds Array of collected reward IDs
 * @param totalRewardsInArea Total possible rewards in the current area
 * @returns Updated exploration stats
 */
export function updateExplorationStats(
  visitedRewardIds: string[],
  totalRewardsInArea: number
): ExplorationStats {
  const visitedCount = visitedRewardIds.length;
  const explorationIndex = Math.min(
    Math.round((visitedCount / Math.max(totalRewardsInArea, 1)) * 100),
    100
  );
  
  return {
    visitedRewardsCount: visitedCount,
    totalPossibleRewards: totalRewardsInArea,
    explorationIndex,
    collectedRewards: [...visitedRewardIds]
  };
}

/**
 * Generate a POAP claim URL based on exploration achievements
 * This is a mock function that would connect to a POAP API in production
 * @param walletAddress User's wallet address
 * @param explorationStats User's exploration stats
 * @returns URL for claiming POAP or null if not eligible
 */
export function generatePOAPClaimUrl(
  walletAddress: string,
  explorationStats: ExplorationStats
): string | null {
  // Require at least 50% exploration for POAP
  if (explorationStats.explorationIndex < 50) {
    return null;
  }
  
  // In a real implementation, this would call a backend API to generate a POAP claim link
  // See https://documentation.poap.tech/docs/quick-start-guide
  return `https://app.poap.xyz/claim?address=${walletAddress}&exploration=${explorationStats.explorationIndex}`;
}

/**
 * Generate an NFT badge URL based on exploration achievements 
 * @param walletAddress User's wallet address
 * @param explorationStats User's exploration stats
 * @returns Information about the NFT badge or null if not eligible
 */
export function generateExplorerBadge(
  walletAddress: string,
  explorationStats: ExplorationStats
): { badgeType: string; imageUrl: string; mintUrl: string } | null {
  // Different badges based on exploration level
  if (explorationStats.explorationIndex < 25) {
    return null;
  }
  
  let badgeType = '';
  let imageUrl = '';
  
  if (explorationStats.explorationIndex >= 75) {
    badgeType = 'Gold Explorer';
    imageUrl = '/badges/gold-explorer.png';
  } else if (explorationStats.explorationIndex >= 50) {
    badgeType = 'Silver Explorer';
    imageUrl = '/badges/silver-explorer.png';
  } else {
    badgeType = 'Bronze Explorer';
    imageUrl = '/badges/bronze-explorer.png';
  }
  
  // In a real implementation, this would generate an ERC721 mint link
  return {
    badgeType,
    imageUrl,
    mintUrl: `https://example.com/mint?badge=${badgeType}&address=${walletAddress}`
  };
} 