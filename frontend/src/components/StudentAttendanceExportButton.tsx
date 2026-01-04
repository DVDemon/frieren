'use client';

import { useState } from 'react';
import { Calendar, Loader2, Upload } from 'lucide-react';
import { exportApi } from '@/lib/api';

interface StudentAttendanceExportButtonProps {
  studentId: number;
  studentName?: string;
  className?: string;
}

export default function StudentAttendanceExportButton({ 
  studentId, 
  studentName = "студента",
  className = ""
}: StudentAttendanceExportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    if (!sheetId.trim()) {
      setError('Пожалуйста, введите ID таблицы');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportApi.exportStudentAttendanceToGoogleSheet(sheetId, studentId);
      setSuccess(`Посещаемость успешно экспортирована! ${result.action === 'updated' ? 'Обновлена' : 'Добавлена'} строка ${result.row_number}. Посещаемость: ${result.attended_lectures}/${result.total_lectures} (${result.attendance_percentage}%)`);
      setSheetId('');
      setTimeout(() => setIsModalOpen(false), 3000);
    } catch (err) {
      setError('Ошибка при экспорте посещаемости. Проверьте ID таблицы и попробуйте снова.');
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md transition-colors ${className}`}
      >
        <Upload className="w-3 h-3 mr-1.5" />
        Посещаемость
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Экспорт посещаемости в Google Sheet
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ID можно найти в URL таблицы: https://docs.google.com/spreadsheets/d/<strong>ID_ТАБЛИЦЫ</strong>/edit
              </p>
            </div>

            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Calendar className="w-5 h-5 text-purple-500" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200">
                    Что будет экспортировано
                  </h4>
                  <div className="mt-2 text-sm text-purple-700 dark:text-purple-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Основная информация о студенте</li>
                      <li>Данные о посещаемости всех лекций</li>
                      <li>Статистика посещаемости</li>
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
                onClick={handleExport}
                disabled={isLoading || !sheetId.trim()}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
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
