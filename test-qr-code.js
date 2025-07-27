import fetch from 'node-fetch';

// Test QR Code API endpoints
const BASE_URL = 'http://localhost:5010';

// Mock authentication token (you'll need to replace this with a real token)
const AUTH_TOKEN = 'your-jwt-token-here';

// Test shop ID (you'll need to replace this with a real shop ID)
const SHOP_ID = 'your-shop-id-here';

async function testQRCodeGeneration() {
    try {
        console.log('🧪 Testing QR Code generation...');
        
        const response = await fetch(`${BASE_URL}/shop/${SHOP_ID}/qr-code/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log('✅ QR Code generation response:', data);
        
        if (data.status === 'success') {
            console.log('🎯 QR Code URL:', data.data.qrCodeUrl);
            console.log('📱 QR Code Data (first 100 chars):', data.data.qrCode.substring(0, 100) + '...');
        }
        
        return data;
    } catch (error) {
        console.error('❌ Error testing QR Code generation:', error);
    }
}

async function testQRCodeRetrieval() {
    try {
        console.log('🧪 Testing QR Code retrieval...');
        
        const response = await fetch(`${BASE_URL}/shop/${SHOP_ID}/qr-code`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log('✅ QR Code retrieval response:', data);
        
        return data;
    } catch (error) {
        console.error('❌ Error testing QR Code retrieval:', error);
    }
}

async function runTests() {
    console.log('🚀 Starting QR Code API tests...\n');
    
    // Test generation
    await testQRCodeGeneration();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test retrieval
    await testQRCodeRetrieval();
    
    console.log('\n✅ QR Code API tests completed!');
}

// Instructions for manual testing
console.log(`
📋 Manual Testing Instructions:

1. First, get a valid JWT token by logging in as a shop owner
2. Get a valid shop ID from your database or API
3. Update the AUTH_TOKEN and SHOP_ID variables above
4. Run this script: node test-qr-code.js

🔧 Alternative: Test via browser/Postman:
- POST ${BASE_URL}/shop/{shopId}/qr-code/generate
- GET ${BASE_URL}/shop/{shopId}/qr-code
- Include Authorization header: Bearer {your-jwt-token}

🎯 Expected QR Code URL format: http://localhost:5174/shops/{shopId}
`);

// Uncomment the line below to run tests (after setting AUTH_TOKEN and SHOP_ID)
// runTests();
