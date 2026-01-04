'use client';

import { useState, useEffect } from 'react';
import { Teacher, TeacherCreate, TeacherUpdate, TeacherGroup, TeacherGroupCreate, TeacherStats } from '@/types';
import { teachersApi, teacherGroupsApi } from '@/lib/api';
import { Search, Plus, Edit, Trash2, Users, X, ChevronUp, ChevronDown, Filter } from 'lucide-react';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);
  const [teacherStats, setTeacherStats] = useState<Record<number, TeacherStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  
  // Фильтры и сортировка
  const [filters, setFilters] = useState({
    name: '',
    telegram: '',
    groups: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTeachers();
    fetchTeacherGroups();
  }, []);

  useEffect(() => {
    // Загружаем статистику для всех преподавателей после загрузки списка
    if (teachers.length > 0 && teacherGroups.length > 0) {
      fetchAllTeacherStats();
    }
  }, [teachers, teacherGroups]);

  const fetchAllTeacherStats = async () => {
    const stats: Record<number, TeacherStats> = {};
    for (const teacher of teachers) {
      try {
        const stat = await teachersApi.getStats(teacher.id);
        stats[teacher.id] = stat;
      } catch (err) {
        console.error(`Error fetching stats for teacher ${teacher.id}:`, err);
        // Устанавливаем нулевую статистику при ошибке
        stats[teacher.id] = {
          teacher_id: teacher.id,
          total_reviews: 0,
          pending_reviews: 0
        };
      }
    }
    setTeacherStats(stats);
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const data = await teachersApi.getAll();
      setTeachers(data);
    } catch (err) {
      setError('Ошибка при загрузке преподавателей');
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherGroups = async () => {
    try {
      const data = await teacherGroupsApi.getAll();
      setTeacherGroups(data);
    } catch (err) {
      console.error('Error fetching teacher groups:', err);
      setTeacherGroups([]);
    }
  };

  const handleCreateTeacher = async (teacherData: TeacherCreate) => {
    try {
      const newTeacher = await teachersApi.create(teacherData);
      setTeachers(prev => [...prev, newTeacher]);
      setShowForm(false);
    } catch (err) {
      setError('Ошибка при создании преподавателя');
      console.error('Error creating teacher:', err);
    }
  };

  const handleUpdateTeacher = async (teacherData: TeacherUpdate) => {
    if (!editingTeacher) return;
    
    try {
      const updatedTeacher = await teachersApi.update(editingTeacher.id, teacherData);
      setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? updatedTeacher : t));
      setEditingTeacher(null);
    } catch (err) {
      setError('Ошибка при обновлении преподавателя');
      console.error('Error updating teacher:', err);
    }
  };

  const handleDeleteTeacher = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого преподавателя? Это действие нельзя отменить.')) {
      return;
    }
    
    try {
      await teachersApi.delete(id);
      setTeachers(prev => prev.filter(t => t.id !== id));
      setEditingTeacher(null);
    } catch (err) {
      setError('Ошибка при удалении преподавателя');
      console.error('Error deleting teacher:', err);
    }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTeacher(null);
  };

  const getTeacherGroups = (teacherId: number) => {
    return teacherGroups.filter(tg => tg.teacher_id === teacherId);
  };

  const getTeacherStats = (teacherId: number) => {
    const stats = teacherStats[teacherId];
    if (!stats) {
      return {
        total: 0,
        pending: 0
      };
    }
    return {
      total: stats.total_reviews,
      pending: stats.pending_reviews
    };
  };

  const handleAddGroup = async (groupData: TeacherGroupCreate) => {
    try {
      const newGroup = await teacherGroupsApi.create(groupData);
      setTeacherGroups(prev => [...prev, newGroup]);
      setShowGroupForm(false);
    } catch (err) {
      setError('Ошибка при назначении группы');
      console.error('Error adding teacher group:', err);
    }
  };

  const handleRemoveGroup = async (groupId: number) => {
    if (!confirm('Вы уверены, что хотите снять назначение с этой группы?')) {
      return;
    }
    
    try {
      await teacherGroupsApi.delete(groupId);
      setTeacherGroups(prev => prev.filter(tg => tg.id !== groupId));
    } catch (err) {
      setError('Ошибка при снятии назначения с группы');
      console.error('Error removing teacher group:', err);
    }
  };

  // Функция сортировки
  const sortData = (data: Teacher[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.full_name.toLowerCase();
          bValue = b.full_name.toLowerCase();
          break;
        case 'telegram':
          aValue = a.telegram.toLowerCase();
          bValue = b.telegram.toLowerCase();
          break;
        case 'groups':
          aValue = getTeacherGroups(a.id).length;
          bValue = getTeacherGroups(b.id).length;
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
  const filterData = (data: Teacher[]) => {
    return data.filter(teacher => {
      const name = teacher.full_name.toLowerCase();
      const telegram = teacher.telegram.toLowerCase();
      const groups = getTeacherGroups(teacher.id).map(tg => tg.group_number).join(' ').toLowerCase();

      // Основной поиск
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = name.includes(searchLower) || 
                           telegram.includes(searchLower);

      // Фильтры
      const matchesName = !filters.name || name.includes(filters.name.toLowerCase());
      const matchesTelegram = !filters.telegram || telegram.includes(filters.telegram.toLowerCase());
      const matchesGroups = !filters.groups || groups.includes(filters.groups.toLowerCase());

      return matchesSearch && matchesName && matchesTelegram && matchesGroups;
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
      telegram: '',
      groups: ''
    });
    setSearchTerm('');
  };

  // Получение отсортированных и отфильтрованных данных
  const processedTeachers = sortData(filterData(teachers));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
            Преподаватели
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Управление преподавателями и их назначениями на группы
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
                    placeholder="Поиск по имени или Telegram..."
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
                {(filters.name || filters.telegram || filters.groups) && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center px-3 py-2 rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Сбросить
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить преподавателя
              </button>
            </div>
          </div>

          {/* Панель фильтров */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    Группы
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по группам..."
                    value={filters.groups}
                    onChange={(e) => setFilters(prev => ({ ...prev, groups: e.target.value }))}
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
                    onClick={() => handleSort('groups')}
                  >
                    <div className="flex items-center">
                      Группы
                      {sortConfig?.key === 'groups' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="w-4 h-4 ml-1" /> : 
                          <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Статистика работ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {processedTeachers.map((teacher) => {
                  const teacherGroupsList = getTeacherGroups(teacher.id);
                  const stats = getTeacherStats(teacher.id);
                  
                  return (
                    <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {teacher.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {teacher.telegram}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {teacherGroupsList.map((group) => (
                            <span
                              key={group.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200"
                            >
                              {group.group_number}
                              <button
                                onClick={() => handleRemoveGroup(group.id)}
                                className="ml-1 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <button
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setShowGroupForm(true);
                            }}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Добавить группу
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Всего работ:</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.total}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Непроверенных:</span>
                            <span className={`font-semibold ${stats.pending > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
                              {stats.pending}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditTeacher(teacher)}
                            className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeacher(teacher.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Форма добавления/редактирования преподавателя */}
        {(showForm || editingTeacher) && (
          <TeacherForm
            teacher={editingTeacher}
            onSubmit={async (data: TeacherCreate | TeacherUpdate) => {
              if (editingTeacher) {
                await handleUpdateTeacher(data as TeacherUpdate);
              } else {
                await handleCreateTeacher(data as TeacherCreate);
              }
            }}
            onCancel={handleCancelForm}
            onDelete={handleDeleteTeacher}
            isEditing={!!editingTeacher}
          />
        )}

        {/* Форма назначения группы */}
        {showGroupForm && selectedTeacher && (
          <TeacherGroupForm
            teacher={selectedTeacher}
            onSubmit={handleAddGroup}
            onCancel={() => {
              setShowGroupForm(false);
              setSelectedTeacher(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Компонент формы преподавателя
interface TeacherFormProps {
  teacher?: Teacher | null;
  onSubmit: (data: TeacherCreate | TeacherUpdate) => void;
  onCancel: () => void;
  onDelete?: (id: number) => void;
  isEditing: boolean;
}

function TeacherForm({ teacher, onSubmit, onCancel, onDelete, isEditing }: TeacherFormProps) {
  const [formData, setFormData] = useState<TeacherCreate>({
    full_name: '',
    telegram: '',
  });

  useEffect(() => {
    if (teacher) {
      setFormData({
        full_name: teacher.full_name,
        telegram: teacher.telegram,
      });
    }
  }, [teacher]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Редактировать преподавателя' : 'Добавить преподавателя'}
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
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
            {isEditing && onDelete && teacher && (
              <button
                type="button"
                onClick={() => onDelete(teacher.id)}
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

// Компонент формы назначения группы
interface TeacherGroupFormProps {
  teacher: Teacher;
  onSubmit: (data: TeacherGroupCreate) => void;
  onCancel: () => void;
}

function TeacherGroupForm({ teacher, onSubmit, onCancel }: TeacherGroupFormProps) {
  const [groupNumber, setGroupNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      teacher_id: teacher.id,
      group_number: groupNumber,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Назначить группу преподавателю
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Преподаватель: {teacher.full_name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер группы
            </label>
            <input
              type="text"
              value={groupNumber}
              onChange={(e) => setGroupNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Например: ИС-21-1"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Назначить
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
