'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, User, Loader2 } from 'lucide-react';
import { studentsApi } from '@/lib/api';
import { Student } from '@/types';

interface StudentSearchProps {
  onStudentSelect: (student: Student) => void;
  selectedStudent?: Student | null;
  placeholder?: string;
  className?: string;
}

export default function StudentSearch({ 
  onStudentSelect, 
  selectedStudent, 
  placeholder = "Поиск студента по ФИО или Telegram...",
  className = ""
}: StudentSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Загружаем всех студентов при монтировании компонента
  useEffect(() => {
    const loadStudents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await studentsApi.getAll();
        setStudents(data);
      } catch (err) {
        setError('Ошибка при загрузке студентов');
        console.error('Error loading students:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudents();
  }, []);

  // Фильтруем студентов при изменении поискового запроса
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents([]);
      setShowDropdown(false);
      return;
    }

    const filtered = students.filter(student => 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.telegram.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredStudents(filtered.slice(0, 10)); // Ограничиваем до 10 результатов
    setShowDropdown(filtered.length > 0);
  }, [searchTerm, students]);

  // Обработка клика вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStudentSelect = (student: Student) => {
    onStudentSelect(student);
    setSearchTerm(student.full_name);
    setShowDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!e.target.value.trim()) {
      onStudentSelect(null as any);
    }
  };

  const handleInputFocus = () => {
    if (filteredStudents.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isLoading}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredStudents.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Студенты не найдены
            </div>
          ) : (
            <ul>
              {filteredStudents.map((student) => (
                <li
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-3"
                >
                  <User className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {student.full_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {student.telegram} • Группа: {student.group_number}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedStudent && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Выбран: {selectedStudent.full_name}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                {selectedStudent.telegram} • Группа: {selectedStudent.group_number}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
