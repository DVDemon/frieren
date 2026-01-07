from sqlalchemy import create_engine, Column, Integer, String, Date, Float, Boolean, LargeBinary
from sqlalchemy.orm import sessionmaker, declarative_base, Session
import os

DB_USER = os.getenv("DB_USER", "frieren")
DB_PASSWORD = os.getenv("DB_PASSWORD", "frieren")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "frieren_db")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

#engine = create_engine(DATABASE_URL)
engine = create_engine(
    DATABASE_URL,
    pool_size=1000,
    max_overflow=25,
    pool_timeout=45,
    pool_recycle=1800,
    pool_use_lifo=True,     # использовать LIFO (последний вошел - первый вышел)
    pool_pre_ping=True,
    connect_args={
        'connect_timeout': 10  # таймаут установки соединения с БД
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    full_name = Column(String, nullable=False)
    telegram = Column(String, nullable=False)
    github = Column(String, nullable=False)
    group_number = Column(String, nullable=False)
    chat_id = Column(Integer, nullable=True)  # Telegram chat ID (необязательное поле)
    is_deleted = Column(Boolean, nullable=False, default=False)

class Lecture(Base):
    __tablename__ = "lectures"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False)
    topic = Column(String, nullable=False)
    date = Column(String, nullable=False)  # ISO string
    start_time = Column(String, nullable=True)  # Время начала лекции в формате HH:MM
    secret_code = Column(String, nullable=True)  # Секретный код для лекции
    max_student = Column(Integer, nullable=True)  # Максимальное количество студентов
    github_example = Column(String, nullable=True)  # Ссылка на пример в GitHub
    presentation_blob = Column(LargeBinary, nullable=True)  # Blob для хранения презентации (PDF/PPTX)

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False)
    lecture_id = Column(Integer, nullable=False)
    present = Column(Integer, nullable=False)  # 1 - присутствовал, 0 - нет

class Homework(Base):
    __tablename__ = "homework"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False)
    due_date = Column(String, nullable=False)
    short_description = Column(String, nullable=False)
    example_link = Column(String, nullable=False)
    assigned_date = Column(String, nullable=False)
    variants_count = Column(Integer, nullable=False, default=1)  # Количество вариантов
    is_same_variant = Column(Boolean, nullable=True, default=False)  # Использовать тот же вариант, что и у предыдущего задания

class HomeworkReview(Base):
    __tablename__ = "homework_review"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False)
    send_date = Column(String, nullable=False)
    review_date = Column(String, nullable=True)
    url = Column(String, nullable=False)
    result = Column(Integer, nullable=False)
    comments = Column(String, nullable=False)
    student_id = Column(Integer, nullable=False)
    local_directory = Column(String, nullable=True)  # Путь к локальной директории с проектом
    ai_percentage = Column(Float, nullable=True)  # Процент AI-генерации кода

class StudentHomeworkVariant(Base):
    __tablename__ = "student_homework_variants"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False)
    homework_id = Column(Integer, nullable=False)
    variant_number = Column(Integer, nullable=False)  # Номер варианта для данного студента

class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    telegram = Column(String, nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False)

class TeacherGroup(Base):
    __tablename__ = "teacher_groups"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, nullable=False)
    group_number = Column(String, nullable=False)

class ExamGrade(Base):
    __tablename__ = "exam_grades"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=False)  # ISO string format
    grade = Column(Integer, nullable=False)  # Оценка за экзамен
    variant_number = Column(Integer, nullable=False)  # Номер варианта
    student_id = Column(Integer, nullable=False)  # Идентификатор студента
    pdf_blob = Column(LargeBinary, nullable=True)  # Blob для хранения отсканированного PDF

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
