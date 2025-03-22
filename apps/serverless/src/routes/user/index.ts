import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoContext } from '../../types/hono_context'
import { chat_route } from './nillion_llm'
import { map_route } from './map_interaction'
import { reward_route } from './reward_generator'

export const user = new OpenAPIHono<HonoContext>()

// Register API routes
user
  .route('/user', chat_route)
  .route('/user', map_route)
  .route('/user', reward_route)

export const userRoutes = [
  chat_route,
  map_route,
  reward_route
]
