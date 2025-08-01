export { FetchClient } from './fetch-client';
export type {
  FetchClientConfig,
  RequestConfig,
  FetchResponse,
  FetchError,
  HttpMethod,
} from './types';

// Create a default instance for convenience
import { FetchClient } from './fetch-client';
import type { FetchClientConfig } from './types';

export const createFetchClient = (config?: FetchClientConfig) => {
  return new FetchClient(config);
};