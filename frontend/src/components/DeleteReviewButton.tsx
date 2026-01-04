'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { homeworkReviewApi } from '@/lib/api';

interface DeleteReviewButtonProps {
  reviewId: number;
  studentName?: string;
  homeworkNumber?: number;
  onDelete?: () => void;
  className?: string;
}

export default function DeleteReviewButton({ 
  reviewId, 
  studentName = "студента",
  homeworkNumber,
  onDelete,
  className = ""
}: DeleteReviewButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const result = await homeworkReviewApi.delete(reviewId);
      
      // Показываем уведомление об успешном удалении
      alert(`Работа на проверку успешно удалена!\nСтудент: ${result.deleted_review.student_name}\nДомашнее задание: №${result.deleted_review.homework_number}`);
      
      // Закрываем модальное окно
      setIsModalOpen(false);
      
      // Вызываем callback для обновления списка
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      setError('Ошибка при удалении работы на проверку. Попробуйте еще раз.');
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors ${className}`}
        title="Жесткое удаление работы на проверку"
      >
        <Trash2 className="w-3 h-3 mr-1.5" />
        Удалить
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Подтверждение удаления
                </h3>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Внимание! Это действие необратимо
                    </h4>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <p>Вы собираетесь <strong>навсегда удалить</strong> работу на проверку:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Запись из базы данных</li>
                        <li>Локальную копию проекта (если есть)</li>
                        <li>Все связанные данные</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Студент:</strong> {studentName}
                </p>
                {homeworkNumber && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Домашнее задание:</strong> №{homeworkNumber}
                  </p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>ID записи:</strong> {reviewId}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                disabled={isDeleting}
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить навсегда
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
