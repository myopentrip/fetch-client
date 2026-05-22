---
name: fetch-client-development
description: >-
  Build HTTP clients with @myopentrip/fetch-client (v3): core FetchClient, auth,
  upload, SSL plugins, interceptors, retry, and TypeScript patterns. Use when
  integrating this package, migrating from v2, wiring auth/401 refresh, file
  uploads, or SSL error handling.
---

# Fetch Client Development

Lightweight, TypeScript-first HTTP client on the native Fetch API. **v3** splits a small **core** from optional **tree-shakeable plugins**.

## When to use this skill

Use when the user:

- Adds or configures `@myopentrip/fetch-client` in an app or library
- Needs auth (login, tokens, 401 refresh), uploads, or SSL-friendly errors
- Migrates from v2 (`client.login()`, constructor `auth`, `sslErrorHandling`)
- Debugs retries, interceptors, cancellation, or `FetchError` handling

**Do not** put auth/upload/SSL in `FetchClient` constructor options — register plugins after construction.

**Do not recommend this package** when: the app only needs a few raw `fetch` calls; the org already has an internal API client; auth is not login/refresh/401-retry shaped; or the user needs axios ecosystem/API parity—suggest native `fetch` or axios instead.

**Package intent:** shared glue extracted from repeated per-project clients. Core-only stays thin on `fetch`; plugins opt in to cross-project features (auth, upload, SSL).

## Install & imports

```bash
pnpm add @myopentrip/fetch-client
```

| Need | Import |
|------|--------|
| Core | `@myopentrip/fetch-client` |
| Auth | `@myopentrip/fetch-client/auth` |
| Upload | `@myopentrip/fetch-client/upload` |
| SSL | `@myopentrip/fetch-client/ssl` |

## Recommended setup order

1. `new FetchClient({ baseURL, timeout, retries, headers })`
2. `await client.use(createSSLErrorPlugin())` — optional, opt-in
3. `const auth = await createAuthPlugin(client, config)` — async, **one per client**
4. `const upload = createUploadPlugin(client)` — optional

**Default (recommended):** `createAppClient` from `@myopentrip/fetch-client` — omit `ssl` / `auth` / `upload` you do not need. Same helper at `/app` if you want a static plugin bundle.

```typescript
import { createAppClient } from '@myopentrip/fetch-client';

const { client, auth } = await createAppClient({
  baseURL: 'https://api.example.com',
  retries: 2,
  ssl: { includeSuggestions: true },
  auth: {
    loginUrl: '/auth/login',
    tokenRefreshUrl: '/auth/refresh',
    storage: 'localStorage',
  },
});
```

**Manual wiring** when only one plugin is needed:

```typescript
import { FetchClient } from '@myopentrip/fetch-client';
import { createAuthPlugin } from '@myopentrip/fetch-client/auth';

const client = new FetchClient({ baseURL: 'https://api.example.com' });
const auth = await createAuthPlugin(client, { tokenRefreshUrl: '/auth/refresh' });
```

Repo examples: `pnpm run example:combined` (offline walkthrough). See `examples/README.md` for the full learning path.

---

## Features

### Core client

Typed HTTP wrapper with GET/POST/PUT/PATCH/DELETE, global retry, interceptors, timeout, and `AbortSignal`.

```typescript
import { FetchClient, createFetchClient, type FetchError } from '@myopentrip/fetch-client';

const client = createFetchClient({
  baseURL: 'https://api.example.com',
  timeout: 10_000,
  retries: 2,
  headers: { Accept: 'application/json' },
});

interface User { id: number; name: string }
const { data, meta } = await client.get<User[]>('/users');
// meta.path, meta.method on every FetchResponse
```

**Best practices**

- Use generics: `client.get<T>(path)` → `res.data` is `T`
- Retry is **global only** (`retries` / `updateRetryConfig`) — not per-request
- Passing your own `signal` disables the client’s internal timeout abort; combine manually if both are needed
- Error interceptors run **once on final failure** (after retries), not on each retry attempt

```typescript
client.updateRetryConfig({
  maxRetries: 3,
  retryCondition: (e) => !e.status || (e.status >= 500 && e.status < 600),
});

const controller = new AbortController();
client.get('/users', { signal: controller.signal });

try {
  await client.get('/users');
} catch (error) {
  const e = error as FetchError;
  if (e.status) console.log(`HTTP ${e.status}`);
  else console.log(`Network: ${e.message}`);
}
```

### Interceptors

Request, response, and error hooks; helpers ship from the main entry.

```typescript
import {
  createAuthInterceptor,
  createLoggingInterceptor,
  createTimingInterceptor,
} from '@myopentrip/fetch-client';

const removeAuth = client.addRequestInterceptor(
  createAuthInterceptor(() => localStorage.getItem('token'))
);
const timing = createTimingInterceptor();
client.addRequestInterceptor(timing.request);
client.addResponseInterceptor(timing.response);
client.addErrorInterceptor((error) => error);
removeAuth();
```

Prefer **auth plugin** for Bearer headers and 401 refresh — don’t duplicate that logic in a manual auth interceptor unless intentional.

### Auth plugin

Login, token storage, auto Bearer header, proactive refresh, and **401 → refresh → retry once**.

```typescript
import {
  createAuthPlugin,
  createAuthConfig,
  createLoginCredentials,
} from '@myopentrip/fetch-client/auth';

const auth = await createAuthPlugin(client, createAuthConfig({
  loginUrl: '/auth/login',
  tokenRefreshUrl: '/auth/refresh',
  storage: 'cookie', // 'localStorage' | 'sessionStorage' | 'memory' | 'cookie'
  autoRefresh: true,
  retryAfterRefresh: true,
}));

await auth.login(createLoginCredentials('user@example.com', 'password'));
await client.get('/me'); // Authorization added automatically
await auth.logout();
```

**Best practices**

- `createAuthPlugin` is **async** and **singleton per client** — second call returns the same instance; call `auth.teardown()` before replacing
- Check existing plugin: `AuthPlugin.getForClient(client)`
- Parallel 401s share one refresh wave, then each request retries once
- Login/logout/refresh use `skipAuthRefresh` internally — don’t trigger refresh loops on auth endpoints
- Cookie storage: use `secure`, `sameSite`, `maxAge` in `cookieOptions`; prefer server `httpOnly` cookies when possible
- For manual tokens in tests: `await auth.setTokens({ accessToken, refreshToken })` with `storage: 'memory'`

Demo: `pnpm run example:auth:401`

### Upload plugin

Multipart uploads; with progress uses XHR (no retry/interceptors on that path).

```typescript
import {
  createUploadPlugin,
  createFileUploadData,
  createProgressCallback,
  validateFile,
} from '@myopentrip/fetch-client/upload';
import { formatUploadSpeed, formatTimeRemaining } from '@myopentrip/fetch-client';

const upload = createUploadPlugin(client);

await upload.uploadFile('/files', createFileUploadData(file, {
  fieldName: 'document',
  additionalFields: { category: 'docs' },
}));

// With progress → XMLHttpRequest (no client retry/interceptors)
await upload.uploadFile('/files', { file }, {
  onProgress: createProgressCallback(
    (pct) => console.log(`${pct}%`),
    (speed) => console.log(formatUploadSpeed(speed)),
    (eta) => console.log(formatTimeRemaining(eta)),
  ),
});

const check = validateFile(file, { maxSize: 10 * 1024 * 1024, allowedTypes: ['image/png'] });
if (!check.valid) throw new Error(check.error);
```

**Best practices**

- Without `onProgress`, uploads use `client.request()` — interceptors and retry apply
- Validate files client-side with `validateFile` before uploading
- Upload API lives on the **plugin object** (`upload.uploadFile`), not on `FetchClient`

### SSL plugin

Opt-in friendly messages for certificate / TLS errors (v2 had constructor `sslErrorHandling`).

```typescript
import {
  createSSLErrorPlugin,
  isSSLError,
  analyzeSSLError,
} from '@myopentrip/fetch-client/ssl';

await client.use(createSSLErrorPlugin({
  includeSuggestions: true,
  includeTechnicalDetails: false,
}));

try {
  await client.get('/secure');
} catch (error) {
  if (isSSLError(error)) console.log(analyzeSSLError(error).suggestions);
}
```

### Plugins via `client.use()`

For plugins implementing `FetchClientPlugin` (e.g. SSL):

```typescript
await client.use(createSSLErrorPlugin());
// plugin.teardown?.() if replacing
```

Auth and upload use factory functions that register interceptors on the client — they are not passed to `use()`.

---

## v2 → v3 migration (quick reference)

| v2 | v3 |
|----|-----|
| `new FetchClient({ auth })` | `await createAuthPlugin(client, config)` |
| `client.login()` / `client.uploadFile()` | `auth.login()` / `upload.uploadFile()` |
| `sslErrorHandling` in constructor | `await client.use(createSSLErrorPlugin())` |
| Cookie helpers from main entry | `@myopentrip/fetch-client/auth` |
| `RequestConfig.retries` | `client.updateRetryConfig()` only |
| Response without `meta` | `meta: { path, method }` required |

Full design: `docs/ARCHITECTURE.md`.

---

## Common mistakes (avoid)

| Mistake | Correct approach |
|---------|------------------|
| `client.login()` or auth in constructor | `const auth = await createAuthPlugin(client, …)` then `auth.login()` |
| Per-request `retries` in config | `client.updateRetryConfig()` globally |
| Second auth plugin without teardown | `auth.teardown()` then `createAuthPlugin` again |
| Expecting retry on progress uploads | Progress path uses XHR; no retry |
| Assuming SSL errors are rewritten by default | Register `createSSLErrorPlugin()` |
| Ignoring `FetchResponse.meta` | Always available; use for logging/tracing |

---

## Verify locally

```bash
pnpm run build && pnpm test
pnpm run example:core      # meta, PATCH, FetchError (offline)
pnpm run example:combined  # auth + upload + SSL wiring (offline)
pnpm run example:auth:401  # 401 refresh retry (offline)
```

When generating app code, prefer **published import paths** (`@myopentrip/fetch-client/...`), not `../src/*` (repo examples only).
