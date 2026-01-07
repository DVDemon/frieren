'use client';

import { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, BookOpen, BookText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Lecture, Homework } from '@/types';

interface CalendarEvent {
  date: Date;
  type: 'lecture' | 'homework';
  data: Lecture | Homework;
}

interface CalendarProps {
  lectures: Lecture[];
  homeworks: Homework[];
}

export default function Calendar({ lectures, homeworks }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Создаем события из лекций и домашних заданий
  const events = useMemo(() => {
    const calendarEvents: CalendarEvent[] = [];

    // Добавляем лекции
    lectures.forEach((lecture) => {
      const date = new Date(lecture.date);
      calendarEvents.push({
        date,
        type: 'lecture',
        data: lecture,
      });
    });

    // Добавляем дедлайны домашних заданий
    homeworks.forEach((homework) => {
      const date = new Date(homework.due_date);
      calendarEvents.push({
        date,
        type: 'homework',
        data: homework,
      });
    });

    return calendarEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [lectures, homeworks]);

  // Получаем первый и последний день текущего месяца
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Получаем события для конкретной даты
  const getEventsForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Переход к предыдущему месяцу
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Переход к следующему месяцу
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Переход к текущему месяцу
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Создаем массив дней для отображения
  const days = [];
  // Добавляем пустые ячейки для дней предыдущего месяца
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  // Добавляем дни текущего месяца
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <CalendarIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Календарь лекций и дедлайнов
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
          >
            Сегодня
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
      </div>

      {/* Легенда */}
      <div className="flex items-center space-x-4 mb-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Лекция</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Дедлайн ДЗ</span>
        </div>
      </div>

      {/* Календарная сетка */}
      <div className="grid grid-cols-7 gap-1">
        {/* Заголовки дней недели */}
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}

        {/* Дни месяца */}
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square"></div>;
          }

          const dayEvents = getEventsForDate(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day}
              className={`aspect-square border border-gray-200 dark:border-gray-700 rounded-md p-1 ${
                isCurrentDay
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                  : 'bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <div
                className={`text-sm font-medium mb-1 ${
                  isCurrentDay
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {day}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    className={`text-xs px-1 py-0.5 rounded truncate ${
                      event.type === 'lecture'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                    title={
                      event.type === 'lecture'
                        ? `Лекция ${(event.data as Lecture).number}: ${(event.data as Lecture).topic}`
                        : `ДЗ ${(event.data as Homework).number}: ${(event.data as Homework).short_description}`
                    }
                  >
                    {event.type === 'lecture' ? (
                      <div className="flex items-center space-x-1">
                        <BookOpen className="w-3 h-3" />
                        <span>Лекция {(event.data as Lecture).number}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <BookText className="w-3 h-3" />
                        <span>ДЗ {(event.data as Homework).number}</span>
                      </div>
                    )}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Список предстоящих событий */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Ближайшие события
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {events
            .filter((event) => {
              const eventDate = new Date(event.date);
              return eventDate >= new Date(new Date().setHours(0, 0, 0, 0));
            })
            .slice(0, 10)
            .map((event, index) => {
              const eventDate = new Date(event.date);
              const isLecture = event.type === 'lecture';
              const data = event.data as Lecture | Homework;

              return (
                <div
                  key={index}
                  className={`flex items-start space-x-3 p-3 rounded-md border ${
                    isLecture
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className={`p-2 rounded-md ${
                    isLecture
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'bg-red-100 dark:bg-red-900'
                  }`}>
                    {isLecture ? (
                      <BookOpen className={`w-4 h-4 ${
                        isLecture
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-red-700 dark:text-red-300'
                      }`} />
                    ) : (
                      <BookText className={`w-4 h-4 ${
                        isLecture
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-red-700 dark:text-red-300'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {isLecture
                          ? `Лекция ${(data as Lecture).number}: ${(data as Lecture).topic}`
                          : `ДЗ ${(data as Homework).number}: ${(data as Homework).short_description}`}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                        {eventDate.toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {isLecture && (data as Lecture).start_time && (
                          <span className="ml-1">{(data as Lecture).start_time}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}






