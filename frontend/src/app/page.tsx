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
  GraduationCap,
  ExternalLink,
  FileSpreadsheet,
  CheckCircle,
  XCircle
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
    studentsWithWork: 0,
    studentsWithoutWork: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);

  useEffect(() => {
    // Логируем backend URL при загрузке страницы
    const fetchConfig = async () => {
      try {
        console.log('🏠 Home page: Fetching config...');
        
        const response = await fetch('/api/config');
        const config = await response.json();
        
        console.log('🏠 Raw config response:', config);
        console.log('🏠 config.googleSheetUrl type:', typeof config.googleSheetUrl);
        console.log('🏠 config.googleSheetUrl value:', config.googleSheetUrl);
        
        setBackendUrl(config.backendUrl);
        
        // Проверяем, что googleSheetUrl существует и не пустая строка
        let sheetUrl: string | null = null;
        if (config.googleSheetUrl) {
          if (typeof config.googleSheetUrl === 'string') {
            const trimmed = config.googleSheetUrl.trim();
            if (trimmed.length > 0) {
              sheetUrl = trimmed;
            }
          }
        }
        
        console.log('🏠 sheetUrl after processing:', sheetUrl);
        setGoogleSheetUrl(sheetUrl);
        console.log('🏠 googleSheetUrl state set to:', sheetUrl);
      } catch (error) {
        console.error('Error getting config in Home:', error);
      }
    };

    fetchConfig();
  }, []);

  // Отслеживаем изменения googleSheetUrl для отладки
  useEffect(() => {
    console.log('🔍 googleSheetUrl state changed to:', googleSheetUrl);
  }, [googleSheetUrl]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        console.log('📊 Fetching stats from backend:', backendUrl);
        
        const [students, lecturesData, homeworkData, pendingReviews, teachers, allReviews] = await Promise.all([
          studentsApi.getAll(),
          lecturesApi.getAll(),
          homeworkApi.getAll(),
          homeworkReviewApi.getPending(),
          teachersApi.getAll(),
          homeworkReviewApi.getAll(),
        ]);

        setLectures(lecturesData);
        setHomeworks(homeworkData);

        // Подсчитываем студентов с работами (уникальные student_id из reviews)
        const studentsWithWorkSet = new Set(allReviews.map(review => review.student.id));
        const studentsWithWork = studentsWithWorkSet.size;
        const studentsWithoutWork = students.length - studentsWithWork;

        setStats({
          students: students.length,
          lectures: lecturesData.length,
          homework: homeworkData.length,
          pendingReviews: pendingReviews.length,
          teachers: teachers.length,
          studentsWithWork,
          studentsWithoutWork,
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
    {
      title: 'Студенты сдавшие хотя бы одну работу',
      value: stats.studentsWithWork,
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'bg-green-600',
      href: '/students',
    },
    {
      title: 'Студенты не сдавшие ни одной работы',
      value: stats.studentsWithoutWork,
      icon: <XCircle className="w-6 h-6" />,
      color: 'bg-red-600',
      href: '/students',
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Панель управления
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Обзор системы управления студентами и лекциями
          </p>
        </div>

        {/* Ribbon с быстрыми действиями */}
        <div className="mb-8 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mr-2">Быстрые действия:</span>
            <ImportButton />
            <ExportButton />
            <GoogleSheetExportButton />
            <GoogleSheetImportButton />
            <a
              href={googleSheetUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors"
              title="Открыть Google Sheet в новой вкладке"
            >
              <FileSpreadsheet className="w-3 h-3 mr-1.5" />
              Открыть Sheet
              <ExternalLink className="w-3 h-3 ml-1.5" />
            </a>
          </div>
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

        <div className="mt-8">
          <Calendar lectures={lectures} homeworks={homeworks} />
        </div>
      </div>
    </div>
  );
}
