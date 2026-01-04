'use client';

import { useState, useEffect } from 'react';
import { HomeworkReview } from '@/types';
import { homeworkReviewApi } from '@/lib/api';
import { Search, Loader2, Calendar, ExternalLink, Edit, Filter, ChevronUp, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';
import DeleteReviewButton from '@/components/DeleteReviewButton';

export default function PendingReviewsPage() {
  const [pendingReviews, setPendingReviews] = useState<HomeworkReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    student: '',
    group: '',
    homework: '',
    teacher: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [teacherGroups, setTeacherGroups] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await homeworkReviewApi.getPending();
      setPendingReviews(data);
    } catch (err) {
      setError('Ошибка при загрузке работ на проверку');
      console.error('Error fetching pending reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherData = async () => {
    try {
      // Создаем AbortController для таймаута 15 минут
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 минут

      try {
        const [teacherGroupsData, teachersData] = await Promise.all([
          fetch('/api/teachers/groups', { signal: controller.signal }).then(res => res.json()),
          fetch('/api/teachers/', { signal: controller.signal }).then(res => res.json())
        ]);
        
        clearTimeout(timeoutId);
        setTeacherGroups(teacherGroupsData);
        setTeachers(teachersData);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('Teacher data fetch timeout after 15 minutes');
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('Error fetching teacher data:', err);
    }
  };

  useEffect(() => {
    fetchPendingReviews();
    fetchTeacherData();
  }, []);

  // Функция для получения имени преподавателя по группе
  const getTeacherNameByGroup = (groupNumber: string) => {
    const teacherGroup = teacherGroups.find(tg => tg.group_number === groupNumber);
    if (teacherGroup) {
      const teacher = teachers.find(t => t.id === teacherGroup.teacher_id);
      return teacher ? teacher.full_name : null;
    }
    return null;
  };

  // Функция сортировки
  const sortData = (data: HomeworkReview[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'student':
          aValue = a.student?.full_name || '';
          bValue = b.student?.full_name || '';
          break;
        case 'group':
          aValue = a.student?.group_number || '';
          bValue = b.student?.group_number || '';
          break;
        case 'homework':
          aValue = a.number || 0;
          bValue = b.number || 0;
          break;
        case 'sendDate':
          aValue = new Date(a.send_date);
          bValue = new Date(b.send_date);
          break;
        case 'teacher':
          aValue = getTeacherNameByGroup(a.student?.group_number || '') || '';
          bValue = getTeacherNameByGroup(b.student?.group_number || '') || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Функция фильтрации
  const filterData = (data: HomeworkReview[]) => {
    return data.filter(review => {
      // Глобальный поиск
      const searchMatch = !searchTerm || 
        (review.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (review.student?.group_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (review.number?.toString().includes(searchTerm) || false);

      // Фильтры по полям
      const studentMatch = !filters.student || 
        (review.student?.full_name?.toLowerCase().includes(filters.student.toLowerCase()) || false);
      
      const groupMatch = !filters.group || 
        (review.student?.group_number?.toLowerCase().includes(filters.group.toLowerCase()) || false);
      
      const homeworkMatch = !filters.homework || 
        (review.number?.toString().includes(filters.homework) || false);
      
      const teacherMatch = !filters.teacher || 
        (getTeacherNameByGroup(review.student?.group_number || '')?.toLowerCase().includes(filters.teacher.toLowerCase()) || false);

      return searchMatch && studentMatch && groupMatch && homeworkMatch && teacherMatch;
    });
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const clearFilters = () => {
    setFilters({
      student: '',
      group: '',
      homework: '',
      teacher: ''
    });
    setSearchTerm('');
    setSortConfig(null);
  };

  const filteredAndSortedReviews = sortData(filterData(pendingReviews));

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
            Работы на проверку
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Список домашних заданий, ожидающих проверки преподавателем
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

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Ожидают проверки ({filteredAndSortedReviews.length})
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                  showFilters 
                    ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900 dark:text-blue-300' 
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Фильтры
              </button>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <X className="w-4 h-4 mr-2" />
                Очистить
              </button>
            </div>
          </div>

          {/* Панель фильтров */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Студент
                  </label>
                  <input
                    type="text"
                    placeholder="Поиск по имени студента..."
                    value={filters.student}
                    onChange={(e) => setFilters(prev => ({ ...prev, student: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Группа
                  </label>
                  <input
                    type="text"
                    placeholder="Поиск по группе..."
                    value={filters.group}
                    onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Номер задания
                  </label>
                  <input
                    type="text"
                    placeholder="Поиск по номеру..."
                    value={filters.homework}
                    onChange={(e) => setFilters(prev => ({ ...prev, homework: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Преподаватель
                  </label>
                  <input
                    type="text"
                    placeholder="Поиск по преподавателю..."
                    value={filters.teacher}
                    onChange={(e) => setFilters(prev => ({ ...prev, teacher: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по студенту, группе или номеру задания..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center">
                      ID
                      {sortConfig?.key === 'id' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('student')}
                  >
                    <div className="flex items-center">
                      Студент
                      {sortConfig?.key === 'student' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('group')}
                  >
                    <div className="flex items-center">
                      Группа
                      {sortConfig?.key === 'group' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('teacher')}
                  >
                    <div className="flex items-center">
                      Преподаватель
                      {sortConfig?.key === 'teacher' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('homework')}
                  >
                    <div className="flex items-center">
                      Задание
                      {sortConfig?.key === 'homework' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('sendDate')}
                  >
                    <div className="flex items-center">
                      Дата отправки
                      {sortConfig?.key === 'sendDate' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ссылка
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAndSortedReviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {review.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {review.student?.full_name || 'Неизвестно'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {review.student?.group_number || 'Неизвестно'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {getTeacherNameByGroup(review.student?.group_number || '') || (
                        <span className="text-gray-400 italic">Не назначен</span>
                      )}
                    </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                       <div>
                         <div>№{review.number || 'Неизвестно'}</div>
                         {review.variant_number && (
                           <div className="text-xs text-blue-600 dark:text-blue-400">
                             Вариант {review.variant_number}
                           </div>
                         )}
                       </div>
                     </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {new Date(review.send_date).toLocaleDateString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {review.url && (
                        <a
                          href={review.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex items-center"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Открыть
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex space-x-2">
                        <Link
                          href={`/homework-review?edit=${review.id}`}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Проверить
                        </Link>
                        <DeleteReviewButton 
                          reviewId={review.id}
                          studentName={review.student?.full_name}
                          homeworkNumber={review.number}
                          onDelete={fetchPendingReviews}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedReviews.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-300">
              {searchTerm || Object.values(filters).some(f => f) ? (
                <div>
                  <p className="text-lg font-medium mb-2">Работы не найдены</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Попробуйте изменить критерии поиска или фильтры
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">Нет работ на проверку</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Все домашние задания уже проверены
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
