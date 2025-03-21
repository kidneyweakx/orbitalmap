import { Hono } from 'hono'

// Define the environment interface
interface Env {
  NILAI_API_URL: string;
  NILAI_API_KEY: string;
}

// Define the LLM response type
interface LLMResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message: string;
  };
}

const chat_route = new Hono<{ Bindings: Env }>()

// Simple chat endpoint without OpenAPI validation
chat_route.post('/chat', async (c) => {
  try {
    const body = await c.req.json()

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
          messages: body.messages,
          temperature: 0.2,
        }),
      }
    )

    const data = await response.json() as LLMResponse
    return c.json(data)
  } catch (error) {
    console.error('Chat error:', error)
    return c.json(
      { error: 'Failed to process chat request' } as { error: string },
      { status: 500 }
    )
  }
})

export { chat_route } 