import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { admin, user } from './routes'

function main() {
  const openapi_documentation_route = '/openapi.json'

  const app = new OpenAPIHono().doc(openapi_documentation_route, {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'OrbitalMap API',
      description: 'API for the OrbitalMap serverless platform',
      contact: {
        name: 'API Support',
        url: 'https://github.com/25trifecta/orbitalmap',
      },
    },
    servers: [
      {
        url: 'https://serverless.orbitalmap.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:8787',
        description: 'Local development server',
      },
    ],
  })

  app.get('/docs', swaggerUI({ url: openapi_documentation_route }))
  // cors
  app.use('*', cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }))

  app.use(prettyJSON())
  app
    .route('/', admin)
    .route('/', user)

  return app
}

// Add a helper script in package.json to export OpenAPI docs:
// "export-openapi": "node -e \"const fs=require('fs'); const app=require('./.wrangler/tmp/bundle').default; const docs=app.getOpenAPIDocument(); fs.writeFileSync('openapi.json', JSON.stringify(docs, null, 2));\""

export default main()