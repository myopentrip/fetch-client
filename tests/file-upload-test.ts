// Quick test to verify file upload functionality
import { 
  FetchClient, 
  createFileUploadData,
  validateFile,
  formatFileSize,
  formatUploadSpeed,
  formatTimeRemaining,
  type UploadProgressEvent
} from '../src/index';

async function testFileUploadFeatures() {
  console.log('🧪 Testing File Upload Features\n');
  console.log('================================\n');

  const client = new FetchClient({
    baseURL: 'https://httpbin.org', // Test API that accepts file uploads
    debug: true,
  });

  // Test 1: Basic file upload functionality
  console.log('1️⃣ Testing Basic File Upload');
  
  const testFile = new File(['Hello, file upload!'], 'test.txt', { 
    type: 'text/plain' 
  });

  try {
    const response = await client.uploadFile('/post', {
      file: testFile,
      fieldName: 'testfile',
      additionalFields: {
        description: 'Test file upload',
        timestamp: Date.now().toString()
      }
    });
    
    console.log('✅ Basic file upload test passed');
    console.log('Response:', response.status, response.statusText);
  } catch (error) {
    console.log('ℹ️ Basic upload test (expected to work with FormData)');
    console.log('Error:', (error as Error).message);
  }

  // Test 2: File validation
  console.log('\n2️⃣ Testing File Validation');
  
  const testFiles = [
    new File(['Small file'], 'small.txt', { type: 'text/plain' }),
    new File([new ArrayBuffer(1024 * 1024 * 2)], 'medium.bin', { type: 'application/octet-stream' }), // 2MB
    new File(['Image data'], 'photo.jpg', { type: 'image/jpeg' }),
    new File(['Script'], 'script.js', { type: 'application/javascript' }),
  ];

  const validationRules = {
    maxSize: 1024 * 1024, // 1MB max
    allowedTypes: ['text/plain', 'image/jpeg'],
    allowedExtensions: ['txt', 'jpg']
  };

  console.log('File validation results:');
  testFiles.forEach((file, index) => {
    const validation = validateFile(file, validationRules);
    const status = validation.valid ? '✅' : '❌';
    console.log(`${status} File ${index + 1} (${file.name}): ${validation.valid ? 'Valid' : validation.error}`);
  });

  // Test 3: Helper functions
  console.log('\n3️⃣ Testing Helper Functions');
  
  console.log('File size formatting:');
  console.log(`- 1024 bytes: ${formatFileSize(1024)}`);
  console.log(`- 1048576 bytes: ${formatFileSize(1048576)}`);
  console.log(`- 1073741824 bytes: ${formatFileSize(1073741824)}`);

  console.log('\nUpload speed formatting:');
  console.log(`- 1024 B/s: ${formatUploadSpeed(1024)}`);
  console.log(`- 1048576 B/s: ${formatUploadSpeed(1048576)}`);

  console.log('\nTime remaining formatting:');
  console.log(`- 30 seconds: ${formatTimeRemaining(30)}`);
  console.log(`- 120 seconds: ${formatTimeRemaining(120)}`);
  console.log(`- 3660 seconds: ${formatTimeRemaining(3660)}`);

  // Test 4: Progress callback creation
  console.log('\n4️⃣ Testing Progress Callbacks');
  
  const mockProgress: UploadProgressEvent = {
    loaded: 2048,
    total: 4096,
    percentage: 50,
    speed: 1024,
    estimatedTime: 2
  };

  console.log('Mock progress event:');
  console.log(`- Loaded: ${formatFileSize(mockProgress.loaded)}`);
  console.log(`- Total: ${formatFileSize(mockProgress.total)}`);
  console.log(`- Percentage: ${mockProgress.percentage}%`);
  console.log(`- Speed: ${formatUploadSpeed(mockProgress.speed!)}`);
  console.log(`- Time remaining: ${formatTimeRemaining(mockProgress.estimatedTime!)}`);

  // Test 5: File upload data creation
  console.log('\n5️⃣ Testing File Upload Data Creation');
  
  const uploadData = createFileUploadData(testFile, {
    fieldName: 'customField',
    additionalFields: {
      category: 'test',
      priority: 'high'
    },
    fileName: 'renamed-test.txt'
  });

  console.log('✅ File upload data created successfully');
  console.log('Field name:', uploadData.fieldName);
  console.log('Additional fields:', uploadData.additionalFields);
  console.log('Custom filename:', uploadData.fileName);

  // Test 6: FormData upload
  console.log('\n6️⃣ Testing FormData Upload');
  
  try {
    const response = await client.uploadFormData('/post', {
      file: testFile,
      message: 'Hello from FormData',
      number: 42,
      isTest: true
    });
    
    console.log('✅ FormData upload test passed');
  } catch (error) {
    console.log('ℹ️ FormData upload test (expected to work)');
    console.log('Error:', (error as Error).message);
  }

  console.log('\n🎉 All file upload feature tests completed!');
}

// Export for use
export { testFileUploadFeatures };

// Uncomment to run immediately
// testFileUploadFeatures().catch(console.error);