# Recent Improvements ✨

## v2.5.0

## 🐛 Bug Fixes:
- ✅ Fixed critical typo in interceptors filename and export
- ✅ Fixed error interceptors not integrating with retry system (now fully functional!)
- ✅ Fixed TypeScript type casting issues in response interceptors
- ✅ Improved auth interceptor cleanup to prevent memory leaks

## 🚀 New Features:
- ✅ **SSL/Certificate Error Handling** - Automatic transformation of cryptic SSL errors into user-friendly messages
- ✅ **Enhanced Error Interceptors** - Now work with retry system and provide rich error context
- ✅ **Comprehensive Test Suite** - Full test coverage for interceptors and SSL error handling
- ✅ **Real-world Examples** - Production-ready code examples and patterns
- ✅ **Development Tools** - Easy-to-run npm scripts for testing and examples

## 💡 SSL Error Transformation Examples:
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE` → "SSL certificate verification failed. The server's certificate could not be verified."
- `DEPTH_ZERO_SELF_SIGNED_CERT` → "The server is using a self-signed certificate which cannot be verified."
- `CERT_EXPIRED` → "The server's SSL certificate has expired."

The package now provides enterprise-grade error handling while maintaining simplicity for basic use cases.
