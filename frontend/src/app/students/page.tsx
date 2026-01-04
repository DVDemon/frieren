'use client';

import { useState, useEffect } from 'react';
import { Student, StudentCreate, StudentUpdate } from '@/types';
import { studentsApi } from '@/lib/api';
import { Plus, Edit, Trash2, Search, Loader2, Hash, ChevronUp, ChevronDown, Filter, X } from 'lucide-react';
import StudentExportButton from '@/components/StudentExportButton';
import StudentAttendanceExportButton from '@/components/StudentAttendanceExportButton';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Фильтры и сортировка
  const [filters, setFilters] = useState({
    name: '',
    group: '',
    telegram: '',
    github: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentsApi.getAll();
      setStudents(data);
    } catch (err) {
      setError('Ошибка при загрузке студентов');
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleCreateStudent = async (studentData: StudentCreate) => {
    try {
      const newStudent = await studentsApi.create(studentData);
      setStudents(prev => [...prev, newStudent]);
      setShowForm(false);
    } catch (err) {
      setError('Ошибка при создании студента');
      console.error('Error creating student:', err);
    }
  };

  const handleUpdateStudent = async (studentData: StudentUpdate) => {
    if (!editingStudent) return;
    
    try {
      const updatedStudent = await studentsApi.update(editingStudent.id, studentData);
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? updatedStudent : s));
      setEditingStudent(null);
    } catch (err) {
      setError('Ошибка при обновлении студента');
      console.error('Error updating student:', err);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого студента? Это действие нельзя отменить.')) {
      return;
    }
    
    try {
      await studentsApi.delete(id);
      setStudents(prev => prev.filter(s => s.id !== id));
      setEditingStudent(null);
    } catch (err) {
      setError('Ошибка при удалении студента');
      console.error('Error deleting student:', err);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingStudent(null);
  };

  const handleViewVariants = (studentId: number) => {
    // Переход на страницу вариантов конкретного студента
    window.location.href = `/student-variants/${studentId}`;
  };

  // Функция сортировки
  const sortData = (data: Student[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.full_name.toLowerCase();
          bValue = b.full_name.toLowerCase();
          break;
        case 'group':
          aValue = a.group_number.toLowerCase();
          bValue = b.group_number.toLowerCase();
          break;
        case 'telegram':
          aValue = a.telegram.toLowerCase();
          bValue = b.telegram.toLowerCase();
          break;
        case 'github':
          aValue = a.github.toLowerCase();
          bValue = b.github.toLowerCase();
          break;
        default:
          return 0;
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

  // Функция фильтрации
  const filterData = (data: Student[]) => {
    return data.filter(student => {
      const name = student.full_name.toLowerCase();
      const group = student.group_number.toLowerCase();
      const telegram = student.telegram.toLowerCase();
      const github = student.github.toLowerCase();

      // Основной поиск
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = name.includes(searchLower) || 
                           group.includes(searchLower) ||
                           telegram.includes(searchLower);

      // Фильтры
      const matchesName = !filters.name || name.includes(filters.name.toLowerCase());
      const matchesGroup = !filters.group || group.includes(filters.group.toLowerCase());
      const matchesTelegram = !filters.telegram || telegram.includes(filters.telegram.toLowerCase());
      const matchesGithub = !filters.github || github.includes(filters.github.toLowerCase());

      return matchesSearch && matchesName && matchesGroup && matchesTelegram && matchesGithub;
    });
  };

  // Обработчик сортировки
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };

  // Обработчик сброса фильтров
  const clearFilters = () => {
    setFilters({
      name: '',
      group: '',
      telegram: '',
      github: ''
    });
    setSearchTerm('');
  };

  // Получение отсортированных и отфильтрованных данных
  const processedStudents = sortData(filterData(students));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="text-gray-700 dark:text-gray-300">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="w-full px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Управление студентами
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Список студентов с возможностью добавления, редактирования и фильтрации
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
              Список студентов ({processedStudents.length})
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить студента
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени, Telegram или группе..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 rounded-md border ${
                  showFilters 
                    ? 'bg-primary-100 dark:bg-primary-900 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Фильтры
              </button>
              {(filters.name || filters.group || filters.telegram || filters.github) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-2 rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900"
                >
                  <X className="w-4 h-4 mr-2" />
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Панель фильтров */}
          {showFilters && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Имя
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по имени..."
                    value={filters.name}
                    onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Группа
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по группе..."
                    value={filters.group}
                    onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telegram
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по Telegram..."
                    value={filters.telegram}
                    onChange={(e) => setFilters(prev => ({ ...prev, telegram: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GitHub
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по GitHub..."
                    value={filters.github}
                    onChange={(e) => setFilters(prev => ({ ...prev, github: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      ФИО
                      {sortConfig?.key === 'name' && (
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
                    onClick={() => handleSort('telegram')}
                  >
                    <div className="flex items-center">
                      Telegram
                      {sortConfig?.key === 'telegram' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('github')}
                  >
                    <div className="flex items-center">
                      GitHub
                      {sortConfig?.key === 'github' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Chat ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {processedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {student.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {student.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {student.group_number}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {student.telegram}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {student.github}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {student.chat_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewVariants(student.id)}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          title="Просмотреть варианты"
                        >
                          <Hash className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <StudentExportButton 
                          studentId={student.id}
                          studentName={student.full_name}
                        />
                        <StudentAttendanceExportButton 
                          studentId={student.id}
                          studentName={student.full_name}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

                      {processedStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-300">
              {searchTerm ? 'Студенты не найдены' : 'Нет студентов'}
            </div>
          )}
        </div>
      </div>

      {/* Форма добавления/редактирования студента */}
      {(showForm || editingStudent) && (
        <StudentForm
          student={editingStudent}
          onSubmit={async (data: StudentCreate | StudentUpdate) => {
            if (editingStudent) {
              await handleUpdateStudent(data as StudentUpdate);
            } else {
              await handleCreateStudent(data as StudentCreate);
            }
          }}
          onCancel={handleCancelForm}
          onDelete={handleDeleteStudent}
          isEditing={!!editingStudent}
        />
      )}
    </div>
  );
}

// Компонент формы студента
interface StudentFormProps {
  student?: Student | null;
  onSubmit: (data: StudentCreate | StudentUpdate) => void;
  onCancel: () => void;
  onDelete?: (id: number) => void;
  isEditing: boolean;
}

function StudentForm({ student, onSubmit, onCancel, onDelete, isEditing }: StudentFormProps) {
  const [formData, setFormData] = useState<StudentCreate>({
    year: 1,
    full_name: '',
    telegram: '',
    github: '',
    group_number: '',
    chat_id: null,
  });

  useEffect(() => {
    if (student) {
      setFormData({
        year: student.year,
        full_name: student.full_name,
        telegram: student.telegram,
        github: student.github,
        group_number: student.group_number,
        chat_id: student.chat_id,
      });
    }
  }, [student]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Редактировать студента' : 'Добавить студента'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ФИО
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Группа
            </label>
            <input
              type="text"
              value={formData.group_number}
              onChange={(e) => setFormData({ ...formData, group_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Год обучения
            </label>
            <input
              type="number"
              min="1"
              max="6"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telegram
            </label>
            <input
              type="text"
              value={formData.telegram}
              onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GitHub
            </label>
            <input
              type="text"
              value={formData.github}
              onChange={(e) => setFormData({ ...formData, github: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Chat ID (необязательно)
            </label>
            <input
              type="number"
              value={formData.chat_id || ''}
              onChange={(e) => setFormData({ ...formData, chat_id: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Telegram Chat ID"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
            {isEditing && onDelete && student && (
              <button
                type="button"
                onClick={() => onDelete(student.id)}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Удалить
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
