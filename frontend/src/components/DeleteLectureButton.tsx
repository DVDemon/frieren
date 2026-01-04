'use client';
import { useState, useCallback } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { lecturesApi } from '@/lib/api';

interface DeleteLectureButtonProps {
  lectureId: number;
  lectureNumber?: number;
  lectureTopic?: string;
  onDelete?: () => void;
  className?: string;
  disabled?: boolean;
}

export default function DeleteLectureButton({
  lectureId,
  lectureNumber,
  lectureTopic = "лекции",
  onDelete,
  className = "",
  disabled = false
}: DeleteLectureButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    // Защита от множественных вызовов
    if (isDeleting) {
      console.log('Delete already in progress, ignoring duplicate call');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      console.log(`Attempting to delete lecture with ID: ${lectureId} (type: ${typeof lectureId})`);
      
      // Сначала проверим, существует ли лекция
      try {
        const lecture = await lecturesApi.getById(lectureId);
        console.log('Lecture exists:', lecture);
      } catch (checkErr) {
        console.error('Lecture check failed:', checkErr);
        setError(`Лекция с ID ${lectureId} не найдена в базе данных`);
        return;
      }
      
      const result = await lecturesApi.delete(lectureId);
      console.log('Delete result:', result);
      alert(`Лекция успешно удалена!\nНомер: ${result.deleted_lecture.number}\nТема: ${result.deleted_lecture.topic}\nУдалено записей посещаемости: ${result.deleted_attendance_count}`);
      setIsModalOpen(false);
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Ошибка при удалении лекции: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsDeleting(false);
    }
  }, [lectureId, isDeleting, onDelete]);

  return (
    <>
      <button
        onClick={() => {
          if (!disabled && !isDeleting) {
            setIsModalOpen(true);
          }
        }}
        disabled={disabled || isDeleting}
        className={`inline-flex items-center px-3 py-1.5 text-white text-xs font-medium rounded-md transition-colors ${
          disabled || isDeleting 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-red-600 hover:bg-red-700'
        } ${className}`}
        title={disabled || isDeleting ? "Удаление в процессе..." : "Жесткое удаление лекции"}
      >
        <Trash2 className="w-3 h-3 mr-1.5" />
        {isDeleting ? 'Удаление...' : 'Удалить'}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Удаление лекции
                </h3>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Вы уверены, что хотите удалить эту лекцию? Это действие нельзя отменить.
              </p>
              
              <div className="bg-red-50 dark:bg-red-900 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Внимание!
                    </h4>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Лекция будет полностью удалена из базы данных</li>
                        <li>Все записи посещаемости для этой лекции также будут удалены</li>
                        <li>Это действие необратимо</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {lectureNumber && lectureTopic && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <strong>Лекция №{lectureNumber}:</strong> {lectureTopic}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
                <div className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Удаление...
                  </>
                ) : (
                  'Удалить лекцию'
                )}
              </button>
              <button
                onClick={() => {
                  if (!isDeleting) {
                    setIsModalOpen(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
