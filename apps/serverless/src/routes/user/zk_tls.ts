import type { HonoContext } from '../../types'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const QuerySchema = z.object({
  user: z.string(),
})

const ResponseSchema = z.object({
  point: z.string(),
})

const ResponseErrorSchema = z.object({
  error: z.literal('Invalid username!'),
})

const route = createRoute({
  method: 'get',
  path: '/zk_tls',
  request: { query: QuerySchema },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResponseSchema,
          example: {
            message: 'Successfully added adminname to the list of admins!',
          },
        },
      },
      description: 'The response when a user has been successfully added.',
    },
    401: {
      content: {
        'text/plain': { schema: z.literal('Unauthorized') },
      },
      description: 'The response when the request is unauthorized.',
    },
    500: {
      content: {
        'application/json': { schema: ResponseErrorSchema },
      },
      description: 'The response when a user cannot be added.',
    },
  },
})

export const zk_tls = new OpenAPIHono<HonoContext>().openapi(route, async (context) => {
  return context.json({ point: "10000" }, 200)
})
