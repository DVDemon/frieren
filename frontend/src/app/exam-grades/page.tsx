'use client';

import { useState, useEffect } from 'react';
import { Student, ExamGrade, ExamGradeCreate, ExamGradeUpdate } from '@/types';
import { studentsApi, examGradesApi } from '@/lib/api';
import { Search, Filter, X, Upload, Download, Edit, Save, X as XIcon, Loader2, FileText } from 'lucide-react';

interface StudentWithExamGrade {
  student: Student;
  examGrade: ExamGrade | null;
  isEditing: boolean;
}

export default function ExamGradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [examGrades, setExamGrades] = useState<ExamGrade[]>([]);
  const [studentsWithGrades, setStudentsWithGrades] = useState<StudentWithExamGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    name: '',
    group: '',
    telegram: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Partial<ExamGradeUpdate>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentsData, gradesData] = await Promise.all([
        studentsApi.getAll(),
        examGradesApi.getAll()
      ]);
      setStudents(studentsData);
      setExamGrades(gradesData);
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

  useEffect(() => {
    // Группируем оценки по студентам
    const gradesMap = new Map<number, ExamGrade>();
    examGrades.forEach(grade => {
      gradesMap.set(grade.student_id, grade);
    });

    // Создаем список студентов с их оценками
    const studentsWithGradesData: StudentWithExamGrade[] = students.map(student => ({
      student,
      examGrade: gradesMap.get(student.id) || null,
      isEditing: editingId === student.id
    }));

    setStudentsWithGrades(studentsWithGradesData);
  }, [students, examGrades, editingId]);

  const handleCreateGrade = async (studentId: number, data: ExamGradeCreate) => {
    try {
      const newGrade = await examGradesApi.create(data);
      setExamGrades(prev => [...prev, newGrade]);
      await fetchData();
    } catch (err) {
      setError('Ошибка при создании оценки');
      console.error('Error creating grade:', err);
    }
  };

  const handleUpdateGrade = async (gradeId: number, data: ExamGradeUpdate) => {
    try {
      const updatedGrade = await examGradesApi.update(gradeId, data);
      setExamGrades(prev => prev.map(g => g.id === gradeId ? updatedGrade : g));
      setEditingId(null);
      setEditingData({});
    } catch (err) {
      setError('Ошибка при обновлении оценки');
      console.error('Error updating grade:', err);
    }
  };

  const handleUploadPdf = async (studentId: number, file: File) => {
    try {
      const existingGrade = examGrades.find(g => g.student_id === studentId);
      
      if (existingGrade) {
        // Обновляем существующую оценку с PDF
        await examGradesApi.updatePdf(existingGrade.id, file);
      } else {
        // Создаем новую оценку с PDF (нужны базовые данные)
        const today = new Date().toISOString().split('T')[0];
        await examGradesApi.createWithPdf({
          date: today,
          grade: 0,
          variant_number: 1,
          student_id: studentId
        }, file);
      }
      await fetchData();
    } catch (err) {
      setError('Ошибка при загрузке PDF');
      console.error('Error uploading PDF:', err);
    }
  };

  const handleDownloadPdf = async (gradeId: number, studentName: string) => {
    try {
      const blob = await examGradesApi.downloadPdf(gradeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam_grade_${studentName}_${gradeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Ошибка при скачивании PDF');
      console.error('Error downloading PDF:', err);
    }
  };

  const handleEdit = (studentId: number) => {
    const grade = examGrades.find(g => g.student_id === studentId);
    if (grade) {
      setEditingId(studentId);
      setEditingData({
        date: grade.date,
        grade: grade.grade,
        variant_number: grade.variant_number
      });
    } else {
      // Создаем новую оценку
      const today = new Date().toISOString().split('T')[0];
      setEditingId(studentId);
      setEditingData({
        date: today,
        grade: 0,
        variant_number: 1
      });
    }
  };

  const handleSave = async (studentId: number) => {
    try {
      const grade = examGrades.find(g => g.student_id === studentId);
      if (grade) {
        await handleUpdateGrade(grade.id, editingData);
      } else {
        // Создаем новую оценку
        await handleCreateGrade(studentId, {
          date: editingData.date || new Date().toISOString().split('T')[0],
          grade: editingData.grade || 0,
          variant_number: editingData.variant_number || 1,
          student_id: studentId
        });
      }
      setEditingId(null);
      setEditingData({});
      await fetchData(); // Обновляем данные после сохранения
    } catch (err) {
      console.error('Error saving grade:', err);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData({});
  };

  const filterData = (data: StudentWithExamGrade[]) => {
    return data.filter(item => {
      const name = item.student.full_name.toLowerCase();
      const group = item.student.group_number.toLowerCase();
      const telegram = item.student.telegram.toLowerCase();

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = name.includes(searchLower) || 
                           group.includes(searchLower) ||
                           telegram.includes(searchLower);

      const matchesName = !filters.name || name.includes(filters.name.toLowerCase());
      const matchesGroup = !filters.group || group.includes(filters.group.toLowerCase());
      const matchesTelegram = !filters.telegram || telegram.includes(filters.telegram.toLowerCase());

      return matchesSearch && matchesName && matchesGroup && matchesTelegram;
    });
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      group: '',
      telegram: ''
    });
    setSearchTerm('');
  };

  const filteredStudents = filterData(studentsWithGrades);

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
            Оценки за экзамен
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Управление экзаменационными оценками студентов
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
              Список студентов ({filteredStudents.length})
            </h2>
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
              {(filters.name || filters.group || filters.telegram) && (
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

          {showFilters && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ФИО
                  </label>
                  <input
                    type="text"
                    placeholder="Фильтр по ФИО..."
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
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ФИО
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Группа
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Telegram
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Оценка
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Вариант
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    PDF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStudents.map((item) => {
                  const isEditing = editingId === item.student.id;
                  const grade = item.examGrade;

                  return (
                    <tr key={item.student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.student.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.student.group_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.student.telegram}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editingData.date || ''}
                            onChange={(e) => setEditingData({ ...editingData, date: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        ) : (
                          grade?.date ? new Date(grade.date).toLocaleDateString('ru-RU') : '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editingData.grade ?? grade?.grade ?? 0}
                            onChange={(e) => setEditingData({ ...editingData, grade: parseInt(e.target.value) || 0 })}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        ) : (
                          grade?.grade ?? '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editingData.variant_number ?? grade?.variant_number ?? 1}
                            onChange={(e) => setEditingData({ ...editingData, variant_number: parseInt(e.target.value) || 1 })}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        ) : (
                          grade?.variant_number ?? '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {grade?.has_pdf ? (
                          <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex space-x-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(item.student.id)}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                                title="Сохранить"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancel}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                title="Отмена"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(item.student.id)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                title="Редактировать"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <label
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 cursor-pointer"
                                title="Загрузить файл (PDF, PNG, JPG)"
                              >
                                <Upload className="w-4 h-4" />
                                <input
                                  type="file"
                                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUploadPdf(item.student.id, file);
                                    }
                                  }}
                                />
                              </label>
                              {grade?.has_pdf && (
                                <button
                                  onClick={() => handleDownloadPdf(grade.id, item.student.full_name)}
                                  className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300"
                                  title="Скачать PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-300">
              {searchTerm || filters.name || filters.group || filters.telegram 
                ? 'Студенты не найдены' 
                : 'Нет студентов'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

