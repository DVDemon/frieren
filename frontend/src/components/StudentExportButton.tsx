'use client';

import { useState } from 'react';
import { User, Loader2, Upload } from 'lucide-react';
import { exportApi } from '@/lib/api';

interface StudentExportButtonProps {
  studentId: number;
  studentName?: string;
  className?: string;
}

export default function StudentExportButton({ 
  studentId, 
  studentName = "студента",
  className = ""
}: StudentExportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportApi.exportStudentToGoogleSheet(studentId);
      setSuccess(`Студент успешно экспортирован! ${result.action === 'updated' ? 'Обновлена' : 'Добавлена'} строка ${result.row_number}.`);
      setTimeout(() => setIsModalOpen(false), 3000);
    } catch (err) {
      setError('Ошибка при экспорте студента. Проверьте настройки и попробуйте снова.');
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors ${className}`}
      >
        <Upload className="w-3 h-3 mr-1.5" />
        Экспорт
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Экспорт студента в Google Sheet
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Данные будут экспортированы в настроенную Google Sheet таблицу.
              </p>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <User className="w-5 h-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Что будет экспортировано
                  </h4>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Основная информация о студенте</li>
                      <li>Преподаватель группы</li>
                      <li>Варианты домашних заданий</li>
                      <li>Поиск по Telegram аккаунту</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-100">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md">
                <p className="text-sm text-green-700 dark:text-green-100">{success}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null);
                  setSuccess(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={handleExport}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Экспорт...
                  </>
                ) : (
                  'Экспортировать'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
