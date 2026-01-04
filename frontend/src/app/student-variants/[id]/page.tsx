'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Student, Homework, StudentHomeworkVariant } from '@/types';
import { studentsApi, homeworkApi, studentHomeworkVariantsApi } from '@/lib/api';
import { ArrowLeft, Save, RefreshCw, Hash, BookText, Users } from 'lucide-react';

export default function StudentVariantsPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.id as string);

  const [student, setStudent] = useState<Student | null>(null);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [variants, setVariants] = useState<StudentHomeworkVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{[key: number]: number}>({});

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentData, homeworkData, variantsData] = await Promise.all([
        studentsApi.getAll().then(students => students.find(s => s.id === studentId)),
        homeworkApi.getAll(),
        studentHomeworkVariantsApi.getByStudent(studentId),
      ]);
      
      if (!studentData) {
        setError('Студент не найден');
        return;
      }
      
      setStudent(studentData);
      setHomework(homeworkData);
      setVariants(variantsData);
      
      // Инициализируем форму данными
      const initialFormData: {[key: number]: number} = {};
      homeworkData.forEach(hw => {
        const existingVariant = variantsData.find(v => v.homework_id === hw.id);
        initialFormData[hw.id] = existingVariant ? existingVariant.variant_number : 1;
      });
      setFormData(initialFormData);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRandom = async () => {
    try {
      setSaving(true);
      const newVariants = await studentHomeworkVariantsApi.createBulkForStudent(studentId);
      
      // Обновляем список вариантов
      const updatedVariants = [...variants];
      newVariants.forEach(newVariant => {
        const existingIndex = updatedVariants.findIndex(v => v.homework_id === newVariant.homework_id);
        if (existingIndex >= 0) {
          updatedVariants[existingIndex] = newVariant;
        } else {
          updatedVariants.push(newVariant);
        }
      });
      
      setVariants(updatedVariants);
      
      // Обновляем форму
      const updatedFormData = { ...formData };
      newVariants.forEach(variant => {
        updatedFormData[variant.homework_id] = variant.variant_number;
      });
      setFormData(updatedFormData);
      
    } catch (err) {
      setError('Ошибка при генерации случайных вариантов');
      console.error('Error generating random variants:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Подготавливаем данные для отправки
      const variantsData = Object.entries(formData).map(([homeworkId, variantNumber]) => ({
        homework_id: parseInt(homeworkId),
        variant_number: variantNumber
      }));
      
      const updatedVariants = await studentHomeworkVariantsApi.updateBulkForStudent(studentId, variantsData);
      
      // Обновляем список вариантов
      setVariants(updatedVariants);
      
    } catch (err) {
      setError('Ошибка при сохранении вариантов');
      console.error('Error saving variants:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleVariantChange = (homeworkId: number, value: number) => {
    setFormData(prev => ({
      ...prev,
      [homeworkId]: value
    }));
  };

  const getVariantForHomework = (homeworkId: number) => {
    return variants.find(v => v.homework_id === homeworkId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-700 dark:text-gray-300">Загрузка...</span>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Ошибка
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-100">
                  {error || 'Студент не найден'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Заголовок */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Варианты домашних заданий
              </h1>
              <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{student.full_name}</span>
                </div>
                <span>•</span>
                <span>Группа: {student.group_number}</span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleGenerateRandom}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Случайные варианты
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Ошибка
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-100">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Таблица вариантов */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Домашние задания ({homework.length})
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Установите номера вариантов для каждого домашнего задания
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Домашнее задание
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Количество вариантов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Номер варианта
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {homework.map((hw) => {
                  const existingVariant = getVariantForHomework(hw.id);
                  const currentValue = formData[hw.id] || 1;
                  
                  return (
                    <tr key={hw.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center">
                          <BookText className="w-4 h-4 mr-2 text-gray-400" />
                          <div>
                            <div className="font-medium">№{hw.number}: {hw.short_description}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Срок: {new Date(hw.due_date).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {hw.variants_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            max={hw.variants_count}
                            value={currentValue}
                            onChange={(e) => handleVariantChange(hw.id, parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                          />
                          <span className="text-gray-500 dark:text-gray-400">из {hw.variants_count}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {existingVariant ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            <Hash className="w-3 h-3 mr-1" />
                            Назначен
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                            Не назначен
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Информация */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Информация
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-100">
                <ul className="list-disc list-inside space-y-1">
                  <li>Используйте кнопку "Случайные варианты" для автоматической генерации вариантов для всех заданий</li>
                  <li>Измените номера вариантов вручную, если нужно</li>
                  <li>Нажмите "Сохранить" для применения изменений</li>
                  <li>Номер варианта не может превышать количество вариантов в задании</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
