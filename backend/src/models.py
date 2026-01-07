from typing import TypedDict

class StudentInfo(TypedDict):
    id : int
    year: int  # год обучения
    full_name: str  # фамилия, имя и отчество одной строкой
    telegram: str  # телеграм аккаунт
    github: str  # github аккаунт
    group_number: str  # номер группы
    chat_id: int | None  # Telegram chat ID (необязательное поле)
    is_deleted: bool  # признак удаления

class StudentCreate(TypedDict):
    year: int
    full_name: str
    telegram: str
    github: str
    group_number: str
    chat_id: int | None  # Telegram chat ID (необязательное поле)

class StudentUpdate(TypedDict, total=False):
    year: int
    full_name: str
    telegram: str
    github: str
    group_number: str
    chat_id: int | None  # Telegram chat ID (необязательное поле)
    is_deleted: bool

class LectureInfo(TypedDict):
    id : int
    number: int  # номер лекции
    topic: str   # тема лекции
    date: str    # дата лекции (ISO формат)
    start_time: str | None  # время начала лекции в формате HH:MM
    secret_code: str | None  # секретный код лекции
    max_student: int | None  # максимальное количество студентов
    github_example: str | None  # ссылка на пример в GitHub
    has_presentation: bool  # есть ли прикрепленная презентация

class AttendanceInfo(TypedDict):
    id: int
    student: StudentInfo  # информация о студенте
    lecture: LectureInfo  # информация о лекции
    present: bool         # был ли студент на лекции

class LectureCreate(TypedDict):
    number: int
    topic: str
    date: str
    start_time: str | None
    secret_code: str | None
    max_student: int | None
    github_example: str | None

class LectureUpdate(TypedDict, total=False):
    number: int
    topic: str
    date: str
    start_time: str | None
    secret_code: str | None
    max_student: int | None
    github_example: str | None

class LectureCapacityInfo(TypedDict):
    lecture_id: int
    lecture_number: int
    lecture_topic: str
    max_student: int | None
    current_attendance: int
    is_full: bool
    can_attend: bool
    remaining_slots: int | None
    github_example: str | None
    start_time: str | None  # время начала лекции в формате HH:MM

class LectureCapacityUpdate(TypedDict):
    max_student: int | None

class AttendanceCreate(TypedDict):
    student_id: int
    lecture_id: int
    present: bool

class AttendanceUpdate(TypedDict, total=False):
    present: bool

class HomeworkInfo(TypedDict):
    id : int
    number: int
    due_date: str
    short_description: str
    example_link: str
    assigned_date: str
    variants_count: int
    is_same_variant: bool

class HomeworkCreate(TypedDict, total=False):
    number: int
    due_date: str
    short_description: str
    example_link: str
    assigned_date: str
    variants_count: int
    is_same_variant: bool

class HomeworkUpdate(TypedDict, total=False):
    
    number: int
    due_date: str
    short_description: str
    example_link: str
    assigned_date: str
    variants_count: int
    is_same_variant: bool

class HomeworkReviewInfo(TypedDict):

    id : int
    number: int
    send_date: str | None
    review_date: str | None
    url: str
    result: int
    comments: str
    local_directory: str | None
    ai_percentage: float | None  # Процент AI-генерации кода
    student: StudentInfo
    variant_number: int | None  # Номер варианта домашнего задания

class HomeworkReviewCreate(TypedDict):

    number: int
    send_date: str
    review_date: str | None
    url: str
    result: int
    comments: str
    student_id: int

class HomeworkReviewUpdate(TypedDict, total=False):

    number: int
    send_date: str
    review_date: str | None
    url: str
    result: int
    comments: str
    ai_percentage: float | None  # Процент AI-генерации кода

class HomeworkSubmissionInfo(TypedDict):
    id : int
    number: int
    send_date: str
    url: str
    comments: str
    student: StudentInfo

# Преподаватели
class TeacherInfo(TypedDict):
    id: int
    full_name: str
    telegram: str
    is_deleted: bool

class TeacherCreate(TypedDict):
    full_name: str
    telegram: str

class TeacherUpdate(TypedDict, total=False):
    full_name: str
    telegram: str
    is_deleted: bool

class TeacherGroupInfo(TypedDict):
    id: int
    teacher_id: int
    group_number: str

class TeacherGroupCreate(TypedDict):
    teacher_id: int
    group_number: str

class TeacherGroupUpdate(TypedDict, total=False):
    teacher_id: int
    group_number: str

class TeacherStatsInfo(TypedDict):
    teacher_id: int
    total_reviews: int  # Общее количество работ по группам преподавателя
    pending_reviews: int  # Количество непроверенных работ

# Варианты домашних заданий студентов
class StudentHomeworkVariantInfo(TypedDict):
    id: int
    student_id: int
    homework_id: int
    variant_number: int

class StudentHomeworkVariantCreate(TypedDict):
    student_id: int
    homework_id: int
    variant_number: int

class StudentHomeworkVariantUpdate(TypedDict, total=False):
    student_id: int
    homework_id: int
    variant_number: int

class StudentStatsInfo(TypedDict):
    student: StudentInfo  # информация о студенте
    total_homework_score: int  # суммарный балл за все homework_review
    ai_percentage: float | None  # средний балл за vibe coding
    attendance_count: int  # количество посещенных лекций

# Экзаменационные оценки
class ExamGradeInfo(TypedDict):
    id: int
    date: str  # дата экзамена (ISO формат)
    grade: int  # оценка за экзамен
    variant_number: int  # номер варианта
    student_id: int  # идентификатор студента
    student: StudentInfo  # информация о студенте
    has_pdf: bool  # есть ли прикрепленный PDF

class ExamGradeCreate(TypedDict):
    date: str  # дата экзамена (ISO формат)
    grade: int  # оценка за экзамен
    variant_number: int  # номер варианта
    student_id: int  # идентификатор студента

class ExamGradeUpdate(TypedDict, total=False):
    date: str  # дата экзамена (ISO формат)
    grade: int  # оценка за экзамен
    variant_number: int  # номер варианта
    student_id: int  # идентификатор студента