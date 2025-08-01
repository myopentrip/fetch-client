# Fetch Client

A reusable, TypeScript-first HTTP client built on top of the native Fetch API. Designed for modern JavaScript/TypeScript applications including Next.js projects.

## Features

- 🔥 TypeScript support with full type safety
- 🔄 Automatic retry mechanism with exponential backoff
- ⏱️ Request timeout handling
- 🔧 Configurable base URL and default headers
- 📦 Tree-shakeable ESM and CommonJS builds
- 🎯 Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH)
- 🛠️ Built on native Fetch API (works in Node.js 18+ and all modern browsers)

## Installation

```bash
pnpm add fetch-client
```

## Quick Start

```typescript
import { FetchClient } from 'fetch-client';

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
import { FetchClient, createFetchClient } from 'fetch-client';

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
  retryDelay: 1000                     // Delay between retries in ms (default: 1000)
});
```

### Per-Request Configuration

```typescript
// Override config for specific requests
const response = await client.get('/users', {
  timeout: 5000,
  retries: 2,
  headers: {
    'X-Custom-Header': 'override-value'
  }
});
```

### Error Handling

```typescript
import type { FetchError } from 'fetch-client';

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
import { createFetchClient } from 'fetch-client';

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