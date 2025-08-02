# Fetch Client

A reusable, TypeScript-first HTTP client built on top of the native Fetch API. Designed for modern JavaScript/TypeScript applications including Next.js projects.

## Features

- 🔥 **TypeScript-first** with full type safety
- ⏹️ **Request Cancellation** with AbortController support
- 🔄 **Smart Retry Logic** with exponential backoff and jitter
- 🎯 **Interceptor System** for requests, responses, and errors
- 📁 **File Upload Support** with progress tracking and validation
- ⏱️ **Request timeout** handling
- 🔧 **Configurable** base URL and default headers
- 📦 **Tree-shakeable** ESM and CommonJS builds
- 🎯 **All HTTP methods** (GET, POST, PUT, DELETE, PATCH)
- 🛠️ **Native Fetch API** (works in Node.js 18+ and all modern browsers)
- 🐛 **Debug mode** with comprehensive logging
- 🔐 **Built-in auth helpers** and common interceptors

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
  return error;
});

// Remove interceptors when no longer needed
removeAuthInterceptor();
removeResponseInterceptor();
removeErrorInterceptor();
```

### Built-in Interceptor Helpers

```typescript
import { 
  createAuthInterceptor, 
  createLoggingInterceptor,
  createTimingInterceptor 
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
```

### File Upload Support

```typescript
import { 
  FetchClient, 
  createFileUploadData, 
  validateFile, 
  formatFileSize,
  formatUploadSpeed 
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
  },
  onUploadStart: () => console.log('Upload started'),
  onUploadComplete: () => console.log('Upload finished'),
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

### Methods

- `get<T>(path: string, config?: RequestConfig): Promise<FetchResponse<T>>`
- `post<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>`
- `put<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>`
- `patch<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>`
- `delete<T>(path: string, config?: RequestConfig): Promise<FetchResponse<T>>`
- `request<T>(method: HttpMethod, path: string, config?: RequestConfig): Promise<FetchResponse<T>>`

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
}
```

## License

MIT