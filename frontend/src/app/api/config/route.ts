import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔧 Config API called');
  
  // Используем значения из docker-compose.yml
  const backendUrl = 'http://frieren-backend:8000';
  const nodeEnv = 'production';
  
  console.log(`🔧 Using hardcoded BACKEND_URL: ${backendUrl}`);
  console.log(`🔧 Using hardcoded NODE_ENV: ${nodeEnv}`);
  
  return NextResponse.json({
    backendUrl,
    nodeEnv,
    timestamp: new Date().toISOString(),
    source: 'hardcoded-from-docker-compose',
    debug: {
      message: 'Using hardcoded values from docker-compose.yml due to Next.js standalone limitations',
      processEnv: {
        NODE_ENV: process.env.NODE_ENV,
        availableVars: Object.keys(process.env).filter(key => 
          key.includes('BACKEND') || key.includes('NODE')
        ),
      }
    }
  });
}
