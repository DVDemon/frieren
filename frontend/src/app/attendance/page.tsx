'use client';

import { useState, useEffect } from 'react';
import { Attendance, AttendanceCreate, AttendanceUpdate, Student, Lecture } from '@/types';
import { attendanceApi, studentsApi, lecturesApi } from '@/lib/api';
import { Plus, Edit, Search, Loader2, CheckCircle, XCircle } from 'lucide-react';
import StudentSearch from '@/components/StudentSearch';

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [attendanceData, studentsData, lecturesData] = await Promise.all([
        attendanceApi.getAll(),
        studentsApi.getAll(),
        lecturesApi.getAll(),
      ]);
      setAttendance(attendanceData);
      setStudents(studentsData);
      setLectures(lecturesData);
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

  const handleCreateAttendance = async (attendanceData: AttendanceCreate) => {
    try {
      const newAttendance = await attendanceApi.create(attendanceData);
      setAttendance(prev => [...prev, newAttendance]);
      setShowForm(false);
    } catch (err) {
      setError('Ошибка при создании записи посещаемости');
      console.error('Error creating attendance:', err);
    }
  };

  const handleUpdateAttendance = async (attendanceData: AttendanceUpdate) => {
    if (!editingAttendance) return;
    
    try {
      const updatedAttendance = await attendanceApi.update(editingAttendance.id, attendanceData);
      setAttendance(prev => prev.map(a => a.id === editingAttendance.id ? updatedAttendance : a));
      setEditingAttendance(null);
    } catch (err) {
      setError('Ошибка при обновлении записи посещаемости');
      console.error('Error updating attendance:', err);
    }
  };

  const handleEditAttendance = (attendance: Attendance) => {
    setEditingAttendance(attendance);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAttendance(null);
  };

  const filteredAttendance = attendance.filter(record =>
    !record.student.is_deleted && (
      record.student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.lecture.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.student.group_number.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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
            Учет посещаемости
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Управление посещаемостью студентов на лекциях
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
              Записи посещаемости ({filteredAttendance.length})
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить запись
            </button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по студенту, лекции или группе..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Студент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Группа
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Лекция
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Дата лекции
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Посещение
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAttendance.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {record.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {record.student.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {record.student.group_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      Лекция {record.lecture.number}: {record.lecture.topic}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <div>
                        {new Date(record.lecture.date).toLocaleDateString('ru-RU')}
                        {record.lecture.start_time && (
                          <span className="ml-2 text-gray-500 dark:text-gray-400">
                            {record.lecture.start_time}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.present ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Присутствовал
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          Отсутствовал
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <button
                        onClick={() => handleEditAttendance(record)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAttendance.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-300">
              {searchTerm ? 'Записи не найдены' : 'Нет записей посещаемости'}
            </div>
          )}
        </div>
      </div>

      {/* Форма добавления/редактирования посещаемости */}
      {(showForm || editingAttendance) && (
        <AttendanceForm
          attendance={editingAttendance}
          students={students}
          lectures={lectures}
          onSubmit={async (data: AttendanceCreate | AttendanceUpdate) => {
            if (editingAttendance) {
              await handleUpdateAttendance(data as AttendanceUpdate);
            } else {
              await handleCreateAttendance(data as AttendanceCreate);
            }
          }}
          onCancel={handleCancelForm}
          isEditing={!!editingAttendance}
        />
      )}
    </div>
  );
}

// Компонент формы посещаемости
interface AttendanceFormProps {
  attendance?: Attendance | null;
  students: Student[];
  lectures: Lecture[];
  onSubmit: (data: AttendanceCreate | AttendanceUpdate) => void;
  onCancel: () => void;
  isEditing: boolean;
}

function AttendanceForm({ attendance, students, lectures, onSubmit, onCancel, isEditing }: AttendanceFormProps) {
  const [formData, setFormData] = useState<AttendanceCreate>({
    student_id: 0,
    lecture_id: 0,
    present: true,
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (attendance) {
      setFormData({
        student_id: attendance.student.id,
        lecture_id: attendance.lecture.id,
        present: attendance.present,
      });
      setSelectedStudent(attendance.student);
    }
  }, [attendance]);

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setFormData({ ...formData, student_id: student.id });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Редактировать посещаемость' : 'Добавить запись посещаемости'}
        </h2>
        
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
              Лекция
            </label>
            <select
              value={formData.lecture_id}
              onChange={(e) => setFormData({ ...formData, lecture_id: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value={0}>Выберите лекцию</option>
              {lectures
                .sort((a, b) => a.number - b.number)
                .map((lecture) => (
                  <option key={lecture.id} value={lecture.id}>
                    Лекция {lecture.number}: {lecture.topic}
                    {lecture.start_time && ` (${lecture.start_time})`}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Посещение
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="present"
                  value="true"
                  checked={formData.present === true}
                  onChange={() => setFormData({ ...formData, present: true })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Присутствовал</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="present"
                  value="false"
                  checked={formData.present === false}
                  onChange={() => setFormData({ ...formData, present: false })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Отсутствовал</span>
              </label>
            </div>
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
