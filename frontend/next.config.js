/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
  async rewrites() {
    // Используем захардкоженный URL из docker-compose.yml
    const backendUrl = 'http://frieren-backend:8000';
    console.log(`🚀 Frontend starting with BACKEND_URL: ${backendUrl}`);
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

// Логируем конфигурацию при загрузке
console.log('📋 Next.js Config loaded:');
console.log(`   BACKEND_URL: http://frieren-backend:8000 (hardcoded)`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

module.exports = nextConfig;
