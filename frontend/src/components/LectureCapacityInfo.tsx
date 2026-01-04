'use client';

import { useState, useEffect } from 'react';
import { LectureCapacityInfo } from '@/types';
import { lecturesApi } from '@/lib/api';
import { Users, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface LectureCapacityInfoProps {
  lectureNumber: number;
  onCapacityChange?: (capacity: LectureCapacityInfo) => void;
}

export default function LectureCapacityInfoComponent({ 
  lectureNumber, 
  onCapacityChange 
}: LectureCapacityInfoProps) {
  const [capacityInfo, setCapacityInfo] = useState<LectureCapacityInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCapacityInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await lecturesApi.getCapacity(lectureNumber);
      setCapacityInfo(data);
      onCapacityChange?.(data);
    } catch (err) {
      setError('Ошибка при загрузке информации о вместимости');
      console.error('Error fetching capacity info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lectureNumber) {
      fetchCapacityInfo();
    }
  }, [lectureNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-600">Загрузка информации...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-3">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="ml-2 text-sm text-red-600">{error}</span>
        </div>
      </div>
    );
  }

  if (!capacityInfo) {
    return null;
  }

  const getStatusIcon = () => {
    if (capacityInfo.max_student === null || capacityInfo.max_student === undefined) {
      return <Users className="w-5 h-5 text-gray-400" />;
    }
    if (capacityInfo.is_full) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const getStatusText = () => {
    if (capacityInfo.max_student === null || capacityInfo.max_student === undefined) {
      return 'Без ограничений';
    }
    if (capacityInfo.is_full) {
      return 'Лекция заполнена';
    }
    return 'Есть свободные места';
  };

  const getStatusColor = () => {
    if (capacityInfo.max_student === null || capacityInfo.max_student === undefined) {
      return 'bg-gray-100 text-gray-800';
    }
    if (capacityInfo.is_full) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Вместимость лекции №{capacityInfo.lecture_number}
        </h3>
        {getStatusIcon()}
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {capacityInfo.lecture_topic}
        {capacityInfo.start_time && (
          <span className="ml-2 text-gray-500 dark:text-gray-500">
            (Начало: {capacityInfo.start_time})
          </span>
        )}
      </p>

      <div className="space-y-3">
        {/* Текущее количество студентов */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Текущее количество:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {capacityInfo.current_attendance} студентов
          </span>
        </div>

        {/* Максимальное количество студентов */}
        {capacityInfo.max_student !== null && capacityInfo.max_student !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Максимальное количество:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {capacityInfo.max_student} студентов
            </span>
          </div>
        )}

        {/* Свободные места */}
        {capacityInfo.remaining_slots !== null && capacityInfo.remaining_slots !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Свободные места:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {capacityInfo.remaining_slots} мест
            </span>
          </div>
        )}

        {/* Статус */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Статус:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Прогресс-бар для визуализации заполненности */}
      {capacityInfo.max_student !== null && capacityInfo.max_student !== undefined && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Заполненность</span>
            <span>{Math.round((capacityInfo.current_attendance / capacityInfo.max_student) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                capacityInfo.is_full 
                  ? 'bg-red-500' 
                  : capacityInfo.current_attendance / capacityInfo.max_student > 0.8
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ 
                width: `${Math.min((capacityInfo.current_attendance / capacityInfo.max_student) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Кнопка обновления */}
      <button
        onClick={fetchCapacityInfo}
        className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        Обновить информацию
      </button>
    </div>
  );
}
