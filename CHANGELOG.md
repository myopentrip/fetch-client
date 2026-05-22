# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Auth plugin singleton:** calling `createAuthPlugin` twice on the same `FetchClient` returns the existing instance instead of registering duplicate interceptors.
- **`AuthPlugin.getForClient(client)`** — check whether a client already has an auth plugin registered.
- **401 recovery wave:** parallel 401 responses share a single refresh (`recoveryPromise` + waiter refcount), then each failed request retries on its own.
- Tests in `test:auth:401` for duplicate `createAuthPlugin` and parallel 401 refresh behavior.

### Changed

- **`auth.teardown()`** now unregisters the plugin from the client (`WeakMap`) so a new plugin can be attached afterward.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** translated to English and updated with singleton + recovery wave behavior.

---

## [3.0.0]

### Breaking changes

- **Core vs plugins:** `FetchClient` no longer accepts `auth` or `sslErrorHandling` in the constructor.
- Auth: `import { createAuthPlugin } from '@myopentrip/fetch-client/auth'`
- Upload: `import { createUploadPlugin } from '@myopentrip/fetch-client/upload'`
- SSL: `await client.use(createSSLErrorPlugin())` from `@myopentrip/fetch-client/ssl`
- `FetchResponse` now includes required `meta` (`path`, `method`).
- `client.login()`, `client.uploadFile()`, and related APIs moved to plugins.

### Added

- **v3 architecture:** slim core with optional subpath exports (`/auth`, `/upload`, `/ssl`).
- **`FetchClient.use(plugin)`** for optional plugins (e.g. SSL error handling).
- **401 auto-retry:** after a successful token refresh, the failed request is retried once (`retryAfterRefresh`, default `true`).
- Error interceptors may return `FetchResponse` to recover from errors (powers auth 401 retry).
- **`auth.teardown()`** to remove auth interceptors.
- Package `exports` map for tree-shaking: `.`, `./auth`, `./upload`, `./ssl`.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — core vs plugins design.
- README rewritten for v3; examples and tests migrated to plugin imports.

### Fixed

- Auth init is async via `await createAuthPlugin()` (no constructor race).
- 401 + `refreshToken` attempts refresh without requiring `expiresAt`.
- `memory` storage uses a single `Map` per auth plugin instance.
- Auth headers use `mergeHeaders()` (safe for `Headers` objects and header arrays).
- Login/logout/refresh use `skipAuthRefresh` to avoid refresh loops.
- Token refresh uses `rawPost` (bypasses interceptors/retry).
- Error interceptors run once on final failure, not on every retry attempt.
- Upload without `onProgress` uses the full `client.request()` pipeline.
- Removed duplicated `prepareRequestBody` / `createURL` logic (shared `request-helpers`).

---

## [2.7.0]

### Added

- **Enhanced HTTP error messages** — descriptive status text from numeric codes when `statusText` is missing or inconsistent.
- Comprehensive HTTP status code mapping (1xx–5xx) with fallback to preserve custom `statusText`.

### Examples

- `HTTP 404: Not Found` (instead of `HTTP 404: ` when statusText is empty)
- `HTTP 500: Internal Server Error`
- `HTTP 404: Not Found (Custom Message)` (when server `statusText` differs from the standard label)

---

## [2.6.0]

### Added

- Enhanced SSL error handling with Node.js-specific error codes and improved detection.
- Tests for SSL error detection and transformation across environments.

---

## [2.5.0]

### Fixed

- Critical typo in interceptors filename and export.
- Error interceptors not integrating with the retry system.
- TypeScript type casting issues in response interceptors.
- Auth interceptor cleanup to prevent memory leaks.

### Added

- SSL/certificate error handling with user-friendly messages.
- Enhanced error interceptors integrated with retry.
- Test suite and examples for interceptors and SSL errors.
- npm scripts for tests and examples.

### Examples

- `UNABLE_TO_VERIFY_LEAF_SIGNATURE` → certificate verification failed message.
- `DEPTH_ZERO_SELF_SIGNED_CERT` → self-signed certificate message.
- `CERT_EXPIRED` → certificate expired message.
