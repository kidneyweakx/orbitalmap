import { Hono } from 'hono'

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

const map_route = new Hono<{ Bindings: Env }>()

// Travel recommendation endpoint
map_route.post('/travel-recommendation', async (c) => {
  try {
    const body = await c.req.json();
    const { longitude, latitude, weather, interests, hotspots } = body as {
      longitude: number;
      latitude: number;
      weather: string;
      interests: string[];
      hotspots?: Array<{
        name: string;
        longitude: number;
        latitude: number;
        type: string;
      }>;
    };

    // Create prompt for travel recommendation
    const systemPrompt = `你是一個專業的 AI 旅行規劃師，能根據天氣、用戶興趣和地圖數據推薦最佳目的地。  
請根據：
- 用戶當前位置（${longitude}, ${latitude}）
- 今日天氣狀況（${weather}）
- 用戶興趣標籤（${interests.join(', ')}）
- 獎勵機會熱點（${JSON.stringify(hotspots || [])}）

推薦 1 個最佳探索地點，並提供一個簡單的行程建議（包含建議時間和活動）。`;

    const response = await fetch(
      `${c.env.NILAI_API_URL}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.env.NILAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.1-8B-Instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '請給我今天的推薦行程。' }
          ],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json() as LLMResponse;
    
    // Extract recommendation from LLM response
    const recommendationText = data.choices?.[0]?.message?.content || '';
    
    // Parse the text to extract place and description
    const placeParts = recommendationText.split('\n');
    const place = placeParts[0]?.replace(/^[^a-zA-Z0-9\u4e00-\u9fa5]+/, '') || '無推薦地點';
    const description = placeParts.slice(1).join('\n');

    return c.json({
      recommendation: {
        place,
        description,
        itinerary: recommendationText,
      }
    });
  } catch (error) {
    console.error('Travel recommendation error:', error);
    return c.json(
      { error: 'Failed to generate travel recommendation' },
      { status: 500 }
    );
  }
});

// Exploration recommendation endpoint
map_route.post('/exploration-recommendation', async (c) => {
  try {
    const body = await c.req.json();
    const { longitude, latitude, pointsOfInterest } = body as {
      longitude: number;
      latitude: number;
      pointsOfInterest?: Array<{
        name: string;
        longitude: number;
        latitude: number;
        type: string;
        value?: number;
      }>;
    };

    // Create prompt for exploration recommendation
    const systemPrompt = `你是一個智能地圖助手，專門幫助用戶找到附近有價值的探索地點。根據以下資訊：
1. 用戶當前位置（經度: ${longitude}, 緯度: ${latitude}）
2. 地圖上已標記的「私密地點」和「獎勵區域」的數據: ${JSON.stringify(pointsOfInterest || [])}
3. 使用 emoji 表示地點，例如：
   - 🌟 高價值探索點
   - 🔥 熱門區域
   - 🌿 隱藏秘境

請推薦 3 個最值得探索的地點，並提供簡短的描述。`;

    const response = await fetch(
      `${c.env.NILAI_API_URL}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.env.NILAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.1-8B-Instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '請推薦幾個值得探索的地點。' }
          ],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json() as LLMResponse;
    
    // Extract recommendations from LLM response
    const recommendationText = data.choices?.[0]?.message?.content || '';
    
    // Parse the recommendations
    const recommendationLines = recommendationText.split('\n').filter(line => line.trim() !== '');
    const recommendations: Array<{emoji: string, name: string, description: string}> = [];
    
    for (let i = 0; i < recommendationLines.length; i++) {
      const line = recommendationLines[i];
      if (line.match(/^\d+\.\s/) && line.match(/[🌟🔥🌿]/)) {
        const emoji = line.match(/[🌟🔥🌿]/)?.[0] || '🌍';
        const name = line.replace(/^\d+\.\s/, '').split(' - ')[0].trim();
        const description = recommendationLines[i + 1]?.trim() || '';
        
        recommendations.push({ emoji, name, description });
        // Skip the description line
        i++;
      }
    }

    // If parsing failed, return a simplified response
    if (recommendations.length === 0) {
      return c.json({
        recommendations: [
          { 
            emoji: '🌟', 
            name: '推薦地點', 
            description: recommendationText 
          }
        ]
      });
    }

    return c.json({ recommendations });
  } catch (error) {
    console.error('Exploration recommendation error:', error);
    return c.json(
      { error: 'Failed to generate exploration recommendations' },
      { status: 500 }
    );
  }
});

// Endpoint for interfacing with Mapbox
map_route.post('/mapbox-interaction', async (c) => {
  try {
    const body = await c.req.json();
    const { query, mapData, userLocation } = body as {
      query: string;
      mapData?: {
        markers: Array<{
          id: string;
          longitude: number;
          latitude: number;
          type: string;
          properties?: Record<string, any>;
        }>;
        layers?: Array<{
          id: string;
          type: string;
          source: string;
          properties?: Record<string, any>;
        }>;
      };
      userLocation?: {
        longitude: number;
        latitude: number;
      };
    };

    // Create system prompt for Mapbox interaction
    const systemPrompt = `你是一個專業的地圖助手，能夠幫助用戶與地圖互動。你可以：
1. 生成互動式地圖指令
2. 解析用戶的地理位置需求
3. 推薦附近的興趣點
4. 幫助用戶理解地圖上的資訊

用戶的位置：${JSON.stringify(userLocation || {})}
地圖數據：${JSON.stringify(mapData || {})}

請基於用戶的查詢，提供適當的地圖互動建議。回復應包含：
- 明確的指令，例如 "移動到"、"顯示"、"隱藏" 特定圖層或標記
- 如果需要新增標記，請提供經緯度、名稱和類型
- 如果需要設定圖層，請提供圖層ID和顯示設定`;

    const response = await fetch(
      `${c.env.NILAI_API_URL}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.env.NILAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.1-8B-Instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json() as LLMResponse;
    
    // Extract response from LLM
    const responseText = data.choices?.[0]?.message?.content || '';
    
    // Parse the response for map commands
    // This is a simplified implementation - in reality, you would need more robust parsing
    const mapCommands: {
      moveCamera: boolean;
      targetLocation: { longitude: number; latitude: number } | null;
      addMarkers: any[];
      removeMarkers: any[];
      toggleLayers: any[];
      zoomLevel: number | null;
      rawResponse: string;
    } = {
      moveCamera: false,
      targetLocation: null,
      addMarkers: [],
      removeMarkers: [],
      toggleLayers: [],
      zoomLevel: null,
      rawResponse: responseText
    };
    
    // Check for camera movement commands
    if (responseText.match(/移動到|導航到|前往|查看位置|zoom to|move to/i)) {
      mapCommands.moveCamera = true;
      
      // Extract coordinates (simple regex pattern)
      const coordMatch = responseText.match(/(\d+\.\d+),\s*(\d+\.\d+)/);
      if (coordMatch) {
        mapCommands.targetLocation = {
          longitude: parseFloat(coordMatch[1]),
          latitude: parseFloat(coordMatch[2])
        };
      }
    }
    
    // Check for zoom commands
    const zoomMatch = responseText.match(/縮放級別|zoom level|設置縮放|set zoom|zoom to (\d+)/i);
    if (zoomMatch && zoomMatch[1]) {
      mapCommands.zoomLevel = parseInt(zoomMatch[1]);
    }
    
    return c.json({
      response: responseText,
      commands: mapCommands
    });
    
  } catch (error) {
    console.error('Mapbox interaction error:', error);
    return c.json(
      { error: 'Failed to process mapbox interaction' },
      { status: 500 }
    );
  }
});

export { map_route } 