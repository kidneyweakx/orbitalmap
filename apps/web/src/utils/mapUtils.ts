import { Reward } from './rewardGenerator';

// Convert rewards to GeoJSON format for heatmap
export function rewardsToHeatmapFormat(rewards: Reward[]) {
  return {
    type: 'FeatureCollection',
    features: rewards.map(reward => {
      // Weight high value rewards more heavily in the heatmap
      let weight = 1;
      if (reward.value === 'high') {
        weight = 3;
      } else if (reward.value === 'medium') {
        weight = 2;
      }
      
      return {
        type: 'Feature',
        properties: {
          weight,
          value: reward.value
        },
        geometry: {
          type: 'Point',
          coordinates: reward.coordinates
        }
      };
    })
  };
}
 