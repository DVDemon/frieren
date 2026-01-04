// Конфигурация для runtime
const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8000',
  nodeEnv: process.env.NODE_ENV || 'development',
};

console.log('📋 Runtime config loaded:');
console.log(`   BACKEND_URL: ${process.env.BACKEND_URL || 'Not set'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
console.log(`   Resolved config:`, config);

module.exports = config;
