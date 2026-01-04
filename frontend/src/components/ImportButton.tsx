'use client';

import { useState } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function ImportButton() {
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setMessage({ type: 'error', text: 'Пожалуйста, выберите JSON файл' });
      return;
    }

    setIsImporting(true);
    setMessage(null);

    try {
      const fileContent = await file.text();
      const data = JSON.parse(fileContent);

      // Проверяем структуру данных
      if (!data.students || !data.teachers || !data.homework || !data.homework_reviews || !data.lectures || !data.attendance || !data.teacher_groups || !data.student_homework_variants) {
        setMessage({ type: 'error', text: 'Неверный формат файла. Файл должен содержать все необходимые данные для импорта' });
        return;
      }

      // Отправляем данные на сервер с таймаутом 15 минут
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 минут

      try {
        const response = await fetch('/api/import/all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: fileContent,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Ошибка при импорте данных');
        }

        const result = await response.json();
        setMessage({ 
          type: 'success', 
          text: `Импорт завершен успешно! Импортировано: ${result.summary.total_records} записей` 
        });

        // Перезагружаем страницу для отображения новых данных
        setTimeout(() => {
          window.location.reload();
        }, 2000);

      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          setMessage({ 
            type: 'error', 
            text: 'Импорт прерван по таймауту (15 минут). Попробуйте еще раз.' 
          });
        } else {
          throw error; // Перебрасываем ошибку во внешний catch
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Ошибка при импорте данных' 
      });
    } finally {
      setIsImporting(false);
      // Очищаем input
      event.target.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept=".json"
        onChange={handleImport}
        disabled={isImporting}
        className="hidden"
        id="import-file-input"
      />
      
      <label
        htmlFor="import-file-input"
        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
          isImporting
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }`}
        title="Импорт данных из JSON файла"
      >
        {isImporting ? (
          <>
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            Импорт...
          </>
        ) : (
          <>
            <Upload className="w-3 h-3 mr-1.5" />
            Импорт JSON
          </>
        )}
      </label>

      {message && (
        <div className={`mt-2 p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
            )}
            <span className={`text-sm ${
              message.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {message.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
