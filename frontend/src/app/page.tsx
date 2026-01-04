'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  CheckCircle2, 
  BookText, 
  FileText, 
  Clock,
  AlertCircle,
  GraduationCap
} from 'lucide-react';
import { studentsApi, lecturesApi, homeworkApi, homeworkReviewApi, teachersApi } from '@/lib/api';
import { Student, Lecture, Homework, HomeworkReview, Teacher } from '@/types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import GoogleSheetExportButton from '@/components/GoogleSheetExportButton';
import GoogleSheetImportButton from '@/components/GoogleSheetImportButton';
import Calendar from '@/components/Calendar';

export default function Home() {
  const [stats, setStats] = useState({
    students: 0,
    lectures: 0,
    homework: 0,
    pendingReviews: 0,
    teachers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);

  useEffect(() => {
    // Логируем backend URL при загрузке страницы
    const fetchConfig = async () => {
      try {
        console.log('🏠 Home page: Fetching config...');
        
        const response = await fetch('/api/config');
        const config = await response.json();
        
        setBackendUrl(config.backendUrl);
        console.log('🏠 Home page loaded with BACKEND_URL:', config.backendUrl);
        console.log('🏠 Full config:', config);
      } catch (error) {
        console.error('Error getting config in Home:', error);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        console.log('📊 Fetching stats from backend:', backendUrl);
        
        const [students, lecturesData, homeworkData, pendingReviews, teachers] = await Promise.all([
          studentsApi.getAll(),
          lecturesApi.getAll(),
          homeworkApi.getAll(),
          homeworkReviewApi.getPending(),
          teachersApi.getAll(),
        ]);

        setLectures(lecturesData);
        setHomeworks(homeworkData);

        setStats({
          students: students.length,
          lectures: lecturesData.length,
          homework: homeworkData.length,
          pendingReviews: pendingReviews.length,
          teachers: teachers.length,
        });
      } catch (err) {
        setError('Ошибка при загрузке данных');
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [backendUrl]);

  const statCards = [
    {
      title: 'Студенты',
      value: stats.students,
      icon: <Users className="w-6 h-6" />,
      color: 'bg-primary-500',
      href: '/students',
    },
    {
      title: 'Преподаватели',
      value: stats.teachers,
      icon: <GraduationCap className="w-6 h-6" />,
      color: 'bg-primary-600',
      href: '/teachers',
    },
    {
      title: 'Лекции',
      value: stats.lectures,
      icon: <BookOpen className="w-6 h-6" />,
      color: 'bg-accent-500',
      href: '/lectures',
    },
    {
      title: 'Домашние задания',
      value: stats.homework,
      icon: <BookText className="w-6 h-6" />,
      color: 'bg-accent-600',
      href: '/homework',
    },
    {
      title: 'Работы на проверку',
      value: stats.pendingReviews,
      icon: <Clock className="w-6 h-6" />,
      color: 'bg-primary-700',
      href: '/pending-reviews',
    },
  ];

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
            Панель управления
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Обзор системы управления студентами и лекциями
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`${card.color} p-3 rounded-lg text-white`}>
                  {card.icon}
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {card.value}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Быстрые действия
            </h2>
            <div className="flex flex-wrap gap-3">
              <ImportButton />
              <ExportButton />
              <GoogleSheetExportButton />
              <GoogleSheetImportButton />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Calendar lectures={lectures} homeworks={homeworks} />
        </div>
      </div>
    </div>
  );
}
