'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Student } from '@/types';
import StudentSearch from './StudentSearch';
import { MessageSquare, X } from 'lucide-react';

interface StudentChatSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentChatSelector({ isOpen, onClose }: StudentChatSelectorProps) {
  const router = useRouter();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    router.push(`/homework-review-chat/${student.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Чат со студентом
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <StudentSearch
            onStudentSelect={handleStudentSelect}
            selectedStudent={selectedStudent}
            placeholder="Начните вводить ФИО или Telegram студента..."
          />
        </div>
      </div>
    </div>
  );
}

