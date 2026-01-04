'use client';

import { useEffect, useState } from 'react';

export default function BackendInfo() {
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        console.log('🔗 BackendInfo: Fetching config from API...');
        
        // Получаем конфигурацию через API endpoint
        const response = await fetch('/api/config');
        const config = await response.json();
        
        console.log('🔗 BackendInfo: Config received:', config);
        setBackendUrl(config.backendUrl);
        setConfigLoaded(true);
        
      } catch (error) {
        console.error('Error fetching config:', error);
        setBackendUrl('Error loading config');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Показываем только в development режиме
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-100 border border-blue-300 rounded-lg p-3 text-sm text-blue-800 shadow-lg z-50">
      <div className="font-semibold mb-1">🔗 Backend Info</div>
      <div>URL: {backendUrl}</div>
      <div>Env: {process.env.NODE_ENV}</div>
      <div>Config: {configLoaded ? 'Loaded' : 'Loading...'}</div>
      <div>Loading: {loading ? 'Yes' : 'No'}</div>
    </div>
  );
}
