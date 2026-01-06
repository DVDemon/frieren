// Студенты
export interface Student {
  id: number;
  year: number;
  full_name: string;
  telegram: string;
  github: string;
  group_number: string;
  chat_id?: number | null;  // Telegram chat ID (необязательное поле)
  is_deleted: boolean;
}

export interface StudentCreate {
  year: number;
  full_name: string;
  telegram: string;
  github: string;
  group_number: string;
  chat_id?: number | null;  // Telegram chat ID (необязательное поле)
}

export interface StudentUpdate {
  year?: number;
  full_name?: string;
  telegram?: string;
  github?: string;
  group_number?: string;
  chat_id?: number | null;  // Telegram chat ID (необязательное поле)
  is_deleted?: boolean;
}

// Лекции
export interface Lecture {
  id: number;
  number: number;
  topic: string;
  date: string;
  start_time?: string | null;  // Время начала лекции в формате HH:MM
  secret_code?: string | null;
  max_student?: number | null;
  github_example?: string | null;
  has_presentation: boolean;  // есть ли прикрепленная презентация
}

export interface LectureCreate {
  number: number;
  topic: string;
  date: string;
  start_time?: string | null;  // Время начала лекции в формате HH:MM
  secret_code?: string | null;
  max_student?: number | null;
  github_example?: string | null;
}

export interface LectureUpdate {
  number?: number;
  topic?: string;
  date?: string;
  start_time?: string | null;  // Время начала лекции в формате HH:MM
  secret_code?: string | null;
  max_student?: number | null;
  github_example?: string | null;
}

export interface LectureCapacityInfo {
  lecture_id: number;
  lecture_number: number;
  lecture_topic: string;
  max_student?: number | null;
  current_attendance: number;
  is_full: boolean;
  can_attend: boolean;
  remaining_slots?: number | null;
  start_time?: string | null;  // Время начала лекции в формате HH:MM
}

// Домашние задания
export interface Homework {
  id: number;
  number: number;
  due_date: string;
  short_description: string;
  example_link: string;
  assigned_date: string;
  variants_count: number;
}

export interface HomeworkCreate {
  number: number;
  due_date: string;
  short_description: string;
  example_link: string;
  assigned_date: string;
  variants_count: number;
}

export interface HomeworkUpdate {
  number?: number;
  due_date?: string;
  short_description?: string;
  example_link?: string;
  assigned_date?: string;
  variants_count?: number;
}

// Посещаемость
export interface Attendance {
  id: number;
  student: Student;
  lecture: Lecture;
  present: boolean;
}

export interface AttendanceCreate {
  student_id: number;
  lecture_id: number;
  present: boolean;
}

export interface AttendanceUpdate {
  student_id?: number;
  lecture_id?: number;
  present?: boolean;
}

// Проверка домашних заданий
export interface HomeworkReview {
  id: number;
  number: number;
  send_date: string;
  review_date: string | null;
  url: string;
  result: number | null;
  comments: string | null;
  local_directory: string | null;
  ai_percentage: number | null;
  variant_number: number | null;
  student: Student;
}

export interface HomeworkReviewCreate {
  student_id: number;
  number: number;
  send_date: string;
  review_date?: string;
  url: string;
  result?: number;
  comments?: string;
  local_directory?: string;
  ai_percentage?: number;
}

export interface HomeworkReviewUpdate {
  student_id?: number;
  number?: number;
  send_date?: string;
  review_date?: string;
  url?: string;
  result?: number;
  comments?: string;
  local_directory?: string;
  ai_percentage?: number;
}

// Преподаватели
export interface Teacher {
  id: number;
  full_name: string;
  telegram: string;
  is_deleted: boolean;
}

export interface TeacherCreate {
  full_name: string;
  telegram: string;
}

export interface TeacherUpdate {
  full_name?: string;
  telegram?: string;
  is_deleted?: boolean;
}

export interface TeacherGroup {
  id: number;
  teacher_id: number;
  group_number: string;
}

export interface TeacherGroupCreate {
  teacher_id: number;
  group_number: string;
}

export interface TeacherGroupUpdate {
  teacher_id?: number;
  group_number?: string;
}

export interface TeacherStats {
  teacher_id: number;
  total_reviews: number;
  pending_reviews: number;
}

// Варианты домашних заданий студентов
export interface StudentHomeworkVariant {
  id: number;
  student_id: number;
  homework_id: number;
  variant_number: number;
}

export interface StudentHomeworkVariantCreate {
  student_id: number;
  homework_id: number;
  variant_number: number;
}

export interface StudentHomeworkVariantUpdate {
  student_id?: number;
  homework_id?: number;
  variant_number?: number;
}

// Экзаменационные оценки
export interface ExamGrade {
  id: number;
  date: string;  // дата экзамена (ISO формат)
  grade: number;  // оценка за экзамен
  variant_number: number;  // номер варианта
  student_id: number;  // идентификатор студента
  student: Student;  // информация о студенте
  has_pdf: boolean;  // есть ли прикрепленный PDF
}

export interface ExamGradeCreate {
  date: string;  // дата экзамена (ISO формат)
  grade: number;  // оценка за экзамен
  variant_number: number;  // номер варианта
  student_id: number;  // идентификатор студента
}

export interface ExamGradeUpdate {
  date?: string;  // дата экзамена (ISO формат)
  grade?: number;  // оценка за экзамен
  variant_number?: number;  // номер варианта
  student_id?: number;  // идентификатор студента
}
