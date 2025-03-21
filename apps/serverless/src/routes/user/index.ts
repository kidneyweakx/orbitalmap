import { OpenAPIHono } from '@hono/zod-openapi'
import { chat_route } from './nillion_llm'
import { map_route } from './map_interaction'
import { reward_route } from './reward_generator'

const user = new OpenAPIHono()

user
  .route('/user', chat_route)
  .route('/user', map_route)
  .route('/user', reward_route)

export { user }
