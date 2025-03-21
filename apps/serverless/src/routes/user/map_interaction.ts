import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { HonoContext } from '../../types/hono_context'

// Define the environment interface
interface Env {
  NILAI_API_URL: string;
  NILAI_API_KEY: string;
}

// Define LLM response interface
interface LLMResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// Define OpenAPI schemas
const HotspotSchema = z.object({
  name: z.string(),
  longitude: z.number(),
  latitude: z.number(),
  type: z.string()
});

const MarkerSchema = z.object({
  id: z.string(),
  longitude: z.number(),
  latitude: z.number(),
  type: z.string(),
  name: z.string().optional()
});

const UserLocationSchema = z.object({
  longitude: z.number(),
  latitude: z.number()
});

const MapDataSchema = z.object({
  markers: z.array(MarkerSchema).optional()
});

// Travel recommendation schemas
const TravelRecommendationRequestSchema = z.object({
  longitude: z.number(),
  latitude: z.number(),
  weather: z.string(),
  interests: z.array(z.string()),
  hotspots: z.array(HotspotSchema).optional()
});

const RecommendationSchema = z.object({
  place: z.string(),
  description: z.string(),
  itinerary: z.string()
});

const TravelRecommendationResponseSchema = z.object({
  recommendation: RecommendationSchema
});

// Exploration recommendation schemas
const ExplorationRecommendationRequestSchema = z.object({
  longitude: z.number(),
  latitude: z.number(),
  radius: z.number().optional(),
  categories: z.array(z.string()).optional()
});

const ExplorationRecommendationResponseSchema = z.object({
  points: z.array(z.object({
    name: z.string(),
    type: z.string(),
    distance: z.number(),
    description: z.string(),
    coordinates: z.tuple([z.number(), z.number()])
  }))
});

// Mapbox interaction schemas
const MapboxInteractionRequestSchema = z.object({
  query: z.string(),
  userLocation: UserLocationSchema,
  mapData: MapDataSchema
});

const MapCommandSchema = z.object({
  moveCamera: z.boolean().optional(),
  targetLocation: z.object({
    longitude: z.number(),
    latitude: z.number()
  }).optional(),
  zoomLevel: z.number().optional(),
  addMarkers: z.array(MarkerSchema).optional(),
  removeMarkers: z.array(z.string()).optional(),
  toggleLayers: z.array(z.string()).optional(),
  rawResponse: z.string()
});

const MapboxInteractionResponseSchema = z.object({
  response: z.string(),
  commands: MapCommandSchema
});

// Error schema
const ErrorResponseSchema = z.object({
  error: z.string()
});

// Route definitions
const travelRecommendationRoute = createRoute({
  method: 'post',
  path: '/travel-recommendation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: TravelRecommendationRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TravelRecommendationResponseSchema
        }
      },
      description: 'Successfully generated travel recommendation'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Server error'
    }
  }
});

const explorationRecommendationRoute = createRoute({
  method: 'post',
  path: '/exploration-recommendation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ExplorationRecommendationRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ExplorationRecommendationResponseSchema
        }
      },
      description: 'Successfully generated exploration recommendations'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Server error'
    }
  }
});

const mapboxInteractionRoute = createRoute({
  method: 'post',
  path: '/mapbox-interaction',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MapboxInteractionRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MapboxInteractionResponseSchema
        }
      },
      description: 'Successfully processed mapbox interaction'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Server error'
    }
  }
});

export const map_route = new OpenAPIHono<HonoContext>();

// Travel recommendation endpoint
map_route.openapi(travelRecommendationRoute, async (c) => {
  try {
    const { longitude, latitude, weather, interests, hotspots } = await c.req.json();

    // Create prompt for travel recommendation
    const systemPrompt = `你是一個專業的 AI 旅行規劃師，能根據天氣、用戶興趣和地圖數據推薦最佳目的地。  
請根據：
- 用戶當前位置（${longitude}, ${latitude}）
- 今日天氣狀況（${weather}）
- 用戶興趣：${interests.join(', ')}
${hotspots && hotspots.length > 0 ? `- 附近的熱點：${hotspots.map(h => h.name).join(', ')}` : ''}
  
提供最佳旅遊建議，包括：
1. 推薦地點名稱
2. 描述（簡短介紹這個地點，為什麼適合當前情況）
3. 行程建議（具體時間安排）
  
請以 JSON 格式輸出，包含 place（地點名稱）、description（描述）和 itinerary（行程）三個欄位。`;

    // Call Nillion LLM
    const llmResponse = await callNillionLLM(c.env.NILAI_API_URL, c.env.NILAI_API_KEY, systemPrompt, 'explain your travel recommendation');
    
    if (!llmResponse || !llmResponse.choices || !llmResponse.choices[0]?.message?.content) {
      return c.json({ error: 'Failed to generate travel recommendation' }, 500);
    }

    try {
      // Extract JSON from response
      const contentText = llmResponse.choices[0].message.content;
      const jsonMatch = contentText.match(/```json\n([\s\S]*?)\n```/) || contentText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const recommendationJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return c.json({ recommendation: recommendationJson });
      } else {
        // Fallback to manually parsing if no JSON format is found
        const lines = contentText.split('\n');
        let place = '';
        let description = '';
        let itinerary = '';
        
        for (const line of lines) {
          if (line.startsWith('地點') || line.startsWith('推薦地點') || line.toLowerCase().includes('place')) {
            place = line.split('：')[1] || line.split(':')[1] || '';
          } else if (line.startsWith('描述') || line.toLowerCase().includes('description')) {
            description = line.split('：')[1] || line.split(':')[1] || '';
          } else if (line.startsWith('行程') || line.toLowerCase().includes('itinerary')) {
            itinerary = line.split('：')[1] || line.split(':')[1] || '';
          }
        }
        
        return c.json({
          recommendation: {
            place: place.trim(),
            description: description.trim(),
            itinerary: itinerary.trim()
          }
        });
      }
    } catch (error) {
      console.error('Error parsing recommendation:', error);
      
      // Return a simplified version of the raw response
      const content = llmResponse.choices[0].message.content;
      return c.json({
        recommendation: {
          place: 'Custom Recommendation',
          description: content.slice(0, 100) + '...',
          itinerary: 'Please see description for details.'
        }
      });
    }
  } catch (error) {
    console.error('Error generating travel recommendation:', error);
    return c.json({ error: 'Failed to generate travel recommendation' }, 500);
  }
});

// Exploration recommendation endpoint
map_route.openapi(explorationRecommendationRoute, async (c) => {
  try {
    const { longitude, latitude, radius = 1, categories = ['food', 'attractions', 'shopping'] } = await c.req.json();
    
    // Create prompt for exploration recommendation
    const systemPrompt = `你是一個當地旅遊專家 AI，熟悉各地的景點、餐廳和活動。

請根據以下信息推薦附近的有趣地點：
- 用戶當前位置（${longitude}, ${latitude}）
- 搜索半徑：${radius} 公里
- 類別：${categories.join(', ')}

請推薦 3-5 個地點，對每個地點提供：
1. 名稱
2. 類型（如餐廳、景點、博物館等）
3. 大約距離（公里）
4. 簡短描述
5. 位置座標 [經度, 緯度]

請以 JSON 格式輸出一個 points 的數組，每個點包含 name、type、distance、description 和 coordinates 欄位。`;

    // Call Nillion LLM
    const llmResponse = await callNillionLLM(c.env.NILAI_API_URL, c.env.NILAI_API_KEY, systemPrompt, 'recommend points of interest');
    
    if (!llmResponse || !llmResponse.choices || !llmResponse.choices[0]?.message?.content) {
      return c.json({ error: 'Failed to generate exploration recommendations' }, 500);
    }

    try {
      // Extract JSON from response
      const contentText = llmResponse.choices[0].message.content;
      const jsonMatch = contentText.match(/```json\n([\s\S]*?)\n```/) || contentText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const pointsJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return c.json(pointsJson);
      } else {
        // Generate a simplified response if JSON parsing fails
        return c.json({
          points: [
            {
              name: 'Local Recommendation',
              type: 'suggestion',
              distance: 0.5,
              description: 'Generated recommendation based on your location',
              coordinates: [longitude + 0.01, latitude + 0.01]
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error parsing exploration recommendations:', error);
      
      // Return a fallback response
      return c.json({
        points: [
          {
            name: 'Local Cafe',
            type: 'cafe',
            distance: 0.3,
            description: 'A cozy local cafe to relax and enjoy local cuisine',
            coordinates: [longitude + 0.002, latitude + 0.001]
          },
          {
            name: 'City Park',
            type: 'park',
            distance: 0.8,
            description: 'Beautiful city park with walking paths and local flora',
            coordinates: [longitude - 0.003, latitude + 0.004]
          }
        ]
      });
    }
  } catch (error) {
    console.error('Error generating exploration recommendations:', error);
    return c.json({ error: 'Failed to generate exploration recommendations' }, 500);
  }
});

// Mapbox interaction endpoint
map_route.openapi(mapboxInteractionRoute, async (c) => {
  try {
    const { query, userLocation, mapData } = await c.req.json();
    
    // Create prompt for mapbox interaction
    const systemPrompt = `你是一個專業的地圖助手 AI，可以理解用戶關於地圖的自然語言查詢並提供相應指令。

當前狀態：
- 用戶位置：經度 ${userLocation.longitude}，緯度 ${userLocation.latitude}
- 地圖上已有標記：${mapData.markers ? mapData.markers.map(m => m.name || m.id).join(', ') : '無'}

請根據用戶的查詢「${query}」提供下列資訊：
1. 文字回應（應該顯示給用戶的訊息）
2. 地圖操作指令，可包含以下任何操作：
   - moveCamera: 是否需要移動地圖視角 (true/false)
   - targetLocation: 新的地圖中心座標 {longitude, latitude}
   - zoomLevel: 地圖縮放級別 (1-20，數字越大越詳細)
   - addMarkers: 要新增的標記 [{id, longitude, latitude, type, name}]
   - removeMarkers: 要移除的標記 ID 列表
   - toggleLayers: 要顯示/隱藏的圖層名稱

請返回正確格式的 JSON 對象，包含 response（文字回應）和 commands（地圖指令）。`;

    // Call Nillion LLM
    const llmResponse = await callNillionLLM(c.env.NILAI_API_URL, c.env.NILAI_API_KEY, systemPrompt, query);
    
    if (!llmResponse || !llmResponse.choices || !llmResponse.choices[0]?.message?.content) {
      return c.json({ error: 'Failed to process map interaction' }, 500);
    }

    try {
      // Extract JSON from response
      const contentText = llmResponse.choices[0].message.content;
      const jsonMatch = contentText.match(/```json\n([\s\S]*?)\n```/) || contentText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const interactionJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        
        // Make sure the commands object exists
        interactionJson.commands = interactionJson.commands || {};
        
        // Ensure the raw response is available
        interactionJson.commands.rawResponse = interactionJson.response;
        
        return c.json(interactionJson);
      } else {
        // Fallback if JSON parsing fails
        const textResponse = contentText.replace(/```json|```/g, '').trim();
        
        return c.json({
          response: textResponse,
          commands: {
            moveCamera: false,
            addMarkers: [],
            removeMarkers: [],
            toggleLayers: [],
            rawResponse: textResponse
          }
        });
      }
    } catch (error) {
      console.error('Error parsing mapbox interaction:', error);
      
      // Return the raw text response as fallback
      const textResponse = llmResponse.choices[0].message.content;
      
      return c.json({
        response: textResponse,
        commands: {
          moveCamera: false,
          addMarkers: [],
          removeMarkers: [],
          toggleLayers: [],
          rawResponse: textResponse
        }
      });
    }
  } catch (error) {
    console.error('Error processing mapbox interaction:', error);
    return c.json({ error: 'Failed to process map interaction' }, 500);
  }
});

// Helper function to call Nillion LLM API
async function callNillionLLM(apiUrl: string, apiKey: string, systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'nilai-chat',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error('LLM API error:', response.status, await response.text());
      throw new Error(`LLM API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling LLM API:', error);
    throw error;
  }
} 