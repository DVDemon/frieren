'use client';

import { useState, useEffect } from 'react';
import { Homework, HomeworkReview, Student } from '@/types';
import { homeworkApi, homeworkReviewApi, studentsApi } from '@/lib/api';
import { Loader2, Search, BookOpen, CheckCircle, Clock, FileText } from 'lucide-react';

export default function HomeworkStatsPage() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [homeworkReviews, setHomeworkReviews] = useState<HomeworkReview[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [homeworkData, reviewsData, studentsData] = await Promise.all([
        homeworkApi.getAll(),
        homeworkReviewApi.getAll(),
        studentsApi.getAll(),
      ]);
      setHomework(homeworkData);
      setHomeworkReviews(reviewsData);
      setStudents(studentsData);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Статистика по домашним заданиям
  const homeworkStats = homework
    .sort((a, b) => a.number - b.number) // Сортировка по номеру задания по возрастанию
    .map(hw => {
      const reviewsForHomework = homeworkReviews.filter(review => review.number === hw.number);
      const submitted = reviewsForHomework.length; // Всего отправлено работ
      const reviewed = reviewsForHomework.filter(review => review.result && review.result > 0).length; // Проверенных работ
      const pending = submitted - reviewed; // Ожидающих проверки
      const percentage = submitted > 0 ? Math.round((reviewed / submitted) * 100) : 0;

      return {
        homework: hw,
        submitted,
        reviewed,
        pending,
        percentage,
      };
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-gray-700 dark:text-gray-300">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Статистика успеваемости
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Аналитика успеваемости студентов по домашним заданиям
          </p>
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

        {/* Успеваемость по домашним заданиям */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Успеваемость по домашним заданиям
          </h2>
          <div className="space-y-4">
            {homeworkStats.map(({ homework, submitted, reviewed, pending, percentage }) => (
              <div key={homework.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Задание {homework.number}: {homework.short_description}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {percentage}% проверено
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>Сдано работ: {submitted}</span>
                  <span>Проверено: {reviewed}</span>
                  <span>Ожидает проверки: {pending}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Срок сдачи: {new Date(homework.due_date).toLocaleDateString('ru-RU')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Детальная таблица */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Детальная статистика успеваемости
            </h2>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Поиск по имени студента..."
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Студент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Группа
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Всего заданий
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Отправлено работ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Проверено работ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Процент
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {students
                  .filter(student => !student.is_deleted)
                  .filter(student => 
                    studentFilter === '' || 
                    student.full_name.toLowerCase().includes(studentFilter.toLowerCase())
                  )
                  .sort((a, b) => a.full_name.localeCompare(b.full_name)) // Сортировка по имени студентов
                  .map((student) => {
                    const studentReviews = homeworkReviews.filter(review => review.student.id === student.id);
                    const totalHomework = homework.length; // Максимальное количество заданий в системе
                    const submitted = studentReviews.length; // Отправлено работ на проверку
                    const reviewed = studentReviews.filter(review => review.result && review.result > 0).length; // Проверенных работ
                    const percentage = totalHomework > 0 ? Math.round((reviewed / totalHomework) * 100) : 0;

                    return (
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {student.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {student.group_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {totalHomework}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                          {submitted}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                          {reviewed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          <span className={`font-medium ${percentage >= 80 ? 'text-green-600 dark:text-green-400' : percentage >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}




