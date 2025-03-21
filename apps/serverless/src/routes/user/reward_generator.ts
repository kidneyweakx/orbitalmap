import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { createRoute } from '@hono/zod-openapi'

export type HonoContext = {
  Bindings: {
    OPEN_METEO_API_URL: string
  }
}

enum RewardValue {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

interface Reward {
  latitude: number
  longitude: number
  value: RewardValue
  emoji: string
  id: string
}

interface LandWaterCheckResponse {
  is_land: boolean
}

const rewardValueToEmoji = {
  [RewardValue.High]: '🌟',
  [RewardValue.Medium]: '⭐',
  [RewardValue.Low]: '✨',
}

// Simple deterministic hash function
function simpleHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) & 0xffffffff
  }
  // Normalize to 0-1 range
  return (hash & 0x7fffffff) / 0x7fffffff
}

function getRewardValueFromSeed(seed: string, lat: number, lng: number): RewardValue {
  const locationSeed = `${seed}-${lat.toFixed(6)}-${lng.toFixed(6)}`
  const hashValue = simpleHash(locationSeed)

  if (hashValue > 0.9) {
    return RewardValue.High
  } else if (hashValue > 0.7) {
    return RewardValue.Medium
  } else {
    return RewardValue.Low
  }
}

// Check if a point is on land using Open-Meteo API
async function isLand(
  c: { env: { OPEN_METEO_API_URL: string } },
  latitude: number,
  longitude: number
): Promise<boolean> {
  try {
    const url = `${c.env.OPEN_METEO_API_URL}/v1/land?latitude=${latitude}&longitude=${longitude}`
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Error checking land/water: ${response.statusText}`)
      // Default to true to not block rewards if API fails
      return true
    }

    const data = await response.json() as LandWaterCheckResponse
    return data.is_land
  } catch (error) {
    console.error('Error checking if point is on land:', error)
    // Default to true to not block rewards if API fails
    return true
  }
}

const generateRewardsAroundLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(0.01).max(5),
  count: z.number().min(1).max(100),
  seed: z.string().min(1)
})

const generateMapRewardsSchema = z.object({
  bounds: z.object({
    north: z.number().min(-90).max(90),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    west: z.number().min(-180).max(180)
  }),
  count: z.number().min(1).max(500),
  seed: z.string().min(1)
})

const validateRewardSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  rewardId: z.string().min(1),
  hotspots: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    id: z.string().min(1)
  }))
})

// Create the OpenAPI route
const reward_route = new OpenAPIHono<HonoContext>()

// Route to generate rewards around a location
const generateRewardsAroundLocationRoute = createRoute({
  method: 'post',
  path: '/generate-rewards-around',
  request: {
    body: {
      content: {
        'application/json': {
          schema: generateRewardsAroundLocationSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            rewards: z.array(z.object({
              latitude: z.number(),
              longitude: z.number(),
              value: z.string(),
              emoji: z.string(),
              id: z.string()
            }))
          })
        }
      },
      description: 'Successfully generated rewards around location'
    }
  }
})

reward_route.openapi(generateRewardsAroundLocationRoute, async (c) => {
  const { latitude, longitude, radius, count, seed } = await c.req.json()
  const rewards: Reward[] = []

  for (let i = 0; i < count; i++) {
    // Generate a point within the radius
    const angle = Math.random() * 2 * Math.PI
    const distance = Math.random() * radius
    
    // Convert to lat/lng (approximate method, works for small distances)
    const lat = latitude + (distance * Math.cos(angle) * 0.009)
    const lng = longitude + (distance * Math.sin(angle) * 0.009 / Math.cos(latitude * Math.PI / 180))
    
    // Check if point is on land
    const onLand = await isLand(c, lat, lng)
    if (!onLand) {
      // Skip this point and try again
      i--
      continue
    }
    
    const value = getRewardValueFromSeed(seed, lat, lng)
    const id = `${seed}-${lat.toFixed(6)}-${lng.toFixed(6)}`
    
    rewards.push({
      latitude: lat,
      longitude: lng,
      value,
      emoji: rewardValueToEmoji[value],
      id
    })
  }
  
  return c.json({ rewards })
})

// Route to generate rewards across a map area
const generateMapRewardsRoute = createRoute({
  method: 'post',
  path: '/generate-map-rewards',
  request: {
    body: {
      content: {
        'application/json': {
          schema: generateMapRewardsSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            rewards: z.array(z.object({
              latitude: z.number(),
              longitude: z.number(),
              value: z.string(),
              emoji: z.string(),
              id: z.string()
            }))
          })
        }
      },
      description: 'Successfully generated rewards across map area'
    }
  }
})

reward_route.openapi(generateMapRewardsRoute, async (c) => {
  const { bounds, count, seed } = await c.req.json()
  const rewards: Reward[] = []
  
  // Calculate the width and height of the bounding box
  const latDiff = bounds.north - bounds.south
  const lngDiff = bounds.east - bounds.west
  
  let attempts = 0
  const maxAttempts = count * 3 // Allow for some failures
  
  while (rewards.length < count && attempts < maxAttempts) {
    // Generate a random point within the bounds
    const lat = bounds.south + Math.random() * latDiff
    const lng = bounds.west + Math.random() * lngDiff
    
    // Check if point is on land
    const onLand = await isLand(c, lat, lng)
    if (!onLand) {
      attempts++
      continue
    }
    
    const value = getRewardValueFromSeed(seed, lat, lng)
    const id = `${seed}-${lat.toFixed(6)}-${lng.toFixed(6)}`
    
    rewards.push({
      latitude: lat,
      longitude: lng,
      value,
      emoji: rewardValueToEmoji[value],
      id
    })
    
    attempts++
  }
  
  return c.json({ rewards })
})

// Route to validate if a reward can be collected
const validateRewardRoute = createRoute({
  method: 'post',
  path: '/validate-reward',
  request: {
    body: {
      content: {
        'application/json': {
          schema: validateRewardSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            valid: z.boolean(),
            message: z.string()
          })
        }
      },
      description: 'Validation result for reward collection'
    }
  }
})

reward_route.openapi(validateRewardRoute, async (c) => {
  const { latitude, longitude, rewardId, hotspots } = await c.req.json()
  
  // Check if any hotspot is close enough (within 100 meters)
  const maxDistanceKm = 0.1 // 100 meters
  
  for (const hotspot of hotspots) {
    const distance = calculateDistance(
      latitude, 
      longitude, 
      hotspot.latitude, 
      hotspot.longitude
    )
    
    if (distance <= maxDistanceKm) {
      return c.json({ 
        valid: true, 
        message: "Reward collected successfully!" 
      })
    }
  }
  
  return c.json({ 
    valid: false, 
    message: "You need to be closer to a hotspot to collect this reward." 
  })
})

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c // Distance in km
  return distance
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180)
}

export { reward_route } 