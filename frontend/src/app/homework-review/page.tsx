'use client';

import { useState, useEffect } from 'react';
import { HomeworkReview, HomeworkReviewCreate, HomeworkReviewUpdate, Student } from '@/types';
import { homeworkReviewApi, exportApi } from '@/lib/api';
import { Plus, Edit, Search, Loader2, Download, Brain, Star, Calendar, ExternalLink, RefreshCw, Filter, ChevronUp, ChevronDown, X, Upload } from 'lucide-react';
import StudentSearch from '@/components/StudentSearch';
import DeleteReviewButton from '@/components/DeleteReviewButton';
import { useSearchParams } from 'next/navigation';

export default function HomeworkReviewPage() {
  const searchParams = useSearchParams();
  const [reviews, setReviews] = useState<HomeworkReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<HomeworkReview | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    student: '',
    group: '',
    homework: '',
    variant: '',
    reviewStatus: '',
    aiStatus: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await homeworkReviewApi.getAll();
      setReviews(data);
    } catch (err) {
      setError('Ошибка при загрузке проверок');
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Обработка параметра edit из URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && !loading) {
      if (reviews.length > 0) {
        const reviewToEdit = reviews.find(review => review.id === parseInt(editId));
        if (reviewToEdit) {
          setEditingReview(reviewToEdit);
        } else {
          // Если проверка не найдена в списке, показываем ошибку
          setError(`Проверка с ID ${editId} не найдена`);
        }
      } else {
        // Если данные еще не загружены, но есть параметр edit, ждем загрузки
        // Логика будет выполнена в следующем useEffect после загрузки данных
      }
    }
  }, [searchParams, loading, reviews]);

  const handleCreateReview = async (reviewData: HomeworkReviewCreate) => {
    try {
      const newReview = await homeworkReviewApi.create(reviewData);
      setReviews(prev => [...prev, newReview]);
      setShowForm(false);
    } catch (err) {
      setError('Ошибка при создании проверки');
      console.error('Error creating review:', err);
    }
  };

  const handleUpdateReview = async (reviewData: HomeworkReviewUpdate) => {
    if (!editingReview) return;
    
    try {
      const updatedReview = await homeworkReviewApi.update(editingReview.id, reviewData);
      setReviews(prev => prev.map(r => r.id === editingReview.id ? updatedReview : r));
      setEditingReview(null);
      // Очищаем URL параметры после успешного сохранения
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (err) {
      setError('Ошибка при обновлении проверки');
      console.error('Error updating review:', err);
    }
  };

  const handleEditReview = (review: HomeworkReview) => {
    setEditingReview(review);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingReview(null);
    // Очищаем URL параметры при закрытии формы
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleDownloadProject = async (id: number, url: string) => {
    try {
      const updatedReview = await homeworkReviewApi.downloadProject(id, url);
      setReviews(prev => prev.map(r => r.id === id ? updatedReview : r));
    } catch (err) {
      setError('Ошибка при скачивании проекта');
      console.error('Error downloading project:', err);
    }
  };

  const [checkingAI, setCheckingAI] = useState<number | null>(null);

  const handleCheckAI = async (id: number) => {
    try {
      setCheckingAI(id);
      setError(''); // Очищаем предыдущие ошибки
      
      const updatedReview = await homeworkReviewApi.checkAI(id);
      setReviews(prev => prev.map(r => r.id === id ? updatedReview : r));
    } catch (err) {
      setError('Ошибка при проверке AI. Убедитесь, что проект был скачан.');
      console.error('Error checking AI:', err);
    } finally {
      setCheckingAI(null);
    }
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
        case 'variant':
          aValue = a.variant_number || 0;
          bValue = b.variant_number || 0;
          break;
        case 'sendDate':
          aValue = new Date(a.send_date);
          bValue = new Date(b.send_date);
          break;
        case 'reviewDate':
          aValue = a.review_date ? new Date(a.review_date) : new Date(0);
          bValue = b.review_date ? new Date(b.review_date) : new Date(0);
          break;
        case 'result':
          aValue = a.result || 0;
          bValue = b.result || 0;
          break;
        case 'aiPercentage':
          aValue = a.ai_percentage || 0;
          bValue = b.ai_percentage || 0;
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
        (review.number?.toString().includes(searchTerm) || false) ||
        (review.variant_number?.toString().includes(searchTerm) || false);

      // Фильтры по полям
      const studentMatch = !filters.student || 
        (review.student?.full_name?.toLowerCase().includes(filters.student.toLowerCase()) || false);
      
      const groupMatch = !filters.group || 
        (review.student?.group_number?.toLowerCase().includes(filters.group.toLowerCase()) || false);
      
      const homeworkMatch = !filters.homework || 
        (review.number?.toString().includes(filters.homework) || false);
      
      const variantMatch = !filters.variant || 
        (review.variant_number?.toString().includes(filters.variant) || false);
      
      const reviewStatusMatch = !filters.reviewStatus || 
        (filters.reviewStatus === 'reviewed' && review.review_date) ||
        (filters.reviewStatus === 'pending' && !review.review_date);
      
      const aiStatusMatch = !filters.aiStatus || 
        (filters.aiStatus === 'checked' && review.ai_percentage !== null) ||
        (filters.aiStatus === 'not_checked' && review.ai_percentage === null);

      return searchMatch && studentMatch && groupMatch && homeworkMatch && variantMatch && reviewStatusMatch && aiStatusMatch;
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
      variant: '',
      reviewStatus: '',
      aiStatus: ''
    });
    setSearchTerm('');
    setSortConfig(null);
  };

  const filteredAndSortedReviews = sortData(filterData(reviews));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-gray-700 dark:text-gray-300">
            {searchParams.get('edit') ? 'Загрузка проверки...' : 'Загрузка...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Проверка домашних заданий
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Управление проверкой и оценкой домашних заданий студентов
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
              Список проверок ({filteredAndSortedReviews.length})
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
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить проверку
              </button>
            </div>
          </div>

          {/* Панель фильтров */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    Номер варианта
                  </label>
                  <input
                    type="text"
                    placeholder="Поиск по варианту..."
                    value={filters.variant}
                    onChange={(e) => setFilters(prev => ({ ...prev, variant: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Статус проверки
                  </label>
                  <select
                    value={filters.reviewStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, reviewStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Все</option>
                    <option value="reviewed">Проверено</option>
                    <option value="pending">Ожидает проверки</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Статус AI проверки
                  </label>
                  <select
                    value={filters.aiStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, aiStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Все</option>
                    <option value="checked">Проверено AI</option>
                    <option value="not_checked">Не проверено AI</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по студенту, группе, номеру задания или варианту..."
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
                    onClick={() => handleSort('variant')}
                  >
                    <div className="flex items-center">
                      Вариант
                      {sortConfig?.key === 'variant' && (
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
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('reviewDate')}
                  >
                    <div className="flex items-center">
                      Дата проверки
                      {sortConfig?.key === 'reviewDate' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('result')}
                  >
                    <div className="flex items-center">
                      Оценка
                      {sortConfig?.key === 'result' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('aiPercentage')}
                  >
                    <div className="flex items-center">
                      AI %
                      {sortConfig?.key === 'aiPercentage' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
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
                       №{review.number || 'Неизвестно'}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                       {review.variant_number ? (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                           Вариант {review.variant_number}
                         </span>
                       ) : (
                         <span className="text-gray-400 dark:text-gray-500">Не назначен</span>
                       )}
                     </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {new Date(review.send_date).toLocaleDateString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {review.review_date ? (
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                          {new Date(review.review_date).toLocaleDateString('ru-RU')}
                        </div>
                      ) : (
                        <span className="text-gray-400">Не проверено</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {review.result ? (
                        <div className="flex items-center">
                          <Star className="w-4 h-4 mr-1 text-yellow-500" />
                          {review.result}
                        </div>
                      ) : (
                        <span className="text-gray-400">Не оценено</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {review.ai_percentage !== null ? (
                        <div className="flex items-center">
                          <Brain className="w-4 h-4 mr-1 text-purple-500" />
                          {review.ai_percentage}%
                        </div>
                      ) : (
                        <span className="text-gray-400">Не проверено</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditReview(review)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {review.url && !review.local_directory && (
                          <button
                            onClick={() => handleDownloadProject(review.id, review.url)}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                            title="Скачать проект для проверки AI"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {review.local_directory && (
                          <button
                            onClick={() => handleCheckAI(review.id)}
                            disabled={checkingAI === review.id}
                            className={`${
                              checkingAI === review.id 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : 'text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300'
                            }`}
                            title={checkingAI === review.id ? 'Проверка AI...' : 'Проверить AI'}
                          >
                            {checkingAI === review.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                            ) : (
                              <Brain className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {review.url && review.local_directory && (
                          <button
                            onClick={() => handleDownloadProject(review.id, review.url)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            title="Обновить проект"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {review.url && (
                          <a
                            href={review.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                            title="Открыть ссылку"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <DeleteReviewButton 
                          reviewId={review.id}
                          studentName={review.student?.full_name}
                          homeworkNumber={review.number}
                          onDelete={fetchReviews}
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
        <p className="text-lg font-medium mb-2">Проверки не найдены</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Попробуйте изменить критерии поиска или фильтры
        </p>
      </div>
    ) : (
      <div>
        <p className="text-lg font-medium mb-2">Нет проверок домашних заданий</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Добавьте первую проверку, нажав кнопку "Добавить проверку"
        </p>
      </div>
    )}
  </div>
)}
        </div>
      </div>

      {/* Форма добавления/редактирования проверки */}
      {(showForm || editingReview) && (
        <ReviewForm
          review={editingReview}
          onSubmit={async (data: HomeworkReviewCreate | HomeworkReviewUpdate) => {
            if (editingReview) {
              await handleUpdateReview(data as HomeworkReviewUpdate);
            } else {
              await handleCreateReview(data as HomeworkReviewCreate);
            }
          }}
          onCancel={handleCancelForm}
          isEditing={!!editingReview}
          onRefresh={fetchReviews}
        />
      )}
    </div>
  );
}

// Компонент формы проверки
interface ReviewFormProps {
  review?: HomeworkReview | null;
  onSubmit: (data: HomeworkReviewCreate | HomeworkReviewUpdate) => void;
  onCancel: () => void;
  isEditing: boolean;
  onRefresh?: () => void; // Callback для перезагрузки данных
}

function ReviewForm({ review, onSubmit, onCancel, isEditing, onRefresh }: ReviewFormProps) {
  const [formData, setFormData] = useState<HomeworkReviewCreate>({
    student_id: 0,
    number: 1,
    send_date: new Date().toISOString().split('T')[0],
    review_date: undefined,
    url: '',
    result: 0,
    comments: '',
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportingToSheet, setIsExportingToSheet] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Функция для получения актуального значения AI
  const getCurrentAIPercentage = () => {
    return formData.ai_percentage !== null && formData.ai_percentage !== undefined 
      ? formData.ai_percentage 
      : review?.ai_percentage;
  };

  useEffect(() => {
    if (review) {
      setFormData({
        student_id: review.student?.id || 0,
        number: review.number || 1,
        send_date: review.send_date,
        review_date: review.review_date || undefined,
        url: review.url,
        result: review.result || 0,
        comments: review.comments || '',
      });
      setSelectedStudent(review.student || null);
    }
  }, [review]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudent) {
      alert('Пожалуйста, выберите студента');
      return;
    }
    
    const submitData = {
      ...formData,
      student_id: selectedStudent.id
    };
    
    onSubmit(submitData);
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setFormData(prev => ({
      ...prev,
      student_id: student.id
    }));
  };

  const handleCheckAI = async () => {
    if (!review?.id) {
      console.error('Review ID not found');
      return;
    }

    try {
      setIsCheckingAI(true);
      const updatedReview = await homeworkReviewApi.checkAI(review.id);
      
      // Обновляем объект review с новыми данными
      if (review) {
        Object.assign(review, updatedReview);
      }
      
      // Обновляем formData с новыми данными
      setFormData(prevFormData => ({
        ...prevFormData,
        ai_percentage: updatedReview.ai_percentage || undefined,
        local_directory: updatedReview.local_directory || undefined,
      }));
      
      // Перезагружаем данные формы
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error checking AI:', error);
    } finally {
      setIsCheckingAI(false);
    }
  };

  const handleDownloadProject = async () => {
    if (!review?.id || !review?.url) {
      console.error('Review ID or URL not found');
      return;
    }

    try {
      setIsDownloading(true);
      const updatedReview = await homeworkReviewApi.downloadProject(review.id, review.url);
      
      // Обновляем объект review с новыми данными
      if (review) {
        Object.assign(review, updatedReview);
      }
      
      // Обновляем formData с новыми данными
      setFormData(prevFormData => ({
        ...prevFormData,
        local_directory: updatedReview.local_directory || undefined,
      }));
      
      // Перезагружаем данные формы
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error downloading project:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportToGoogleSheet = async () => {
    if (!review?.id) {
      console.error('Review ID not found');
      return;
    }

    try {
      setIsExportingToSheet(true);
      const result = await exportApi.exportReviewToGoogleSheet(review.id);
      
      alert(`Проверка успешно экспортирована в Google Sheet!\nСтудент: ${result.student_name}\nДомашнее задание: №${result.homework_number}\nСтрока: ${result.row_updated}`);
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting to Google Sheet:', error);
      alert('Ошибка при экспорте в Google Sheet. Проверьте настройки и попробуйте снова.');
    } finally {
      setIsExportingToSheet(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Редактировать проверку' : 'Добавить проверку'}
            </h2>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Прокрутите для просмотра всех полей
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Студент
            </label>
            <StudentSearch
              onStudentSelect={handleStudentSelect}
              selectedStudent={selectedStudent}
              placeholder="Начните вводить ФИО или Telegram студента..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер задания
            </label>
            <input
              type="number"
              min="1"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Информация о варианте домашнего задания - только для редактирования */}
          {isEditing && review?.variant_number && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Номер варианта
              </label>
              <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-md border border-blue-200 dark:border-blue-700">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Вариант №{review.variant_number}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Назначенный вариант домашнего задания для данного студента
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Дата отправки
            </label>
            <input
              type="date"
              value={formData.send_date}
              onChange={(e) => setFormData({ ...formData, send_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Дата проверки
            </label>
            <input
              type="date"
              value={formData.review_date || ''}
              onChange={(e) => setFormData({ ...formData, review_date: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Оставьте пустым, если еще не проверено"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ссылка на репозиторий
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://github.com/username/repo"
              required
            />
          </div>

          {/* Кнопка скачивания/обновления проекта - только для редактирования */}
          {isEditing && review?.id && review?.url && (
            <div>
              <button
                type="button"
                onClick={handleDownloadProject}
                disabled={isDownloading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Скачивание проекта...
                  </>
                ) : (
                  <>
                    {review?.local_directory ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Обновить проект
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Скачать проект
                      </>
                    )}
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {review?.local_directory 
                  ? 'Обновляет проект из GitHub (перезаписывает локальную копию)'
                  : 'Скачивает проект из GitHub для локального анализа'
                }
              </p>
              
              {/* Информация о директории */}
              {review?.local_directory && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900 rounded-md border border-blue-200 dark:border-blue-700">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Локальная директория проекта
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            // Копируем путь в буфер обмена
                            navigator.clipboard.writeText(review.local_directory || '');
                            alert('Путь к директории скопирован в буфер обмена');
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-xs"
                          title="Копировать путь"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs break-all">
                          {review.local_directory}
                        </code>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Проект готов для анализа и проверки AI. Нажмите на иконку копирования, чтобы скопировать путь.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Оценка
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.result}
              onChange={(e) => setFormData({ ...formData, result: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0-100"
            />
          </div>

          {/* Информация о проценте AI - только для редактирования */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Процент AI-генерации
              </label>
              {getCurrentAIPercentage() !== null && getCurrentAIPercentage() !== undefined ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Результат проверки AI:
                    </span>
                    <span className={`text-lg font-bold ${
                      (getCurrentAIPercentage() || 0) < 30 ? 'text-green-600 dark:text-green-400' :
                      (getCurrentAIPercentage() || 0) < 70 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {(getCurrentAIPercentage() || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        (getCurrentAIPercentage() || 0) < 30 ? 'bg-green-500' :
                        (getCurrentAIPercentage() || 0) < 70 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${getCurrentAIPercentage()}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {(getCurrentAIPercentage() || 0) < 30 ? '🟢 Низкая вероятность AI' :
                       (getCurrentAIPercentage() || 0) < 70 ? '🟡 Средняя вероятность AI' :
                       '🔴 Высокая вероятность AI'}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">
                      {(getCurrentAIPercentage() || 0) < 30 ? 'Скорее всего, код написан человеком' :
                       (getCurrentAIPercentage() || 0) < 70 ? 'Возможно использование AI-инструментов' :
                       'Высокая вероятность AI-генерации'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        AI проверка не проводилась
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Скачайте проект и нажмите "Проверить с помощью AI"
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Комментарии
            </label>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Комментарии преподавателя..."
            />
          </div>

          {/* Кнопка проверки AI - только для редактирования */}
          {isEditing && review?.id && (
            <div>
              <button
                type="button"
                onClick={handleCheckAI}
                disabled={isCheckingAI}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isCheckingAI ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Проверка AI...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Проверить с помощью AI
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Проверяет код на наличие AI-генерации. Сначала скачайте проект.
              </p>
            </div>
          )}

          {/* Кнопка экспорта в Google Sheet - только для редактирования */}
          {isEditing && review?.id && (
            <div>
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center"
              >
                <Upload className="w-4 h-4 mr-2" />
                Экспорт в Google Sheet
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Экспортирует данную проверку в лист "Оценки" Google Sheet.
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isEditing ? 'Сохранить' : 'Добавить'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {isEditing ? 'Назад к списку' : 'Отмена'}
            </button>
          </div>
        </form>
        </div>
      </div>

      {/* Модальное окно для экспорта в Google Sheet */}
      {showExportModal && (
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

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Что будет экспортировано
                  </h4>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Данные о студенте (ФИО, Telegram)</li>
                      <li>Ссылка на репозиторий</li>
                      <li>Дата отправки и проверки</li>
                      <li>Процент AI-генерации</li>
                      <li>Оценка преподавателя</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowExportModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                disabled={isExportingToSheet}
              >
                Отмена
              </button>
              <button
                onClick={handleExportToGoogleSheet}
                disabled={isExportingToSheet}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {isExportingToSheet ? (
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
    </div>
  );
}
