# Examples — developer guide

Manual tutorials for **v3** (`FetchClient` + optional plugins). They teach **how** to use the library; [`tests/`](../tests/) prove **that** behavior stays correct in CI.

In apps, import from published paths:

```typescript
import { FetchClient } from '@myopentrip/fetch-client';
import { createAuthPlugin } from '@myopentrip/fetch-client/auth';
import { createUploadPlugin } from '@myopentrip/fetch-client/upload';
import { createSSLErrorPlugin } from '@myopentrip/fetch-client/ssl';
```

Examples here use `../src/*` so you can run them inside this repo without building first.

---

## Suggested learning path

| Step | Command | You learn |
|------|---------|-----------|
| 1 | `pnpm run example:errors` | HTTP status labels (`formatHTTPErrorMessage`) |
| 2 | `pnpm run example:core` | `meta`, PATCH, `request()`, `resolveURL`, `FetchError` |
| 3 | `pnpm run example` | Day-to-day GET/POST/PUT/DELETE + generics |
| 4 | `pnpm run example:advanced` | `AbortSignal`, interceptors, `updateRetryConfig` |
| 5 | `pnpm run example:interceptors` | Real-world interceptor patterns (live API) |
| 6 | `pnpm run example:combined` | Auth + upload + SSL on one client |
| 7 | `pnpm run example:auth:lifecycle` | Singleton plugin, `teardown()`, `getForClient` |
| 8 | `pnpm run example:auth:401` | 401 → refresh → retry (mocked) |
| 9 | `pnpm run example:auth` | Login config, manual tokens, JWT helpers |
| 10 | `pnpm run example:cookie` | Cookie storage utilities |
| 11 | `pnpm run example:upload` | Multipart, validation, progress |
| 12 | `pnpm run example:ssl` | SSL plugin + badssl.com |

Offline-friendly steps: **1, 2, 6, 7, 8, 9 (partial), 10**.

---

## Feature coverage map

### Core (`@myopentrip/fetch-client`)

| Topic | Example | Notes |
|-------|---------|-------|
| Constructor / `createFetchClient` | `example.ts` | Factory vs `new` |
| GET, POST, PUT, DELETE | `example.ts` | Live jsonplaceholder |
| PATCH | `core-patterns-example.ts` | |
| `request(method, path)` | `core-patterns-example.ts` | |
| Generics `get<T>` | `example.ts` | |
| `FetchResponse.meta` | `core-patterns-example.ts`, `auth-401-retry-example.ts` | `path`, `method`, `authRetried` |
| Global retry / `updateRetryConfig` | `advanced-example.ts` | Custom `retryCondition` |
| `AbortSignal` cancellation | `advanced-example.ts` | |
| Request / response / error interceptors | `interceptor-examples.ts`, `advanced-example.ts` | Helpers exported from interceptor file |
| `createAuthInterceptor`, logging, timing | `interceptor-examples.ts`, `advanced-example.ts` | |
| Error interceptors (log / transform) | `interceptor-examples.ts` | Recovery via `FetchResponse` is used internally by auth |
| `FetchError` HTTP vs network | `core-patterns-example.ts` | |
| HTTP error messages | `http-errors-example.ts` | |
| `resolveURL` | `core-patterns-example.ts` | |
| Per-request `timeout` | `core-patterns-example.ts` | |
| `client.use(plugin)` | `combined-plugins-example.ts`, `ssl-error-examples.ts` | |

### Auth (`/auth`)

| Topic | Example | Notes |
|-------|---------|-------|
| `createAuthPlugin` + config | `auth-examples.ts`, `combined-plugins-example.ts` | |
| `login` / `logout` / `refreshTokens` | `auth-examples.ts` | Needs real API |
| `setTokens` / memory storage | `auth-examples.ts`, `auth-401-retry-example.ts` | |
| Auto Bearer header | `combined-plugins-example.ts`, `auth-401-retry-example.ts` | |
| 401 → refresh → retry | `auth-401-retry-example.ts` | Mocked; see also `tests/auth-401-retry.test.ts` |
| Singleton + `teardown` + `getForClient` | `auth-lifecycle-example.ts` | |
| Cookie storage + utilities | `cookie-auth-examples.ts` | Best in browser |
| JWT helpers (`getUserFromToken`, …) | `auth-examples.ts` | Offline in `manualTokens` |
| Callbacks (`onLoginSuccess`, …) | `auth-examples.ts` | In `createAuthConfig` |
| `retryAfterRefresh: false` | — | Documented in README; covered in **tests** |

### Upload (`/upload`)

| Topic | Example | Notes |
|-------|---------|-------|
| `createUploadPlugin` | `file-upload-examples.ts`, `combined-plugins-example.ts` | |
| `uploadFile` / `uploadFiles` / `uploadFormData` | `file-upload-examples.ts` | httpbin |
| `validateFile`, `createFileUploadData` | `file-upload-examples.ts` | |
| Progress + formatters | `file-upload-examples.ts` (`uploadWithProgress`) | Run section manually |
| XHR path vs `client.request()` | `combined-plugins-example.ts` (comments) | |

### SSL (`/ssl`)

| Topic | Example | Notes |
|-------|---------|-------|
| `createSSLErrorPlugin` + `client.use` | `ssl-error-examples.ts`, `combined-plugins-example.ts` | |
| Custom plugin config | `ssl-error-examples.ts` | |
| Manual `createSSLErrorInterceptor` | `ssl-error-examples.ts` | |
| `isSSLError` / `analyzeSSLError` | `ssl-error-examples.ts` | |

---

## Examples vs tests

| | **Examples** | **Tests** |
|--|--------------|-----------|
| Goal | Teach usage & design choices | Lock behavior in CI |
| Output | `console.log`, readable flow | `expect()` assertions |
| Network | Often live APIs or mocks with story | Almost always mocked `fetch` |
| Duplication | OK for one flagship story (e.g. 401) | Source of truth for edge cases |

If an example and a test share mock code, that is intentional: the **test** guards regressions; the **example** explains the flow to a human.

---

## Gaps intentionally light in examples

These are documented in [README](../README.md) / [ARCHITECTURE](../docs/ARCHITECTURE.md) and covered in **tests** rather than duplicated as long demos:

- Parallel 401 refresh wave (multiple simultaneous requests)
- `retryAfterRefresh: false`
- `enableInterceptors: false`
- `rawPost` (internal auth refresh transport)
- Every SSL error code variant

---

## All commands

```bash
pnpm run example              # core CRUD (network)
pnpm run example:core         # meta, PATCH, errors (offline)
pnpm run example:advanced     # cancel, interceptors, retry (network)
pnpm run example:interceptors # interceptor cookbook (network)
pnpm run example:combined     # all plugins wired (offline mock)
pnpm run example:auth         # auth API (partial offline)
pnpm run example:auth:lifecycle
pnpm run example:auth:401
pnpm run example:cookie
pnpm run example:upload       # network
pnpm run example:ssl          # network
pnpm run example:errors       # offline
```

Examples that call public hosts may fail when a service is down or blocked — that does not indicate a library bug.
