'use client';

import { useState, useEffect } from 'react';
import { Attendance, Student, Lecture } from '@/types';
import { attendanceApi, studentsApi, lecturesApi } from '@/lib/api';
import { Loader2, Search } from 'lucide-react';

export default function AttendanceChartPage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState('');

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


  // Статистика по лекциям
  const lectureStats = lectures
    .sort((a, b) => a.number - b.number) // Сортировка по номеру лекции по возрастанию
    .map(lecture => {
      const lectureAttendance = attendance.filter(record => record.lecture.id === lecture.id);
      const totalStudents = students.filter(student => !student.is_deleted).length;
      const present = lectureAttendance.filter(record => record.present).length;
      const absent = lectureAttendance.filter(record => !record.present).length;
      const percentage = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

      return {
        lecture,
        totalStudents,
        present,
        absent,
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
            График посещаемости
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Аналитика посещаемости студентов по лекциям и группам
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


        {/* Основная статистика по лекциям */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Посещаемость по лекциям
          </h2>
          <div className="space-y-4">
            {lectureStats.map(({ lecture, totalStudents, present, absent, percentage }) => (
              <div key={lecture.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Лекция {lecture.number}: {lecture.topic}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>Присутствовали: {present}</span>
                  <span>Отсутствовали: {absent}</span>
                  <span>Всего студентов: {totalStudents}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Дата: {new Date(lecture.date).toLocaleDateString('ru-RU')}
                  {lecture.start_time && (
                    <span className="ml-2">Время: {lecture.start_time}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Детальная таблица */}
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Детальная статистика посещаемости
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
                    Всего лекций
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Присутствовал
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
                  const studentAttendance = attendance.filter(record => record.student.id === student.id);
                  const totalLectures = lectures.length; // Максимальное количество лекций в системе
                  const present = studentAttendance.filter(record => record.present).length;
                  const absent = totalLectures - present;
                  const percentage = totalLectures > 0 ? Math.round((present / totalLectures) * 100) : 0;

                  return (
                    <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {student.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {student.group_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {totalLectures}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                        {present}
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
