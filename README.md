# Fetch Client

A lightweight, TypeScript-first HTTP client on the native Fetch API — with optional plugins for auth, uploads, and SSL errors.

> **v3** splits a small **core** from optional **plugins**. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design and migration from v2.

## Features

### Core (`@myopentrip/fetch-client`)

- TypeScript-first with generics
- GET, POST, PUT, PATCH, DELETE
- Request timeout and `AbortSignal` cancellation
- Retry with exponential backoff and jitter
- Request, response, and error interceptors
- Configurable base URL and default headers
- ESM + CommonJS builds

### Plugins (optional, tree-shakeable)

| Plugin | Import | Provides |
|--------|--------|----------|
| Auth | `@myopentrip/fetch-client/auth` | Login, tokens, storage, 401 refresh |
| Upload | `@myopentrip/fetch-client/upload` | Multipart upload, progress (XHR) |
| SSL | `@myopentrip/fetch-client/ssl` | User-friendly certificate error messages |

## Installation

```bash
pnpm add @myopentrip/fetch-client
```

Auth, upload, and SSL ship in the same package — import only what you need.

## Quick start

### Core only

```typescript
import { FetchClient } from '@myopentrip/fetch-client';

const client = new FetchClient({
  baseURL: 'https://api.example.com',
  timeout: 10_000,
  retries: 2,
  headers: { Accept: 'application/json' },
});

const { data } = await client.get<User[]>('/users');
await client.post('/users', { name: 'Ada' });
```

### With plugins

```typescript
import { FetchClient } from '@myopentrip/fetch-client';
import { createAuthPlugin } from '@myopentrip/fetch-client/auth';
import { createUploadPlugin } from '@myopentrip/fetch-client/upload';
import { createSSLErrorPlugin } from '@myopentrip/fetch-client/ssl';

const client = new FetchClient({ baseURL: 'https://api.example.com', retries: 2 });

await client.use(createSSLErrorPlugin());

const auth = await createAuthPlugin(client, {
  loginUrl: '/auth/login',
  tokenRefreshUrl: '/auth/refresh',
  storage: 'localStorage',
  autoRefresh: true,
});

await auth.login({ email: 'user@example.com', password: 'secret' });
const profile = await client.get('/user/profile');

const upload = createUploadPlugin(client);
await upload.uploadFile('/files', { file: document.querySelector('input').files[0] });
```

## Core usage

### Configuration

```typescript
const client = new FetchClient({
  baseURL: 'https://api.example.com',
  timeout: 10_000,           // default: 10000
  headers: { 'X-App': 'web' },
  retries: 3,                // default: 0
  retryDelay: 1000,          // default: 1000
  enableInterceptors: true,  // default: true
  debug: false,
});
```

### HTTP methods

```typescript
await client.get('/users');
await client.post('/users', { name: 'John' });
await client.put('/users/1', { name: 'Jane' });
await client.patch('/users/1', { active: true });
await client.delete('/users/1');
await client.request('GET', '/users', { timeout: 5000 });
```

### Retry

```typescript
client.updateRetryConfig({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  backoffFactor: 2,
  jitter: true,
  retryCondition: (error) =>
    !error.status || (error.status >= 500 && error.status < 600),
});
```

Retry is configured globally via `retries` / `updateRetryConfig()` — not per-request.

### Request cancellation

```typescript
const controller = new AbortController();
const promise = client.get('/users', { signal: controller.signal });
setTimeout(() => controller.abort(), 5000);
```

If you pass your own `signal`, the client will not apply its internal timeout abort — combine both manually if needed.

### Interceptors

```typescript
import {
  createAuthInterceptor,
  createLoggingInterceptor,
  createTimingInterceptor,
} from '@myopentrip/fetch-client';

const removeAuth = client.addRequestInterceptor(
  createAuthInterceptor(() => localStorage.getItem('token'))
);

client.addRequestInterceptor(createLoggingInterceptor(true));

const timing = createTimingInterceptor();
client.addRequestInterceptor(timing.request);
client.addResponseInterceptor(timing.response);

client.addErrorInterceptor((error) => {
  console.error(error.message);
  return error;
});

removeAuth();
```

Error interceptors run **once on final failure** (after retries are exhausted), not on every retry attempt.

### Error handling

```typescript
import type { FetchError } from '@myopentrip/fetch-client';

try {
  await client.get('/users');
} catch (error) {
  const e = error as FetchError;
  if (e.status) {
    console.log(`HTTP ${e.status}: ${e.statusText}`);
  } else {
    console.log(`Network: ${e.message}`);
  }
}
```

### TypeScript

```typescript
interface User { id: number; name: string }

const res = await client.get<User[]>('/users');
const users: User[] = res.data;
// res.meta.path, res.meta.method available on every response
```

### Next.js

```typescript
// lib/api-client.ts
import { createFetchClient } from '@myopentrip/fetch-client';

export const apiClient = createFetchClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});
```

---

## Auth plugin

```typescript
import { FetchClient } from '@myopentrip/fetch-client';
import {
  createAuthPlugin,
  createAuthConfig,
  createLoginCredentials,
  getUserFromToken,
} from '@myopentrip/fetch-client/auth';

const client = new FetchClient({ baseURL: 'https://api.example.com' });

const auth = await createAuthPlugin(client, createAuthConfig({
  loginUrl: '/auth/login',
  logoutUrl: '/auth/logout',
  tokenRefreshUrl: '/auth/refresh',
  storage: 'cookie',
  autoRefresh: true,
  refreshThreshold: 300,
  cookieOptions: { secure: true, sameSite: 'strict', maxAge: 8 * 60 * 60 },
  onLoginSuccess: (tokens) => console.log(getUserFromToken(tokens.accessToken)),
  onTokenExpired: () => { /* redirect to login */ },
}));

await auth.login(createLoginCredentials('user@example.com', 'password'));
await client.get('/me'); // Authorization header added automatically

if (auth.isAuthenticated()) {
  await auth.refreshTokens();
}
await auth.logout();
```

### Auth API (`AuthPlugin`)

| Method | Description |
|--------|-------------|
| `login(credentials)` | POST login, store tokens |
| `logout()` | Clear tokens, optional logout URL |
| `setTokens` / `getTokens` / `clearTokens` | Token lifecycle |
| `isAuthenticated()` / `isTokenExpired()` | State checks |
| `refreshTokens()` | Manual refresh |
| `getAuthState()` / `setUser()` / `getUser()` | User + state |

On **401**, if a refresh token exists, the plugin refreshes and **retries the original request once** (`retryAfterRefresh: true` by default). Parallel 401s share **one refresh wave**, then each failed request retries. `createAuthPlugin` is **singleton per client** — calling it twice returns the same instance (call `teardown()` to replace).

### Cookie utilities

Imported from `@myopentrip/fetch-client/auth`:

```typescript
import {
  getCookie,
  setCookie,
  removeCookie,
  parseCookies,
  createCookieStorage,
  CookieSession,
} from '@myopentrip/fetch-client/auth';
```

### Storage comparison

| Storage | Security | Persistence | SSR | Sent automatically |
|---------|----------|-------------|-----|-------------------|
| cookie | Best with `httpOnly` (server-set) | Configurable | Yes | Yes |
| localStorage | XSS risk | Permanent | No | No |
| sessionStorage | XSS risk | Tab session | No | No |
| memory | In-memory only | Page session | Yes | No |

---

## Upload plugin

```typescript
import { FetchClient } from '@myopentrip/fetch-client';
import {
  createUploadPlugin,
  createFileUploadData,
  createProgressCallback,
  validateFile,
} from '@myopentrip/fetch-client/upload';
import { formatUploadSpeed, formatTimeRemaining } from '@myopentrip/fetch-client';

const client = new FetchClient({ baseURL: 'https://api.example.com' });
const upload = createUploadPlugin(client);

const file = input.files[0];

await upload.uploadFile('/upload', createFileUploadData(file, {
  fieldName: 'document',
  additionalFields: { category: 'docs' },
}));

await upload.uploadFiles('/upload-many', Array.from(input.files));

await upload.uploadFormData('/profile', {
  avatar: avatarFile,
  name: 'John',
  age: 30,
});

// With progress (uses XMLHttpRequest — no retry/interceptors on this path)
await upload.uploadFile('/upload', { file }, {
  onProgress: createProgressCallback(
    (pct) => console.log(`${pct}%`),
    (speed) => console.log(formatUploadSpeed(speed)),
    (eta) => console.log(formatTimeRemaining(eta)),
  ),
});

const check = validateFile(file, {
  maxSize: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png'],
});
```

Without `onProgress`, uploads go through `client.request()` (interceptors + retry apply).

---

## SSL plugin

SSL handling is **opt-in** in v3:

```typescript
import { FetchClient } from '@myopentrip/fetch-client';
import {
  createSSLErrorPlugin,
  isSSLError,
  analyzeSSLError,
} from '@myopentrip/fetch-client/ssl';

const client = new FetchClient({ baseURL: 'https://api.example.com' });

await client.use(createSSLErrorPlugin({
  includeSuggestions: true,
  includeTechnicalDetails: false,
}));

try {
  await client.get('/secure');
} catch (error) {
  if (isSSLError(error)) {
    console.log(analyzeSSLError(error).suggestions);
  }
}
```

Or register the interceptor directly:

```typescript
import { createSSLErrorInterceptor } from '@myopentrip/fetch-client/ssl';

client.addErrorInterceptor(createSSLErrorInterceptor({}, true));
```

---

## Migration from v2

| v2 | v3 |
|----|-----|
| `new FetchClient({ auth })` | `await createAuthPlugin(client, config)` |
| `client.login()` / `client.uploadFile()` | `auth.login()` / `upload.uploadFile()` |
| `sslErrorHandling` in constructor | `await client.use(createSSLErrorPlugin())` |
| Cookie helpers from main entry | `@myopentrip/fetch-client/auth` |
| `RequestConfig.retries` | `client.updateRetryConfig()` only |
| `FetchResponse` without `meta` | `meta: { path, method }` required |

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## API reference (core)

### `FetchClient`

```typescript
new FetchClient(config?: FetchClientConfig)

interface FetchClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  enableInterceptors?: boolean;
  debug?: boolean;
}

interface FetchResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  meta: { path: string; method: HttpMethod; skipAuthRefresh?: boolean };
}
```

### Methods

- `get`, `post`, `put`, `patch`, `delete`, `request`
- `use(plugin)` — register a `FetchClientPlugin` (e.g. SSL)
- `addRequestInterceptor`, `addResponseInterceptor`, `addErrorInterceptor`
- `removeRequestInterceptor`
- `updateRetryConfig`
- `getDefaultHeaders()`, `buildHeaders()`, `resolveURL()`
- `rawPost()` — internal POST without interceptors/retry (used by auth refresh)

Plugin APIs are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scripts

```bash
pnpm run build
pnpm run test:interceptors
pnpm run test:ssl
pnpm run example:interceptors
```


## License

MIT
