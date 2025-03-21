import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { HonoContext } from '../../types/hono_context'

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

// Define OpenAPI schemas
const MessageSchema = z.object({
  role: z.string(),
  content: z.string()
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  temperature: z.number().optional(),
  max_tokens: z.number().optional()
});

const ChatResponseSchema = z.object({
  id: z.string().optional(),
  object: z.string().optional(),
  created: z.number().optional(),
  model: z.string().optional(),
  choices: z.array(
    z.object({
      index: z.number().optional(),
      message: z.object({
        role: z.string().optional(),
        content: z.string().optional()
      }).optional(),
      finish_reason: z.string().optional()
    })
  ).optional(),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional()
  }).optional()
});

const ErrorResponseSchema = z.object({
  error: z.string()
});

// Create route definition
const chatRoute = createRoute({
  method: 'post',
  path: '/chat',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ChatResponseSchema
        }
      },
      description: 'Successfully processed chat request'
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

export const chat_route = new OpenAPIHono<HonoContext>();

// Chat endpoint with OpenAPI validation
chat_route.openapi(chatRoute, async (c) => {
  try {
    const body = await c.req.json();

    const response = await fetch(
      `${c.env.NILAI_API_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${c.env.NILAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'nilai-chat',
          messages: body.messages,
          temperature: body.temperature || 0.7,
          max_tokens: body.max_tokens
        }),
      }
    );

    if (!response.ok) {
      console.error('LLM API error:', response.status, await response.text());
      return c.json({ error: 'Failed to process chat request' }, 500);
    }

    const data = await response.json() as LLMResponse;
    return c.json(data);
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Failed to process chat request' }, 500);
  }
}); 