import type { Bindings } from 'hono/types'
import { object, string } from 'zod'

export const get_config = (environment: Bindings | undefined) =>
  object({
    AUTH_TOKEN: string(),
    NILAI_API_URL: string(),
    NILAI_API_KEY: string(),
    OPEN_METEO_API_URL: string(),
  }).parse(environment)
