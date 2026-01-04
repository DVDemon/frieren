'use client';

import { useState, useEffect } from 'react';
import { Student, Homework, StudentHomeworkVariant, StudentHomeworkVariantCreate, StudentHomeworkVariantUpdate } from '@/types';
import { studentsApi, homeworkApi, studentHomeworkVariantsApi } from '@/lib/api';
import { Search, Plus, Edit, Trash2, Hash, Users, BookText, ChevronUp, ChevronDown, Filter, X } from 'lucide-react';

export default function HomeworkVariantsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [variants, setVariants] = useState<StudentHomeworkVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<StudentHomeworkVariant | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  
  // Фильтры и сортировка
  const [filters, setFilters] = useState({
    student: '',
    homework: '',
    variantNumber: '',
    group: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsData, homeworkData, variantsData] = await Promise.all([
        studentsApi.getAll(),
        homeworkApi.getAll(),
        studentHomeworkVariantsApi.getAll(),
      ]);
      setStudents(studentsData);
      setHomework(homeworkData);
      setVariants(variantsData);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariant = async (variantData: StudentHomeworkVariantCreate) => {
    try {
      const newVariant = await studentHomeworkVariantsApi.create(variantData);
      setVariants(prev => [...prev, newVariant]);
      setShowForm(false);
    } catch (err) {
      setError('Ошибка при создании варианта');
      console.error('Error creating variant:', err);
    }
  };

  const handleUpdateVariant = async (variantData: StudentHomeworkVariantUpdate) => {
    if (!editingVariant) return;
    
    try {
      const updatedVariant = await studentHomeworkVariantsApi.update(editingVariant.id, variantData);
      setVariants(prev => prev.map(v => v.id === editingVariant.id ? updatedVariant : v));
      setEditingVariant(null);
    } catch (err) {
      setError('Ошибка при обновлении варианта');
      console.error('Error updating variant:', err);
    }
  };

  const handleDeleteVariant = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот вариант?')) {
      return;
    }
    
    try {
      await studentHomeworkVariantsApi.delete(id);
      setVariants(prev => prev.filter(v => v.id !== id));
      setEditingVariant(null);
    } catch (err) {
      setError('Ошибка при удалении варианта');
      console.error('Error deleting variant:', err);
    }
  };

  const handleEditVariant = (variant: StudentHomeworkVariant) => {
    setEditingVariant(variant);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingVariant(null);
  };

  const getStudentName = (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    return student ? student.full_name : 'Неизвестно';
  };

  const getHomeworkDescription = (homeworkId: number) => {
    const hw = homework.find(h => h.id === homeworkId);
    return hw ? `№${hw.number}: ${hw.short_description}` : 'Неизвестно';
  };

  const getHomeworkVariantsCount = (homeworkId: number) => {
    const hw = homework.find(h => h.id === homeworkId);
    return hw ? hw.variants_count : 0;
  };

  const getStudentGroup = (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    return student ? student.group_number : '';
  };

  // Функция сортировки
  const sortData = (data: StudentHomeworkVariant[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'student':
          aValue = getStudentName(a.student_id).toLowerCase();
          bValue = getStudentName(b.student_id).toLowerCase();
          break;
        case 'homework':
          aValue = getHomeworkDescription(a.homework_id).toLowerCase();
          bValue = getHomeworkDescription(b.homework_id).toLowerCase();
          break;
        case 'variant':
          aValue = a.variant_number;
          bValue = b.variant_number;
          break;
        case 'group':
          aValue = getStudentGroup(a.student_id).toLowerCase();
          bValue = getStudentGroup(b.student_id).toLowerCase();
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
  const filterData = (data: StudentHomeworkVariant[]) => {
    return data.filter(variant => {
      const studentName = getStudentName(variant.student_id).toLowerCase();
      const homeworkDesc = getHomeworkDescription(variant.homework_id).toLowerCase();
      const group = getStudentGroup(variant.student_id).toLowerCase();
      const variantNumber = variant.variant_number.toString();

      // Основной поиск
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = studentName.includes(searchLower) || 
                           homeworkDesc.includes(searchLower) ||
                           variantNumber.includes(searchTerm);

      // Фильтры
      const matchesStudent = !filters.student || studentName.includes(filters.student.toLowerCase());
      const matchesHomework = !filters.homework || homeworkDesc.includes(filters.homework.toLowerCase());
      const matchesVariant = !filters.variantNumber || variantNumber.includes(filters.variantNumber);
      const matchesGroup = !filters.group || group.includes(filters.group.toLowerCase());

      return matchesSearch && matchesStudent && matchesHomework && matchesVariant && matchesGroup;
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
      student: '',
      homework: '',
      variantNumber: '',
      group: ''
    });
    setSearchTerm('');
  };

  // Получение отсортированных и отфильтрованных данных
  const processedVariants = sortData(filterData(variants));

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Варианты домашних заданий
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Управление вариантами домашних заданий для студентов
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

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Поиск по студенту, заданию или номеру варианта..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 rounded-md border ${
                  showFilters 
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Фильтры
              </button>
              {(filters.student || filters.homework || filters.variantNumber || filters.group) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-2 rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900"
                >
                  <X className="w-4 h-4 mr-2" />
                  Сбросить
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить вариант
              </button>
              <button
                onClick={() => window.location.href = '/students'}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                <Users className="w-4 h-4 mr-2" />
                Массовое управление
              </button>
            </div>
          </div>

          {/* Панель фильтров */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Студент
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по студенту..."
                    value={filters.student}
                    onChange={(e) => setFilters(prev => ({ ...prev, student: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Домашнее задание
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по заданию..."
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
                    placeholder="Фильтр по варианту..."
                    value={filters.variantNumber}
                    onChange={(e) => setFilters(prev => ({ ...prev, variantNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
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
                      Домашнее задание
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
                      Номер варианта
                      {sortConfig?.key === 'variant' && (
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
                {processedVariants.map((variant) => (
                  <tr key={variant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-gray-400" />
                        {getStudentName(variant.student_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        {getStudentGroup(variant.student_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center">
                        <BookText className="w-4 h-4 mr-2 text-gray-400" />
                        {getHomeworkDescription(variant.homework_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        <Hash className="w-3 h-3 mr-1" />
                        {variant.variant_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditVariant(variant)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Форма добавления/редактирования варианта */}
        {(showForm || editingVariant) && (
          <VariantForm
            variant={editingVariant}
            students={students}
            homework={homework}
            onSubmit={async (data: StudentHomeworkVariantCreate | StudentHomeworkVariantUpdate) => {
              if (editingVariant) {
                await handleUpdateVariant(data as StudentHomeworkVariantUpdate);
              } else {
                await handleCreateVariant(data as StudentHomeworkVariantCreate);
              }
            }}
            onCancel={handleCancelForm}
            isEditing={!!editingVariant}
          />
        )}
      </div>
    </div>
  );
}

// Компонент формы варианта
interface VariantFormProps {
  variant?: StudentHomeworkVariant | null;
  students: Student[];
  homework: Homework[];
  onSubmit: (data: StudentHomeworkVariantCreate | StudentHomeworkVariantUpdate) => void;
  onCancel: () => void;
  isEditing: boolean;
}

function VariantForm({ variant, students, homework, onSubmit, onCancel, isEditing }: VariantFormProps) {
  const [formData, setFormData] = useState<StudentHomeworkVariantCreate>({
    student_id: 0,
    homework_id: 0,
    variant_number: 1,
  });

  const selectedHomework = homework.find(h => h.id === formData.homework_id);

  useEffect(() => {
    if (variant) {
      setFormData({
        student_id: variant.student_id,
        homework_id: variant.homework_id,
        variant_number: variant.variant_number,
      });
    }
  }, [variant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Редактировать вариант' : 'Добавить вариант'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Студент
            </label>
            <select
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value={0}>Выберите студента</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name} ({student.group_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Домашнее задание
            </label>
            <select
              value={formData.homework_id}
              onChange={(e) => setFormData({ ...formData, homework_id: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value={0}>Выберите задание</option>
              {homework.map((hw) => (
                <option key={hw.id} value={hw.id}>
                  №{hw.number}: {hw.short_description} (вариантов: {hw.variants_count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер варианта
            </label>
            <input
              type="number"
              min="1"
              max={selectedHomework?.variants_count || 1}
              value={formData.variant_number}
              onChange={(e) => setFormData({ ...formData, variant_number: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
            {selectedHomework && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Максимальное количество вариантов: {selectedHomework.variants_count}
              </p>
            )}
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
