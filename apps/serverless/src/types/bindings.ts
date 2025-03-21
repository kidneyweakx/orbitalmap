import type { get_config } from '../config'

export type Bindings = ReturnType<typeof get_config> & {
  cykv: KVNamespace;
  NILAI_API_URL: string;
  NILAI_API_KEY: string;
  OPEN_METEO_API_URL: string;
}
