'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2, Download } from 'lucide-react';
import { exportApi } from '@/lib/api';

export default function GoogleSheetImportButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleImport = async () => {
    if (!sheetId.trim()) {
      setError('Пожалуйста, введите ID таблицы');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportApi.importRatingsFromGoogleSheet(sheetId);
      setSuccess(`Данные успешно импортированы! Обработано ${result.imported_count} записей, обновлено ${result.updated_count}, создано ${result.created_count}.`);
      setSheetId('');
      setTimeout(() => setIsModalOpen(false), 3000);
    } catch (err) {
      setError('Ошибка при импорте данных. Проверьте ID таблицы и попробуйте снова.');
      console.error('Import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-md transition-colors"
        title="Импорт оценок из Google Sheet (лист 'Оценки')"
      >
        <Download className="w-3 h-3 mr-1.5" />
        Импорт оценок
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Импорт оценок из Google Sheet
            </h3>
            
            <div className="mb-4">
              <label htmlFor="sheetId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ID таблицы Google Sheet
              </label>
              <input
                type="text"
                id="sheetId"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="Введите ID таблицы..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ID можно найти в URL таблицы: https://docs.google.com/spreadsheets/d/<strong>ID_ТАБЛИЦЫ</strong>/edit
              </p>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Как работает импорт
                  </h4>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Импортирует данные из листа "Оценки"</li>
                      <li>Находит студента по Telegram аккаунту</li>
                      <li>Обновляет последнюю запись проверки или создает новую</li>
                      <li>Заполняет только непустые поля из таблицы</li>
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
                  setSheetId('');
                  setError(null);
                  setSuccess(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={handleImport}
                disabled={isLoading || !sheetId.trim()}
                className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Импорт...
                  </>
                ) : (
                  'Импортировать'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
