'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HomeworkReview, Student, Homework } from '@/types';
import { homeworkReviewApi, studentsApi, homeworkApi } from '@/lib/api';
import { 
  MessageSquare, 
  Send, 
  ExternalLink, 
  Brain, 
  Star, 
  Calendar, 
  Loader2,
  ArrowLeft,
  FileText,
  Github
} from 'lucide-react';

export default function HomeworkReviewChatPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.studentId as string);
  const [student, setStudent] = useState<Student | null>(null);
  const [reviews, setReviews] = useState<HomeworkReview[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<number>(0);
  const [editingComment, setEditingComment] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  useEffect(() => {
    scrollToBottom();
  }, [reviews]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentData, reviewsData, homeworksData] = await Promise.all([
        studentsApi.getAll().then(students => students.find(s => s.id === studentId)),
        homeworkReviewApi.getByStudent(studentId),
        homeworkApi.getAll()
      ]);
      
      if (!studentData) {
        setError('Студент не найден');
        return;
      }
      
      setStudent(studentData);
      setReviews(reviewsData.sort((a, b) => new Date(a.send_date).getTime() - new Date(b.send_date).getTime()));
      setHomeworks(homeworksData);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHomeworkExampleLink = (homeworkNumber: number): string | null => {
    const homework = homeworks.find(h => h.number === homeworkNumber);
    if (!homework || !homework.example_link) return null;
    
    // Возвращаем только ссылку из базы данных без изменений
    return homework.example_link;
  };

  const handleEditReview = (review: HomeworkReview) => {
    setEditingReviewId(review.id);
    setEditingGrade(review.result || 0);
    setEditingComment(review.comments || '');
  };

  const handleSaveReview = async (reviewId: number) => {
    try {
      setSaving(true);
      // review_date будет установлен автоматически на бэкенде при сохранении result
      const updateData = {
        result: editingGrade,
        comments: editingComment
      };
      
      const updatedReview = await homeworkReviewApi.update(reviewId, updateData);
      
      setReviews(prev => prev.map(r => r.id === reviewId ? updatedReview : r));
      setEditingReviewId(null);
      setEditingGrade(0);
      setEditingComment('');
    } catch (err) {
      setError('Ошибка при сохранении оценки');
      console.error('Error saving review:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditingGrade(0);
    setEditingComment('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  if (error && !student) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Заголовок */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </button>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Чат с {student?.full_name}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Группа: {student?.group_number}</span>
              <span>Telegram: {student?.telegram}</span>
              <span>GitHub: {student?.github}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Чат */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              История отправок и оценок
            </h2>
          </div>
          
          <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {reviews.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет отправок домашних заданий</p>
              </div>
            ) : (
              reviews.map((review) => {
                const isEditing = editingReviewId === review.id;
                const exampleLink = getHomeworkExampleLink(review.number);
                
                // Проверяем, есть ли оценка от преподавателя
                // Работа считается оцененной, если есть оценка (result не null и не undefined)
                const hasReview = review.result !== null && review.result !== undefined;
                
                // Проверяем, просрочена ли работа
                const homework = homeworks.find(h => h.number === review.number);
                let isOverdue = false;
                if (homework && review.send_date && homework.due_date) {
                  // Сравниваем только даты без времени
                  const sendDate = new Date(review.send_date);
                  const dueDate = new Date(homework.due_date);
                  // Устанавливаем время на начало дня для корректного сравнения
                  sendDate.setHours(0, 0, 0, 0);
                  dueDate.setHours(0, 0, 0, 0);
                  isOverdue = sendDate > dueDate;
                }
                
                return (
                  <div key={review.id} className="space-y-2">
                    {/* Сообщение от студента */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              Студент
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(review.send_date)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Домашнее задание №{review.number}
                            </span>
                            {review.variant_number && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Вариант {review.variant_number}
                              </span>
                            )}
                            {homework && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                isOverdue 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }`}>
                                {isOverdue ? '⚠️ Просрочено' : '✓ В срок'}
                              </span>
                            )}
                          </div>
                          
                          {review.url && (
                            <div>
                              <a
                                href={review.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all"
                              >
                                <Github className="w-4 h-4 mr-1 flex-shrink-0" />
                                <span className="truncate max-w-md">{review.url}</span>
                                <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                              </a>
                            </div>
                          )}
                          
                          {exampleLink && (
                            <div>
                              <a
                                href={exampleLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                {review.variant_number ? `Пример варианта ${review.variant_number}` : 'Пример задания'}
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                            </div>
                          )}
                          
                          {review.ai_percentage !== null && (
                            <div className="flex items-center space-x-2 text-sm">
                              <Brain className="w-4 h-4 text-purple-500" />
                              <span className="text-gray-700 dark:text-gray-300">
                                AI-генерация: 
                              </span>
                              <span className={`font-semibold ${
                                review.ai_percentage < 30 ? 'text-green-600 dark:text-green-400' :
                                review.ai_percentage < 70 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                              }`}>
                                {review.ai_percentage}%
                              </span>
                            </div>
                          )}
                          
                          {review.comments && !hasReview && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Комментарий студента:</span> {review.comments}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ответ преподавателя */}
                    {isEditing ? (
                      <div className="flex items-start space-x-3 ml-13">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Star className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Оценка (0-100)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editingGrade}
                                onChange={(e) => setEditingGrade(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Комментарий
                              </label>
                              <textarea
                                value={editingComment}
                                onChange={(e) => setEditingComment(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Введите комментарий..."
                              />
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveReview(review.id)}
                                disabled={saving}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Сохранение...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Сохранить
                                  </>
                                )}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start space-x-3 ml-13">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Star className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                          {hasReview ? (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    Преподаватель
                                  </span>
                                  {review.review_date && review.review_date.trim() && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatDate(review.review_date)}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleEditReview(review)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                >
                                  Редактировать
                                </button>
                              </div>
                              <div className="space-y-2">
                                {review.result !== null && review.result !== undefined && review.result > 0 && (
                                  <div className="flex items-center space-x-2 mb-2">
                                    <div className="flex items-center space-x-2 px-2 py-1 bg-green-100 dark:bg-green-800 rounded">
                                      <Star className="w-4 h-4 text-green-600 dark:text-green-400" />
                                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                        Работа оценена
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center space-x-2">
                                  <Star className="w-4 h-4 text-yellow-500" />
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    Оценка: {review.result}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                    Комментарий преподавателя:
                                  </div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                                    {review.comments && review.comments.trim() ? review.comments : <span className="text-gray-400 dark:text-gray-500 italic">Комментарий не оставлен</span>}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                Ожидает оценки
                              </span>
                              <button
                                onClick={() => handleEditReview(review)}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                              >
                                Оценить
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

