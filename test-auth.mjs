// Test API key authentication
import mcpHandler from './netlify/functions/mcp.mjs';

// Set MCP_API_KEY for this test
process.env.MCP_API_KEY = 'test-secret-key-12345';

console.log('Test 1: Valid API key');
const mockHeaders = new Map([
  ['Authorization', 'Bearer test-secret-key-12345'],
  ['Content-Type', 'application/json']
]);

const validRequest = {
  method: 'POST',
  headers: {
    get: (key) => mockHeaders.get(key),
    entries: () => mockHeaders.entries()
  },
  json: async () => ({ 
    jsonrpc: '2.0', 
    method: 'tools/list', 
    id: 1, 
    params: {} 
  })
};

const validResponse = await mcpHandler(validRequest);
const validData = await validResponse.json();
console.log('  Status:', validResponse.status);
console.log('  Response preview:', JSON.stringify(validData).slice(0, 200));

if (validResponse.status === 401) {
  console.error('❌ Valid key was rejected');
  process.exit(1);
}
console.log('  ✅ Valid key accepted');

console.log('\nTest 2: Invalid API key');
const invalidHeaders = new Map([
  ['Authorization', 'Bearer wrong-key'],
  ['Content-Type', 'application/json']
]);

const invalidRequest = {
  method: 'POST',
  headers: {
    get: (key) => invalidHeaders.get(key),
    entries: () => invalidHeaders.entries()
  },
  json: async () => ({ jsonrpc: '2.0', method: 'tools/list', id: 1, params: {} })
};

const invalidResponse = await mcpHandler(invalidRequest);
const errorData = await invalidResponse.json();
console.log('  Status:', invalidResponse.status);

if (invalidResponse.status !== 401) {
  console.error('❌ Expected 401, got', invalidResponse.status);
  console.error('  Response:', JSON.stringify(errorData));
  process.exit(1);
}
if (errorData.error?.code !== -32000) {
  console.error('❌ Expected error code -32000, got', errorData.error?.code);
  process.exit(1);
}
console.log('  ✅ Invalid key rejected');

console.log('\n✅ All authentication tests passed!');
