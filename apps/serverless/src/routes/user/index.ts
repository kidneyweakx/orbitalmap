
import { OpenAPIHono } from '@hono/zod-openapi'
import { add_point } from './add_point'
import { zk_tls } from './zk_tls'

const user = new OpenAPIHono()

user
  .route('/user', add_point)
  .route('/user', zk_tls)

export { user }
