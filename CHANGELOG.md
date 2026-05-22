# Recent Improvements ✨

## v3.0.0

### Breaking changes

- **Core vs plugins:** `FetchClient` no longer accepts `auth` or `sslErrorHandling` in the constructor.
- Auth: `import { createAuthPlugin } from '@myopentrip/fetch-client/auth'`
- Upload: `import { createUploadPlugin } from '@myopentrip/fetch-client/upload'`
- SSL: `await client.use(createSSLErrorPlugin())` from `@myopentrip/fetch-client/ssl`
- `FetchResponse` now includes required `meta` (`path`, `method`).

### Fixes (carried into v3)

- Auth init is async via `await createAuthPlugin()` (no constructor race).
- 401 + refresh token attempts refresh without requiring `expiresAt`.
- `memory` storage uses a single Map per plugin instance.
- Auth headers use `mergeHeaders()` (safe for `Headers` objects).
- Error interceptors run once on final failure, not on every retry attempt.
- Upload without progress uses the full `client.request()` pipeline.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## v2.7.0

### 🚀 Enhancements

- **Enhanced HTTP Error Messages** - HTTP error messages now include descriptive status text based on numeric status codes, providing consistent and informative error descriptions even when server-provided `statusText` is missing or inconsistent.
- Added comprehensive HTTP status code mapping (1xx-5xx) with fallback logic to preserve original `statusText` when it differs from standard descriptions.
- Improved error handling reliability across different server implementations and environments.

### 💡 Error Message Examples:
- `HTTP 404: Not Found` (instead of `HTTP 404: ` when statusText is empty)
- `HTTP 500: Internal Server Error` (consistent descriptions regardless of server implementation)
- `HTTP 404: Not Found (Custom Message)` (preserves custom statusText when different from standard)

## v2.6.0

### 🚀 Enhancements

- Enhanced SSL error handling in FetchClient by adding support for Node.js specific error codes and improving detection logic.
- Introduced new tests to validate SSL error detection and transformation across different environments, ensuring robust handling of SSL certificate issues.
- Updated existing tests to cover a wider range of scenarios, including user customization options for error handling.

## v2.5.0

### 🐛 Bug Fixes:
- ✅ Fixed critical typo in interceptors filename and export
- ✅ Fixed error interceptors not integrating with retry system (now fully functional!)
- ✅ Fixed TypeScript type casting issues in response interceptors
- ✅ Improved auth interceptor cleanup to prevent memory leaks

### 🚀 New Features:
- ✅ **SSL/Certificate Error Handling** - Automatic transformation of cryptic SSL errors into user-friendly messages
- ✅ **Enhanced Error Interceptors** - Now work with retry system and provide rich error context
- ✅ **Comprehensive Test Suite** - Full test coverage for interceptors and SSL error handling
- ✅ **Real-world Examples** - Production-ready code examples and patterns
- ✅ **Development Tools** - Easy-to-run npm scripts for testing and examples

### 💡 SSL Error Transformation Examples:
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE` → "SSL certificate verification failed. The server's certificate could not be verified."
- `DEPTH_ZERO_SELF_SIGNED_CERT` → "The server is using a self-signed certificate which cannot be verified."
- `CERT_EXPIRED` → "The server's SSL certificate has expired."

The package now provides enterprise-grade error handling while maintaining simplicity for basic use cases.
