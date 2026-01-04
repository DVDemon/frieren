'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportApi } from '@/lib/api';

interface ExportButtonProps {
  className?: string;
}

export default function ExportButton({ className = '' }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Получаем данные с сервера
      const data = await exportApi.getAllData();
      
      // Создаем JSON файл
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Генерируем имя файла с текущей датой
      const now = new Date();
      const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      link.download = `frieren-export-${dateString}-${timeString}.json`;
      
      // Скачиваем файл
      document.body.appendChild(link);
      link.click();
      
      // Очищаем
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Ошибка при экспорте:', error);
      alert('Ошибка при экспорте данных. Попробуйте еще раз.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Экспорт всех данных в JSON файл"
    >
      {isExporting ? (
        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
      ) : (
        <Download className="w-3 h-3 mr-1.5" />
      )}
      {isExporting ? 'Экспорт...' : 'Экспорт JSON'}
    </button>
  );
}
