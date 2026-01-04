'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  BookOpen,
  CheckCircle2,
  BarChart3,
  BookText,
  FileText,
  Clock,
  Home,
  GraduationCap,
  Hash,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Award
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useSidebar } from '@/contexts/SidebarContext';

const menu = [
  { href: '/', label: 'Главная', icon: <Home className="w-4 h-4" /> },
  { href: '/students', label: 'Студенты', icon: <Users className="w-4 h-4" /> },
  { href: '/teachers', label: 'Преподаватели', icon: <GraduationCap className="w-4 h-4" /> },
  { href: '/lectures', label: 'Лекции', icon: <BookOpen className="w-4 h-4" /> },
  { href: '/attendance', label: 'Посещаемость', icon: <CheckCircle2 className="w-4 h-4" /> },
  { href: '/attendance-chart', label: 'График посещаемости', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/homework-stats', label: 'Статистика успеваемости', icon: <TrendingUp className="w-4 h-4" /> },
  { href: '/homework', label: 'Домашние задания', icon: <BookText className="w-4 h-4" /> },
  { href: '/homework-variants', label: 'Варианты ДЗ', icon: <Hash className="w-4 h-4" /> },
  { href: '/homework-review', label: 'Проверка ДЗ', icon: <FileText className="w-4 h-4" /> },
  { href: '/pending-reviews', label: 'Работы на проверку', icon: <Clock className="w-4 h-4" /> },
  { href: '/exam-grades', label: 'Оценки за экзамен', icon: <Award className="w-4 h-4" /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  
  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 shadow-sm z-50 overflow-y-auto transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-60'
    }`}>
      <div className={`flex items-center justify-between border-b border-gray-200 dark:border-slate-700 transition-all duration-300 ${
        isCollapsed ? 'p-2' : 'p-4'
      }`}>
        {!isCollapsed && (
          <Link href="/" className="flex items-center space-x-3 flex-1">
            <img
              src="/resources/frieren_icon.png"
              alt="Frieren"
              width={48}
              height={48}
              className="rounded"
            />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Frieren</span>
          </Link>
        )}
        {isCollapsed && (
          <Link href="/" className="flex items-center justify-center">
            <img
              src="/resources/frieren_icon.png"
              alt="Frieren"
              width={32}
              height={32}
              className="rounded"
            />
          </Link>
        )}
        <div className="flex items-center gap-2">
          {!isCollapsed && <ThemeToggle />}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>
      <nav className={`transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {menu.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center rounded-md text-sm font-medium transition-colors group ${
              isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-3 py-2'
            } ${
              pathname === href
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
            title={isCollapsed ? label : undefined}
          >
            <span className={isCollapsed ? '' : 'flex-shrink-0'}>{icon}</span>
            {!isCollapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
