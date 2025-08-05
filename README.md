# Fetch Client

A reusable, TypeScript-first HTTP client built on top of the native Fetch API. Designed for modern JavaScript/TypeScript applications including Next.js projects.

## Features

- 🔥 **TypeScript-first** with full type safety
- ⏹️ **Request Cancellation** with AbortController support
- 🔄 **Smart Retry Logic** with exponential backoff and jitter
- 🎯 **Full Interceptor System** for requests, responses, and errors
- 🔒 **SSL/Certificate Error Handling** with user-friendly messages
- 📁 **File Upload Support** with progress tracking and validation
- 🔐 **Authentication Management** with automatic token refresh
- ⏱️ **Request timeout** handling
- 🔧 **Configurable** base URL and default headers
- 📦 **Tree-shakeable** ESM and CommonJS builds
- 🎯 **All HTTP methods** (GET, POST, PUT, DELETE, PATCH)
- 🛠️ **Native Fetch API** (works in Node.js 18+ and all modern browsers)
- 🐛 **Debug mode** with comprehensive logging
- 🔐 **Built-in auth helpers** and common interceptors
- 🧪 **Comprehensive test suite** with examples

## Installation

```bash
pnpm add @myopentrip/fetch-client
```

## Quick Start

```typescript
import { FetchClient } from '@myopentrip/fetch-client';

// Create a client instance
const client = new FetchClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

// Make requests
const response = await client.get('/users');
console.log(response.data);
```

## Usage

### Basic Usage

```typescript
import { FetchClient, createFetchClient } from '@myopentrip/fetch-client';

// Option 1: Create with constructor
const client = new FetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com'
});

// Option 2: Use factory function
const client2 = createFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com'
});

// GET request
const users = await client.get('/users');

// POST request
const newUser = await client.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updatedUser = await client.put('/users/1', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});

// DELETE request
await client.delete('/users/1');
```

### Configuration Options

```typescript
const client = new FetchClient({
  baseURL: 'https://api.example.com',  // Base URL for all requests
  timeout: 10000,                      // Request timeout in milliseconds (default: 10000)
  headers: {                           // Default headers for all requests
    'Authorization': 'Bearer token',
    'X-Custom-Header': 'value'
  },
  retries: 3,                          // Number of retry attempts (default: 0)
  retryDelay: 1000,                    // Base delay between retries in ms (default: 1000)
  enableInterceptors: true,            // Enable interceptor system (default: true)
  debug: true                          // Enable debug logging (default: false)
});
```

### Advanced Retry Configuration

```typescript
client.updateRetryConfig({
  maxRetries: 3,
  baseDelay: 1000,         // Starting delay
  maxDelay: 30000,         // Maximum delay cap
  backoffFactor: 2,        // Exponential backoff multiplier
  jitter: true,            // Add randomness to prevent thundering herd
  retryCondition: (error, attempt) => {
    // Custom retry logic - retry on 5xx errors, not 4xx
    return !error.status || (error.status >= 500 && error.status < 600);
  }
});
```

### Request Cancellation

```typescript
// Cancel requests using AbortController
const controller = new AbortController();

// Start the request
const requestPromise = client.get('/users', {
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await requestPromise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

### Interceptor System

All three types of interceptors are now working perfectly and integrate with the retry system.

```typescript
// Request interceptors (modify outgoing requests)
const removeAuthInterceptor = client.addRequestInterceptor(async (config) => {
  const token = await getAuthToken();
  config.headers = {
    ...config.headers,
    'Authorization': `Bearer ${token}`
  };
  return config;
});

// Response interceptors (modify incoming responses)
const removeResponseInterceptor = client.addResponseInterceptor((response) => {
  console.log(`Response received: ${response.status}`);
  return response;
});

// Error interceptors (handle/transform errors)
const removeErrorInterceptor = client.addErrorInterceptor((error) => {
  console.error('Request failed:', error.message);
  // Transform error, add context, send to monitoring, etc.
  
  // Add custom error categorization
  if (!error.status) {
    error.category = 'NETWORK_ERROR';
  } else if (error.status >= 500) {
    error.category = 'SERVER_ERROR';
  }
  
  return error;
});

// Remove interceptors when no longer needed
removeAuthInterceptor();
removeResponseInterceptor();
removeErrorInterceptor();
```

**Test the interceptor system:**
```bash
# Run comprehensive interceptor tests
pnpm run test:interceptors

# See real-world interceptor examples
pnpm run example:interceptors
```

### Cookie-Based Authentication (Recommended for Production)

```typescript
import { 
  FetchClient, 
  createAuthConfig,
  createCookieStorage,
  createSecureCookieStorage,
  createServerSideCookieStorage
} from '@myopentrip/fetch-client';

// Secure cookie authentication
const client = new FetchClient({
  baseURL: 'https://api.example.com',
  auth: createAuthConfig({
    storage: 'cookie',
    loginUrl: '/auth/login',
    tokenRefreshUrl: '/auth/refresh',
    
    cookieOptions: {
      secure: true, // HTTPS only
      httpOnly: false, // Note: httpOnly must be set server-side
      sameSite: 'strict', // CSRF protection
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
      domain: '.yourdomain.com' // Allow subdomains
    }
  })
});

// For encrypted cookie storage
const encryptedStorage = createSecureCookieStorage('your-secret-key');
const secureClient = new FetchClient({
  baseURL: 'https://api.example.com',
  auth: createAuthConfig({
    storage: 'custom',
    customStorage: encryptedStorage
  })
});

// Server-side cookie auth (Next.js)
const serverStorage = createServerSideCookieStorage(
  () => req.headers.cookie || '',
  (name, value, options) => res.setHeader('Set-Cookie', `${name}=${value}; HttpOnly; Secure`),
  (name) => res.setHeader('Set-Cookie', `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`)
);
```

### Cookie Utilities

```typescript
import { 
  getCookie,
  setCookie,
  removeCookie,
  parseCookies,
  getAllCookies,
  clearAllCookies,
  areCookiesEnabled,
  CookieSession
} from '@myopentrip/fetch-client';

// Get a specific cookie
const authToken = getCookie('authToken');

// Set a cookie with options
setCookie('userPrefs', JSON.stringify({ theme: 'dark' }), {
  secure: true,
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 // 30 days
});

// Remove a cookie
removeCookie('authToken');

// Parse cookies from string
const cookies = parseCookies(document.cookie);

// Get all cookies as object
const allCookies = getAllCookies();

// Clear all cookies (limited effectiveness)
clearAllCookies();

// Check if cookies are enabled
if (areCookiesEnabled()) {
  console.log('Cookies are supported');
}

// Cookie-based session management
const session = new CookieSession('userSession', {
  secure: true,
  maxAge: 8 * 60 * 60 // 8 hours
});

// Set session data
session.set({ userId: 123, preferences: { theme: 'dark' } });

// Get session data
const sessionData = session.get();

// Check if session exists
if (session.exists()) {
  console.log('Session found');
}

// Clear session
session.clear();
```

### Storage Strategy Comparison

| Storage Type | Security | Persistence | SSR Support | Auto-sent |
|--------------|----------|-------------|-------------|-----------|
| **Cookies** | ✅ httpOnly, Secure | ✅ Configurable | ✅ Yes | ✅ Automatic |
| localStorage | ❌ XSS vulnerable | ✅ Permanent | ❌ No | ❌ Manual |
| sessionStorage | ❌ XSS vulnerable | ⚠️ Tab session | ❌ No | ❌ Manual |
| memory | ✅ Secure | ❌ Page session | ✅ Yes | ❌ Manual |

**Recommendation: Use cookies for production apps** for better security and SSR compatibility.

### Built-in Interceptor Helpers

```typescript
import { 
  createAuthInterceptor, 
  createLoggingInterceptor,
  createTimingInterceptor,
  // SSL Error Handling
  createSSLErrorInterceptor,
  createDevelopmentSSLErrorInterceptor,
  createProductionSSLErrorInterceptor,
  isSSLError,
  analyzeSSLError
} from '@myopentrip/fetch-client';

// Automatic auth token injection
client.addRequestInterceptor(
  createAuthInterceptor(() => localStorage.getItem('token'))
);

// Request/response logging
client.addRequestInterceptor(createLoggingInterceptor(true));

// Performance timing
const timing = createTimingInterceptor();
client.addRequestInterceptor(timing.request);
client.addResponseInterceptor(timing.response);

// SSL Error Handling (enabled by default)
client.addErrorInterceptor(createSSLErrorInterceptor());
```

### SSL/Certificate Error Handling

The package automatically transforms cryptic SSL errors into user-friendly messages:

```typescript
import { 
  FetchClient,
  createSSLErrorInterceptor,
  createDevelopmentSSLErrorInterceptor,
  createProductionSSLErrorInterceptor,
  isSSLError,
  analyzeSSLError
} from '@myopentrip/fetch-client';

// SSL error handling is ENABLED BY DEFAULT
const client = new FetchClient({
  baseURL: 'https://api.example.com'
  // SSL errors are automatically transformed!
});

try {
  await client.get('/secure-endpoint');
} catch (error) {
  // BEFORE: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  // AFTER:  "SSL certificate verification failed. The server's certificate could not be verified."
  
  console.log(error.message); // User-friendly message
  console.log(error.sslError.suggestions); // Actionable solutions
}

// Custom SSL error handling
const customClient = new FetchClient({
  baseURL: 'https://api.example.com',
  sslErrorHandling: {
    enabled: true,
    includeTechnicalDetails: true, // Show details in development
    includeSuggestions: true,      // Show helpful suggestions
    customTransformer: (error) => {
      // Send to monitoring service
      monitoringService.reportSSLError(error);
      return error;
    }
  }
});

// Development vs Production modes
const devClient = new FetchClient({
  baseURL: 'https://localhost:8443',
  debug: true // Automatically shows technical details
});

const prodClient = new FetchClient({
  baseURL: 'https://api.production.com',
  sslErrorHandling: {
    includeTechnicalDetails: false, // Hide technical details
    includeSuggestions: false       // Hide suggestions from end users
  }
});

// Manual SSL error analysis
try {
  await client.get('/api/data');
} catch (error) {
  if (isSSLError(error)) {
    const analysis = analyzeSSLError(error);
    console.log('Error type:', analysis.type);
    console.log('User message:', analysis.userFriendlyMessage);
    console.log('Retryable:', analysis.retryable);
    console.log('Suggestions:', analysis.suggestions);
  }
}

// Disable SSL error handling (get raw errors)
const rawClient = new FetchClient({
  baseURL: 'https://api.example.com',
  sslErrorHandling: { enabled: false }
});
```

**Test SSL error handling:**
```bash
# Run SSL error tests
pnpm run test:ssl

# See real-world SSL examples
pnpm run example:ssl
```

### Authentication Management

```typescript
import { 
  FetchClient, 
  createAuthConfig,
  createLoginCredentials,
  getUserFromToken,
  extractJWTPayload,
  isTokenExpired,
  formatTokenTimeRemaining
} from '@myopentrip/fetch-client';

// Create client with authentication
const client = new FetchClient({
  baseURL: 'https://api.example.com',
  auth: createAuthConfig({
    loginUrl: '/auth/login',
    logoutUrl: '/auth/logout',
    tokenRefreshUrl: '/auth/refresh',
    storage: 'cookie', // 'localStorage', 'sessionStorage', 'memory', 'cookie', 'custom'
    autoRefresh: true,
    refreshThreshold: 300, // Refresh when token expires in 5 minutes
    
    // Cookie-specific options (when storage: 'cookie')
    cookieOptions: {
      secure: true, // HTTPS only
      sameSite: 'strict', // CSRF protection
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    },
    
    // Event handlers
    onLoginSuccess: (tokens) => {
      console.log('Login successful!');
      const user = getUserFromToken(tokens.accessToken);
      console.log('User:', user);
    },
    
    onTokenRefresh: (tokens) => {
      console.log('Token refreshed automatically');
    },
    
    onTokenExpired: () => {
      console.log('Please login again');
      window.location.href = '/login';
    }
  })
});

// Login
await client.login({
  email: 'user@example.com',
  password: 'password123'
});

// All subsequent requests automatically include auth token
const userProfile = await client.get('/user/profile');
const userSettings = await client.put('/user/settings', { theme: 'dark' });

// Check authentication status
if (client.isAuthenticated()) {
  console.log('User is logged in');
}

// Manual token refresh
if (client.isTokenExpired()) {
  await client.refreshTokens();
}

// Logout
await client.logout();

// Get current user information
const user = client.getUser();
console.log('Current user:', user);

// Set user information
client.setUser({ id: 1, name: 'John Doe', email: 'john@example.com' });

// Get authentication state
const authState = client.getAuthState();
console.log('Auth state:', authState);
```

### Advanced Authentication Utilities

```typescript
import { 
  extractJWTPayload,
  getUserFromToken,
  isTokenExpired,
  formatTokenTimeRemaining,
  validateTokenStructure,
  createSecureStorage,
  AuthEventEmitter,
  TokenRefreshQueue
} from '@myopentrip/fetch-client';

// Extract JWT payload without verification (client-side only)
const payload = extractJWTPayload(token);
console.log('Token payload:', payload);

// Get user information from JWT token
const user = getUserFromToken(token);
console.log('User from token:', user);

// Check if token is expired or will expire soon
const isExpired = isTokenExpired(tokens, 300); // Check if expires in 5 minutes
console.log('Token expired:', isExpired);

// Format time until token expires
const timeRemaining = formatTokenTimeRemaining(tokens);
console.log('Time remaining:', timeRemaining);

// Validate token structure
const validation = validateTokenStructure(tokens);
if (!validation.valid) {
  console.error('Token validation errors:', validation.errors);
}

// Create secure storage with encryption
const secureStorage = createSecureStorage('your-encryption-key');
secureStorage.setItem('sensitiveData', 'encrypted-value');

// Auth event emitter for handling auth state changes
const authEvents = new AuthEventEmitter();
const unsubscribe = authEvents.on('login', (tokens) => {
  console.log('User logged in:', tokens);
});

// Token refresh queue to prevent concurrent refresh requests
const refreshQueue = new TokenRefreshQueue();
const tokens = await refreshQueue.startRefresh(async () => {
  // Your refresh logic here
  return await refreshTokens();
});
```

### File Upload Support

```typescript
import { 
  FetchClient, 
  createFileUploadData, 
  createProgressCallback,
  validateFile, 
  formatFileSize,
  formatUploadSpeed,
  formatTimeRemaining
} from '@myopentrip/fetch-client';

const client = new FetchClient({
  baseURL: 'https://api.example.com'
});

// Simple file upload
const file = document.getElementById('file-input').files[0];
const response = await client.uploadFile('/api/upload', {
  file,
  fieldName: 'document',
  additionalFields: {
    description: 'User upload',
    category: 'documents'
  }
});

// Multiple files upload
const files = Array.from(document.getElementById('files-input').files);
await client.uploadFiles('/api/upload-multiple', files, {
  fieldName: 'files[]'
});

// File upload with progress tracking
await client.uploadFile('/api/upload', { file }, {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
    console.log(`Speed: ${formatUploadSpeed(progress.speed)}`);
    if (progress.estimatedTime) {
      console.log(`Time remaining: ${formatTimeRemaining(progress.estimatedTime)}`);
    }
  },
  onUploadStart: () => console.log('Upload started'),
  onUploadComplete: () => console.log('Upload finished'),
});

// Using progress callback helper
const progressCallback = createProgressCallback(
  (percentage) => console.log(`Progress: ${percentage}%`),
  (speed) => console.log(`Speed: ${formatUploadSpeed(speed)}`),
  (timeRemaining) => console.log(`ETA: ${formatTimeRemaining(timeRemaining)}`)
);

await client.uploadFile('/api/upload', { file }, {
  onProgress: progressCallback
});

// Complex form data with files and other fields
await client.uploadFormData('/api/profile', {
  // Files
  avatar: avatarFile,
  documents: [doc1, doc2],
  
  // Other fields
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// File validation before upload
const validation = validateFile(file, {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png'],
  allowedExtensions: ['jpg', 'jpeg', 'png']
});

if (!validation.valid) {
  console.error(validation.error);
  return;
}
```

### Per-Request Configuration

```typescript
// Override config for specific requests
const response = await client.get('/users', {
  timeout: 5000,
  retries: 2,
  signal: controller.signal,  // Request cancellation
  headers: {
    'X-Custom-Header': 'override-value'
  }
});
```

### Error Handling

```typescript
import type { FetchError } from '@myopentrip/fetch-client';

try {
  const response = await client.get('/users');
} catch (error) {
  const fetchError = error as FetchError;
  
  if (fetchError.status) {
    console.log(`HTTP Error: ${fetchError.status} ${fetchError.statusText}`);
  } else {
    console.log(`Network Error: ${fetchError.message}`);
  }
}
```

### TypeScript Support

The client provides full TypeScript support with generic types:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Typed responses
const response = await client.get<User[]>('/users');
const users: User[] = response.data;

// Type-safe request bodies
const newUser = await client.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Use in Next.js

Perfect for Next.js API routes and client-side data fetching:

```typescript
// lib/api-client.ts
import { createFetchClient } from '@myopentrip/fetch-client';

export const apiClient = createFetchClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// pages/api/users.ts or app/api/users/route.ts
import { apiClient } from '../../lib/api-client';

export async function GET() {
  try {
    const response = await apiClient.get('/external-api/users');
    return Response.json(response.data);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
```

## API Reference

### Constructor

```typescript
new FetchClient(config?: FetchClientConfig)
```

### HTTP Methods

- `get<T>(path: string, config?: RequestConfig): Promise<FetchResponse<T>>`
- `post<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>`
- `put<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>`
- `patch<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>`
- `delete<T>(path: string, config?: RequestConfig): Promise<FetchResponse<T>>`
- `request<T>(method: HttpMethod, path: string, config?: RequestConfig): Promise<FetchResponse<T>>`

### Authentication Methods

- `login<T>(credentials: LoginCredentials): Promise<FetchResponse<T>>`
- `logout(): Promise<void>`
- `setTokens(tokens: AuthTokens): Promise<void>`
- `getTokens(): AuthTokens | null`
- `clearTokens(): Promise<void>`
- `isAuthenticated(): boolean`
- `isTokenExpired(threshold?: number): boolean`
- `refreshTokens(): Promise<AuthTokens>`
- `getAuthState(): AuthState`
- `setUser(user: any): void`
- `getUser(): any`

### File Upload Methods

- `uploadFile<T>(path: string, fileData: FileUploadData, config?: FileUploadConfig): Promise<FetchResponse<T>>`
- `uploadFiles<T>(path: string, files: File[], config?: FileUploadConfig): Promise<FetchResponse<T>>`
- `uploadFormData<T>(path: string, formData: FormData | MultipartFormData, config?: FileUploadConfig): Promise<FetchResponse<T>>`

### Interceptor Methods

- `addRequestInterceptor(interceptor: RequestInterceptor): () => void`
- `addResponseInterceptor(interceptor: ResponseInterceptor): () => void`
- `addErrorInterceptor(interceptor: ErrorInterceptor): () => void`
- `updateRetryConfig(config: Partial<RetryConfig>): void`

### SSL Error Handling Methods

- `isSSLError(error: FetchError): boolean` - Detect SSL/certificate errors
- `analyzeSSLError(error: FetchError): SSLErrorInfo` - Get detailed SSL error analysis
- `transformSSLError(error: FetchError, config?: SSLErrorConfig): FetchError` - Transform SSL errors
- `shouldRetrySSLError(error: FetchError): boolean` - Check if SSL error is retryable
- `getSSLErrorSuggestions(error: FetchError): string[]` - Get actionable suggestions
- `createSSLErrorInterceptor(config?: SSLErrorConfig): ErrorInterceptor` - Create SSL error interceptor
- `createDevelopmentSSLErrorInterceptor(): ErrorInterceptor` - Development-friendly SSL interceptor
- `createProductionSSLErrorInterceptor(): ErrorInterceptor` - Production-safe SSL interceptor

### Types

```typescript
interface FetchResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

interface FetchClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  enableInterceptors?: boolean;
  debug?: boolean;
  auth?: AuthConfig;
  sslErrorHandling?: SSLErrorHandlingConfig;
}

interface SSLErrorHandlingConfig {
  enabled?: boolean; // Default: true
  includeTechnicalDetails?: boolean; // Default: false (true in debug mode)
  includeSuggestions?: boolean; // Default: true
  customTransformer?: (error: FetchError) => FetchError;
}

interface AuthConfig {
  tokenKey?: string;
  refreshTokenKey?: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory' | 'cookie' | 'custom';
  cookieOptions?: CookieOptions;
  customStorage?: {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
  };
  tokenRefreshUrl?: string;
  loginUrl?: string;
  logoutUrl?: string;
  tokenPrefix?: string;
  autoRefresh?: boolean;
  refreshThreshold?: number;
  onTokenRefresh?: (tokens: AuthTokens) => void | Promise<void>;
  onTokenExpired?: () => void | Promise<void>;
  onLoginSuccess?: (tokens: AuthTokens) => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
  onAuthError?: (error: FetchError) => void | Promise<void>;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
}

interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
  [key: string]: any;
}

interface AuthState {
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  user?: any;
  isRefreshing: boolean;
  lastRefresh?: number;
}

interface FileUploadConfig extends Omit<RequestConfig, 'body'> {
  onProgress?: (progress: UploadProgressEvent) => void;
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
  onUploadError?: (error: Error) => void;
  chunkSize?: number;
}

interface UploadProgressEvent {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  estimatedTime?: number;
}

interface FileUploadData {
  file: File | File[];
  fieldName?: string;
  additionalFields?: Record<string, string | number | boolean>;
  fileName?: string;
}

interface CookieOptions {
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  expires?: Date;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryCondition?: (error: FetchError, attempt: number) => boolean;
}

interface SSLErrorInfo {
  type: 'certificate' | 'network' | 'timeout' | 'unknown';
  originalError: string;
  userFriendlyMessage: string;
  technicalDetails: string;
  suggestions: string[];
  retryable: boolean;
}
```

## Testing and Examples

The package includes comprehensive tests and real-world examples:

```bash
# Test the interceptor system
pnpm run test:interceptors

# Test SSL error handling
pnpm run test:ssl

# See interceptor examples
pnpm run example:interceptors

# See SSL error handling examples
pnpm run example:ssl

# Build the package
pnpm run build
```

## License

MIT