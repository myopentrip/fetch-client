// Comprehensive File Upload Examples for @myopentrip/fetch-client

import { 
  FetchClient,
  createFileUploadData,
  createProgressCallback,
  formatFileSize,
  formatUploadSpeed,
  formatTimeRemaining,
  validateFile,
  type FileUploadConfig,
  type UploadProgressEvent
} from '../src/index';

// ===========================================
// BASIC FILE UPLOAD EXAMPLES
// ===========================================

async function basicFileUploadExamples() {
  console.log('📁 Basic File Upload Examples');
  console.log('===============================\n');

  const client = new FetchClient({
    baseURL: 'https://your-api.com',
    debug: true,
  });

  // Example 1: Simple single file upload
  console.log('1️⃣ Simple Single File Upload');
  
  // Simulate getting a file from an input element
  // const fileInput = document.getElementById('file-input') as HTMLInputElement;
  // const file = fileInput.files?.[0];
  
  // For demo purposes, create a mock file
  const mockFile = new File(['Hello, World!'], 'example.txt', { type: 'text/plain' });

  try {
    const response = await client.uploadFile('/api/upload', {
      file: mockFile,
      fieldName: 'document',
      additionalFields: {
        description: 'Example file upload',
        category: 'documents'
      }
    });
    
    console.log('✅ File uploaded successfully:', response.data);
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }

  // Example 2: Multiple files upload
  console.log('\n2️⃣ Multiple Files Upload');
  
  const mockFiles = [
    new File(['File 1 content'], 'file1.txt', { type: 'text/plain' }),
    new File(['File 2 content'], 'file2.txt', { type: 'text/plain' }),
  ];

  try {
    const response = await client.uploadFiles('/api/upload-multiple', mockFiles, {
      fieldName: 'files[]',
      timeout: 30000, // 30 seconds for multiple files
    });
    
    console.log('✅ Multiple files uploaded:', response.data);
  } catch (error) {
    console.error('❌ Multiple upload failed:', error);
  }

  console.log('\n');
}

// ===========================================
// ADVANCED FILE UPLOAD WITH PROGRESS
// ===========================================

async function advancedFileUploadExamples() {
  console.log('🚀 Advanced File Upload with Progress');
  console.log('====================================\n');

  const client = new FetchClient({
    baseURL: 'https://your-api.com',
    debug: true,
  });

  // Example 3: File upload with progress tracking
  console.log('3️⃣ File Upload with Progress Tracking');

  const largeFile = new File(
    [new ArrayBuffer(1024 * 1024)], // 1MB mock file
    'large-file.bin',
    { type: 'application/octet-stream' }
  );

  const progressConfig: FileUploadConfig = {
    onProgress: (progress: UploadProgressEvent) => {
      console.log(`📊 Progress: ${progress.percentage}% ` +
                  `(${formatFileSize(progress.loaded)}/${formatFileSize(progress.total)})`);
      
      if (progress.speed) {
        console.log(`🚄 Speed: ${formatUploadSpeed(progress.speed)}`);
      }
      
      if (progress.estimatedTime) {
        console.log(`⏱️ Time remaining: ${formatTimeRemaining(progress.estimatedTime)}`);
      }
    },
    
    onUploadStart: () => {
      console.log('🎬 Upload started!');
    },
    
    onUploadComplete: () => {
      console.log('🎉 Upload completed!');
    },
    
    onUploadError: (error) => {
      console.error('💥 Upload error:', error.message);
    },
    
    timeout: 60000, // 1 minute timeout
  };

  try {
    const response = await client.uploadFile('/api/upload-large', {
      file: largeFile,
      fieldName: 'largeFile',
      additionalFields: {
        fileType: 'binary',
        checksum: 'abc123'
      }
    }, progressConfig);
    
    console.log('✅ Large file uploaded:', response.data);
  } catch (error) {
    console.error('❌ Large file upload failed:', error);
  }

  console.log('\n');
}

// ===========================================
// FILE UPLOAD WITH CANCELLATION
// ===========================================

async function fileUploadWithCancellation() {
  console.log('⏹️ File Upload with Cancellation');
  console.log('=================================\n');

  const client = new FetchClient({
    baseURL: 'https://your-api.com',
    debug: true,
  });

  // Example 4: Cancellable file upload
  console.log('4️⃣ Cancellable File Upload');

  const file = new File(['Cancellable content'], 'cancellable.txt', { type: 'text/plain' });
  const controller = new AbortController();

  // Cancel upload after 2 seconds (for demo)
  setTimeout(() => {
    console.log('⏹️ Cancelling upload...');
    controller.abort();
  }, 2000);

  try {
    const response = await client.uploadFile('/api/upload', {
      file,
      fieldName: 'cancelFile'
    }, {
      signal: controller.signal,
      onProgress: (progress) => {
        console.log(`Progress: ${progress.percentage}%`);
      },
      onUploadStart: () => {
        console.log('Upload started (will be cancelled in 2 seconds)');
      },
    });
    
    console.log('✅ Upload completed:', response.data);
  } catch (error) {
    if ((error as Error).message.includes('cancelled') || (error as Error).name === 'AbortError') {
      console.log('🛑 Upload successfully cancelled');
    } else {
      console.error('❌ Upload failed:', error);
    }
  }

  console.log('\n');
}

// ===========================================
// FORM DATA WITH FILES AND FIELDS
// ===========================================

async function complexFormDataUpload() {
  console.log('📋 Complex Form Data Upload');
  console.log('===========================\n');

  const client = new FetchClient({
    baseURL: 'https://your-api.com',
    debug: true,
  });

  // Example 5: Complex form with files and other data
  console.log('5️⃣ Complex Form Data Upload');

  const profileImage = new File(['Profile image data'], 'profile.jpg', { type: 'image/jpeg' });
  const resumeFile = new File(['Resume content'], 'resume.pdf', { type: 'application/pdf' });

  try {
    const response = await client.uploadFormData('/api/user-profile', {
      // Files
      profileImage,
      resume: resumeFile,
      
      // Other form fields
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      age: 30,
      isActive: true,
      
      // Array of files
      documents: [
        new File(['Doc 1'], 'doc1.txt', { type: 'text/plain' }),
        new File(['Doc 2'], 'doc2.txt', { type: 'text/plain' }),
      ]
    }, {
      onProgress: (progress) => {
        console.log(`Form upload progress: ${progress.percentage}%`);
      }
    });
    
    console.log('✅ Complex form uploaded:', response.data);
  } catch (error) {
    console.error('❌ Complex form upload failed:', error);
  }

  console.log('\n');
}

// ===========================================
// FILE VALIDATION EXAMPLES
// ===========================================

async function fileValidationExamples() {
  console.log('✅ File Validation Examples');
  console.log('===========================\n');

  // Example 6: File validation before upload
  console.log('6️⃣ File Validation Before Upload');

  const files = [
    new File(['Small text'], 'small.txt', { type: 'text/plain' }),
    new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.bin', { type: 'application/octet-stream' }), // 10MB
    new File(['Image data'], 'photo.jpg', { type: 'image/jpeg' }),
    new File(['Executable'], 'virus.exe', { type: 'application/x-msdownload' }),
  ];

  const validationRules = {
    maxSize: 5 * 1024 * 1024, // 5MB max
    allowedTypes: ['text/plain', 'image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions: ['txt', 'jpg', 'jpeg', 'png', 'pdf']
  };

  files.forEach((file, index) => {
    const validation = validateFile(file, validationRules);
    
    if (validation.valid) {
      console.log(`✅ File ${index + 1} (${file.name}): Valid`);
    } else {
      console.log(`❌ File ${index + 1} (${file.name}): ${validation.error}`);
    }
  });

  console.log('\n');
}

// ===========================================
// HELPER FUNCTIONS EXAMPLES
// ===========================================

async function helperFunctionExamples() {
  console.log('🛠️ Helper Functions Examples');
  console.log('============================\n');

  const client = new FetchClient({
    baseURL: 'https://your-api.com',
    debug: true,
  });

  // Example 7: Using helper functions
  console.log('7️⃣ Using Helper Functions');

  const file = new File(['Helper demo'], 'demo.txt', { type: 'text/plain' });

  // Create file upload data using helper
  const uploadData = createFileUploadData(file, {
    fieldName: 'demoFile',
    additionalFields: {
      source: 'helper-demo',
      timestamp: Date.now()
    },
    fileName: 'renamed-demo.txt'
  });

  // Create progress callback using helper
  const progressCallback = createProgressCallback(
    (percentage) => console.log(`📊 ${percentage}%`),
    (speed) => console.log(`🚄 ${formatUploadSpeed(speed)}`),
    (timeLeft) => console.log(`⏱️ ${formatTimeRemaining(timeLeft)} remaining`)
  );

  try {
    const response = await client.uploadFile('/api/helper-demo', uploadData, {
      onProgress: progressCallback,
      onUploadStart: () => console.log('🎬 Helper demo upload started'),
      onUploadComplete: () => console.log('🎉 Helper demo upload completed'),
    });
    
    console.log('✅ Helper demo upload successful:', response.data);
  } catch (error) {
    console.error('❌ Helper demo upload failed:', error);
  }

  console.log('\n');
}

// ===========================================
// REACT COMPONENT EXAMPLE
// ===========================================

// Example React component using the file upload
export const FileUploadComponent = () => {
  // This would be in a real React component
  const handleFileUpload = async (files: FileList) => {
    const client = new FetchClient({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      debug: process.env.NODE_ENV === 'development',
    });

    // Add auth interceptor
    client.addRequestInterceptor(async (config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      return config;
    });

    const file = files[0];
    
    // Validate file
    const validation = validateFile(file, {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf']
    });

    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      const response = await client.uploadFile('/api/upload', {
        file,
        fieldName: 'uploadedFile',
        additionalFields: {
          userId: 'current-user-id',
          uploadType: 'profile-document'
        }
      }, {
        onProgress: (progress) => {
          // Update progress bar in UI
          console.log(`Upload progress: ${progress.percentage}%`);
        },
        onUploadStart: () => {
          // Show loading state
          console.log('Upload started');
        },
        onUploadComplete: () => {
          // Hide loading state
          console.log('Upload completed');
        },
        onUploadError: (error) => {
          // Show error message
          console.error('Upload error:', error);
        }
      });

      console.log('File uploaded successfully:', response.data);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // Return JSX would go here in a real component
  return null;
};

// ===========================================
// MAIN DEMO FUNCTION
// ===========================================

export async function runFileUploadDemo() {
  console.log('🚀 File Upload Feature Demo\n');
  console.log('============================\n');

  try {
    await basicFileUploadExamples();
    await advancedFileUploadExamples();
    await fileUploadWithCancellation();
    await complexFormDataUpload();
    await fileValidationExamples();
    await helperFunctionExamples();
    
    console.log('🎉 All file upload demos completed successfully!');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Uncomment to run the demo
// runFileUploadDemo().catch(console.error);