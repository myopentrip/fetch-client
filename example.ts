// Example usage of the fetch-client package
import { FetchClient, createFetchClient } from './src/index';

async function examples() {
  // Example 1: Basic usage with constructor
  const client = new FetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
    retries: 2
  });

  try {
    // GET request
    const users = await client.get('/users');
    console.log('Users:', users.data);

    // POST request
    const newPost = await client.post('/posts', {
      title: 'My New Post',
      body: 'This is the content of my post',
      userId: 1
    });
    console.log('Created post:', newPost.data);

    // PUT request
    const updatedPost = await client.put('/posts/1', {
      id: 1,
      title: 'Updated Post Title',
      body: 'Updated content',
      userId: 1
    });
    console.log('Updated post:', updatedPost.data);

    // DELETE request
    await client.delete('/posts/1');
    console.log('Post deleted successfully');

  } catch (error) {
    console.error('Request failed:', error);
  }

  // Example 2: Using factory function
  const apiClient = createFetchClient({
    baseURL: 'https://api.github.com',
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  try {
    const repos = await apiClient.get('/users/octocat/repos');
    console.log('GitHub repos:', repos.data);
  } catch (error) {
    console.error('GitHub API error:', error);
  }

  // Example 3: TypeScript with interfaces
  interface User {
    id: number;
    name: string;
    email: string;
  }

  const typedClient = new FetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  const typedUsers = await typedClient.get<User[]>('/users');
  console.log('First user name:', typedUsers.data[0].name);
}

// Uncomment to run examples
// examples().catch(console.error);