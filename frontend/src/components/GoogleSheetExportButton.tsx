'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportApi } from '@/lib/api';

export default function GoogleSheetExportButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportApi.exportToGoogleSheet();
      setSuccess(`Данные успешно экспортированы! Экспортировано ${result.students_count} студентов, ${result.homeworks_count} домашних заданий, ${result.lectures_count} лекций и ${result.reviews_count} проверок.`);
      setTimeout(() => setIsModalOpen(false), 2000);
    } catch (err) {
      setError('Ошибка при экспорте данных. Проверьте настройки и попробуйте снова.');
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors"
        title="Экспорт всех данных в Google Sheet (студенты, лекции, оценки)"
      >
        <FileSpreadsheet className="w-3 h-3 mr-1.5" />
        Экспорт в Sheet
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Экспорт в Google Sheet
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Данные будут экспортированы в настроенную Google Sheet таблицу.
              </p>
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
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
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
