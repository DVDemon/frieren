'use client';

import { useState, useEffect } from 'react';
import { Lecture, LectureCreate, LectureUpdate } from '@/types';
import { lecturesApi } from '@/lib/api';
import { Plus, Edit, Search, Loader2, ChevronUp, ChevronDown, Users, ExternalLink } from 'lucide-react';
import DeleteLectureButton from '@/components/DeleteLectureButton';
import QRCodeComponent from '@/components/QRCode';
import LectureCapacityInfoComponent from '@/components/LectureCapacityInfo';

export default function LecturesPage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: 'id' | 'number' | 'topic' | 'date' | 'start_time' | 'secret_code' | 'max_student' | 'github_example';
    direction: 'asc' | 'desc';
  } | null>(null);
  const [deletingLectures, setDeletingLectures] = useState<Set<number>>(new Set());
  const [selectedLectureForCapacity, setSelectedLectureForCapacity] = useState<number | null>(null);

  const fetchLectures = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await lecturesApi.getAll();
      setLectures(data);
    } catch (err) {
      setError('Ошибка при загрузке лекций');
      console.error('Error fetching lectures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures();
  }, []);

  const handleCreateLecture = async (lectureData: LectureCreate) => {
    try {
      const newLecture = await lecturesApi.create(lectureData);
      setLectures(prev => [...prev, newLecture]);
      setShowForm(false);
    } catch (err) {
      setError('Ошибка при создании лекции');
      console.error('Error creating lecture:', err);
    }
  };

  const handleUpdateLecture = async (lectureData: LectureUpdate) => {
    if (!editingLecture) return;
    
    try {
      const updatedLecture = await lecturesApi.update(editingLecture.id, lectureData);
      setLectures(prev => prev.map(l => l.id === editingLecture.id ? updatedLecture : l));
      setEditingLecture(null);
    } catch (err) {
      setError('Ошибка при обновлении лекции');
      console.error('Error updating lecture:', err);
    }
  };

  const handleEditLecture = (lecture: Lecture) => {
    setEditingLecture(lecture);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingLecture(null);
  };

  const handleDeleteLecture = async (lectureId: number) => {
    // Защита от множественных вызовов
    if (deletingLectures.has(lectureId)) {
      console.log(`Delete already in progress for lecture ${lectureId}, ignoring duplicate call`);
      return;
    }

    try {
      setDeletingLectures(prev => new Set(prev).add(lectureId));
      console.log(`handleDeleteLecture called with ID: ${lectureId} (type: ${typeof lectureId})`);
      await lecturesApi.delete(lectureId);
      setLectures(prev => prev.filter(l => l.id !== lectureId));
    } catch (err) {
      console.error('Error deleting lecture:', err);
      setError(`Ошибка при удалении лекции: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
    } finally {
      setDeletingLectures(prev => {
        const newSet = new Set(prev);
        newSet.delete(lectureId);
        return newSet;
      });
    }
  };

  const handleSort = (key: 'id' | 'number' | 'topic' | 'date' | 'start_time' | 'secret_code' | 'max_student' | 'github_example') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortData = (data: Lecture[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      // Для даты преобразуем в Date объект для корректного сравнения
      if (sortConfig.key === 'date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      // Для времени начала сравниваем как строки (формат HH:MM)
      if (sortConfig.key === 'start_time') {
        aValue = aValue || '';
        bValue = bValue || '';
      }
      
      // Для секретного кода и GitHub примера обрабатываем null значения
      if (sortConfig.key === 'secret_code' || sortConfig.key === 'github_example') {
        aValue = aValue || '';
        bValue = bValue || '';
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredLectures = lectures.filter(lecture =>
    lecture.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lecture.number.toString().includes(searchTerm) ||
    (lecture.start_time && lecture.start_time.includes(searchTerm)) ||
    (lecture.secret_code && lecture.secret_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (lecture.max_student && lecture.max_student.toString().includes(searchTerm)) ||
    (lecture.github_example && lecture.github_example.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedLectures = sortData(filteredLectures);

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
            Управление лекциями
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Список лекций с возможностью добавления, редактирования и фильтрации
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
              Список лекций ({sortedLectures.length})
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить лекцию
            </button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по номеру, теме, секретному коду или GitHub примеру..."
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
                    onClick={() => handleSort('number')}
                  >
                    <div className="flex items-center">
                      Номер
                      {sortConfig?.key === 'number' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-4 h-4 ml-1" /> :
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('topic')}
                  >
                    <div className="flex items-center">
                      Тема
                      {sortConfig?.key === 'topic' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-4 h-4 ml-1" /> :
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      Дата
                      {sortConfig?.key === 'date' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-4 h-4 ml-1" /> :
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('start_time')}
                  >
                    <div className="flex items-center">
                      Время начала
                      {sortConfig?.key === 'start_time' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-4 h-4 ml-1" /> :
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('secret_code')}
                  >
                    <div className="flex items-center">
                      Секретный код
                      {sortConfig?.key === 'secret_code' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-4 h-4 ml-1" /> :
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('max_student')}
                  >
                    <div className="flex items-center">
                      Макс. студентов
                      {sortConfig?.key === 'max_student' && (
                        sortConfig.direction === 'asc' ?
                          <ChevronUp className="w-4 h-4 ml-1" /> :
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('github_example')}
                  >
                    <div className="flex items-center">
                      GitHub пример
                      {sortConfig?.key === 'github_example' && (
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
                {sortedLectures.map((lecture) => (
                  <tr key={lecture.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {lecture.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {lecture.number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {lecture.topic}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {new Date(lecture.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {lecture.start_time ? (
                        <span className="font-medium">{lecture.start_time}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Не указано</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {lecture.secret_code ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {lecture.secret_code}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Не указан</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {lecture.max_student !== null && lecture.max_student !== undefined ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {lecture.max_student}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Не указано</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {lecture.github_example ? (
                        <a
                          href={lecture.github_example}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                          title="Открыть пример в GitHub"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Пример
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Не указан</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedLectureForCapacity(lecture.number)}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          title="Проверить вместимость"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditLecture(lecture)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Редактировать лекцию"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <DeleteLectureButton
                          lectureId={lecture.id}
                          lectureNumber={lecture.number}
                          lectureTopic={lecture.topic}
                          onDelete={() => handleDeleteLecture(lecture.id)}
                          disabled={deletingLectures.has(lecture.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedLectures.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-300">
              {searchTerm ? 'Лекции не найдены' : 'Нет лекций'}
            </div>
          )}
        </div>
      </div>

      {/* Форма добавления/редактирования лекции */}
      {(showForm || editingLecture) && (
        <LectureForm
          lecture={editingLecture}
          onSubmit={async (data: LectureCreate | LectureUpdate) => {
            if (editingLecture) {
              await handleUpdateLecture(data as LectureUpdate);
            } else {
              await handleCreateLecture(data as LectureCreate);
            }
          }}
          onCancel={handleCancelForm}
          isEditing={!!editingLecture}
        />
      )}

      {/* Модальное окно информации о вместимости лекции */}
      {selectedLectureForCapacity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Вместимость лекции
              </h2>
              <button
                onClick={() => setSelectedLectureForCapacity(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <LectureCapacityInfoComponent 
              lectureNumber={selectedLectureForCapacity}
              onCapacityChange={(capacity) => {
                // Можно добавить дополнительную логику при изменении вместимости
                console.log('Capacity changed:', capacity);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Компонент формы лекции
interface LectureFormProps {
  lecture?: Lecture | null;
  onSubmit: (data: LectureCreate | LectureUpdate) => void;
  onCancel: () => void;
  isEditing: boolean;
}

function LectureForm({ lecture, onSubmit, onCancel, isEditing }: LectureFormProps) {
  const [formData, setFormData] = useState<LectureCreate>({
    number: 1,
    topic: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    secret_code: null,
    max_student: null,
    github_example: null,
  });

  useEffect(() => {
    if (lecture) {
      setFormData({
        number: lecture.number,
        topic: lecture.topic,
        date: lecture.date,
        start_time: lecture.start_time || '09:00',
        secret_code: lecture.secret_code,
        max_student: lecture.max_student,
        github_example: lecture.github_example,
      });
    }
  }, [lecture]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Редактировать лекцию' : 'Добавить лекцию'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер лекции
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тема лекции
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Дата
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Время начала
            </label>
            <input
              type="time"
              value={formData.start_time || '09:00'}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Время начала лекции в формате ЧЧ:ММ
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Секретный код
            </label>
            <input
              type="text"
              value={formData.secret_code || ''}
              onChange={(e) => setFormData({ ...formData, secret_code: e.target.value || null })}
              placeholder="Введите секретный код (необязательно)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* QR код для секретного кода */}
          {formData.secret_code && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                QR код для секретного кода
              </h3>
              <div className="flex justify-center">
                <QRCodeComponent 
                  value={formData.secret_code} 
                  size={180}
                  className="bg-white dark:bg-gray-100 p-4 rounded-lg"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Максимальное количество студентов
            </label>
            <input
              type="number"
              min="0"
              value={formData.max_student || ''}
              onChange={(e) => setFormData({ ...formData, max_student: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Не указано"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GitHub пример
            </label>
            <input
              type="url"
              value={formData.github_example || ''}
              onChange={(e) => setFormData({ ...formData, github_example: e.target.value || null })}
              placeholder="https://github.com/username/repository"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ссылка на пример кода в GitHub (необязательно)
            </p>
          </div>

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
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
