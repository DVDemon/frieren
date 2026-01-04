from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, TypedDict
import logging
import os
import tempfile
import subprocess
import shutil
import asyncio
from datetime import datetime
from openai import AsyncOpenAI
from models import HomeworkReviewInfo, HomeworkReviewCreate, HomeworkReviewUpdate
from database import get_db, HomeworkReview, Student, StudentHomeworkVariant, Homework, TeacherGroup

os.environ['OPENAI_API_KEY'] = 'sk-66b5617dda7b43e686f2181235699141'

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/homework_review", tags=["homework_review"])

@router.get("/", response_model=List[HomeworkReviewInfo])
@router.get("", response_model=List[HomeworkReviewInfo])
def get_homework_reviews(db: Session = Depends(get_db)):
    logger.info("GET /api/homework_review - Retrieving all homework reviews")
    homework_reviews = db.query(HomeworkReview).all()
    result = []
    work_map = dict() # {student_id,work_number} -> HomeworkReviewInfo
    for rec in homework_reviews:
        student = db.query(Student).filter(Student.id == rec.student_id, Student.is_deleted == False).first()
        if student:
            # Получаем информацию о варианте домашнего задания
            # Сначала находим ID домашнего задания по номеру
            homework = db.query(Homework).filter(Homework.number == rec.number).first()
            variant_number = None
            if homework:
                variant = db.query(StudentHomeworkVariant).filter(
                    StudentHomeworkVariant.student_id == rec.student_id,
                    StudentHomeworkVariant.homework_id == homework.id
                ).first()
                variant_number = variant.variant_number if variant else None
            
            status = f"{student.id:>16}_{rec.number:>4}"

            review = HomeworkReviewInfo(
                id = rec.id,
                number=rec.number,
                send_date =rec.send_date,
                review_date =rec.review_date,
                url = rec.url,
                result = rec.result,
                comments = rec.comments,
                local_directory = rec.local_directory,
                ai_percentage = rec.ai_percentage,
                variant_number = variant_number,
                student={
                    'id' : student.id,
                    'year': student.year,
                    'full_name': student.full_name,
                    'telegram': student.telegram,
                    'github': student.github,
                    'group_number': student.group_number,
                    'chat_id': student.chat_id,
                    'is_deleted': student.is_deleted
                }
            )

            if status in work_map:
                if review["result"] > work_map[status]["result"]:
                    work_map[status] = review
                else:
                    if review["send_date"] and work_map[status]["send_date"] and review["send_date"] > work_map[status]["send_date"]:
                        work_map[status] = review
            else:
                work_map[status] = review

    for val in work_map.values():
        result.append(val)
        
    logger.info(f"GET /api/homework_review - Retrieved {len(result)} homework reviews")
    return result

@router.get("/pending", response_model=List[HomeworkReviewInfo])
def get_pending_homework_reviews(db: Session = Depends(get_db)):
    logger.info("GET /api/homework_review/pending - Retrieving pending homework reviews")
    # Получаем работы где review_date пустой или null
    homework_reviews = db.query(HomeworkReview).all()
    # filter(
    #     (HomeworkReview.result == 0) | (HomeworkReview.result is None)
    # ).all()
    result = []




    work_map = dict() # {student_id,work_number} -> HomeworkReviewInfo
    for rec in homework_reviews:
        student = db.query(Student).filter(Student.id == rec.student_id, Student.is_deleted == False).first()
        if student:
            # Получаем информацию о варианте домашнего задания
            # Сначала находим ID домашнего задания по номеру
            homework = db.query(Homework).filter(Homework.number == rec.number).first()
            variant_number = None
            if homework:
                variant = db.query(StudentHomeworkVariant).filter(
                    StudentHomeworkVariant.student_id == rec.student_id,
                    StudentHomeworkVariant.homework_id == homework.id
                ).first()
                variant_number = variant.variant_number if variant else None


            status = f"{student.id:>16}_{rec.number:>4}"

            review = HomeworkReviewInfo(
                id = rec.id,
                number=rec.number,
                send_date =rec.send_date,
                review_date =rec.review_date,
                url = rec.url,
                result = rec.result,
                comments = rec.comments,
                local_directory = rec.local_directory,
                ai_percentage = rec.ai_percentage,
                variant_number = variant_number,
                student={
                    'id' : student.id,
                    'year': student.year,
                    'full_name': student.full_name,
                    'telegram': student.telegram,
                    'github': student.github,
                    'group_number': student.group_number,
                    'chat_id': student.chat_id,
                    'is_deleted': student.is_deleted
                }
            )

            if status in work_map:
                if review["result"] > work_map[status]["result"]:
                    work_map[status] = review
                else:
                    if review["send_date"] and work_map[status]["send_date"] and review["send_date"] > work_map[status]["send_date"]:
                        work_map[status] = review
                
            else:
                work_map[status] = review

            
    for val in work_map.values():
        if val["result"] == 0:
            result.append(val)

    logger.info(f"GET /api/homework_review/pending - Retrieved {len(result)} pending homework reviews")
    return result

@router.get("/pending-by-teacher/{teacher_id}", response_model=List[HomeworkReviewInfo])
def get_pending_homework_reviews_by_teacher(teacher_id: int, db: Session = Depends(get_db)):
    logger.info(f"GET /api/homework_review/pending-by-teacher/{teacher_id} - Retrieving pending homework reviews by teacher")

    # 1. Находим группы, которые ведет данный преподаватель
    teacher_groups = db.query(TeacherGroup).filter(
        TeacherGroup.teacher_id == teacher_id
    ).all()
    
    if not teacher_groups:
        logger.info(f"GET /api/homework_review/pending-by-teacher/{teacher_id} - No groups found for teacher")
        return []
    
    # Получаем номера групп
    group_numbers = [tg.group_number for tg in teacher_groups]
    logger.info(f"GET /api/homework_review/pending-by-teacher/{teacher_id} - Teacher groups: {group_numbers}")
    
    # 2. Находим студентов из этих групп
    students = db.query(Student).filter(
        Student.group_number.in_(group_numbers),
        Student.is_deleted == False
    ).all()
    
    if not students:
        logger.info(f"GET /api/homework_review/pending-by-teacher/{teacher_id} - No students found in teacher groups")
        return []
    
    student_ids = [student.id for student in students]
    logger.info(f"GET /api/homework_review/pending-by-teacher/{teacher_id} - Students in groups: {student_ids}")
    
    # 3. Находим домашние задания этих студентов на проверку (где review_date пустой или null)
    homework_reviews = db.query(HomeworkReview).filter(
        HomeworkReview.student_id.in_(student_ids),
        (HomeworkReview.review_date.is_(None)) | (HomeworkReview.review_date == "")
    ).all()
    
    result = []
    work_map = dict() # {student_id,work_number} -> HomeworkReviewInfo
    for rec in homework_reviews:
        student = db.query(Student).filter(Student.id == rec.student_id, Student.is_deleted == False).first()
        if student:
            # Получаем информацию о варианте домашнего задания
            # Сначала находим ID домашнего задания по номеру
            homework = db.query(Homework).filter(Homework.number == rec.number).first()
            variant_number = None
            if homework:
                variant = db.query(StudentHomeworkVariant).filter(
                    StudentHomeworkVariant.student_id == rec.student_id,
                    StudentHomeworkVariant.homework_id == homework.id
                ).first()
                variant_number = variant.variant_number if variant else None
            
            status = f"{student.id:>16}_{rec.number:>4}"

            review =HomeworkReviewInfo(
                id = rec.id,
                number=rec.number,
                send_date =rec.send_date,
                review_date =rec.review_date,
                url = rec.url,
                result = rec.result,
                comments = rec.comments,
                local_directory = rec.local_directory,
                ai_percentage = rec.ai_percentage,
                variant_number = variant_number,
                student={
                    'id' : student.id,
                    'year': student.year,
                    'full_name': student.full_name,
                    'telegram': student.telegram,
                    'github': student.github,
                    'group_number': student.group_number,
                    'chat_id': student.chat_id,
                    'is_deleted': student.is_deleted
                }
            )

            if status in work_map:
                if review["result"] > work_map[status]["result"]:
                    work_map[status] = review
                else:
                    if review["send_date"] and work_map[status]["send_date"] and review["send_date"] > work_map[status]["send_date"]:
                        work_map[status] = review
            else:
                work_map[status] = review
    
    for val in work_map.values():
        if val["result"] == 0:
            result.append(val)
    
    logger.info(f"GET /api/homework_review/pending-by-teacher/{teacher_id} - Retrieved {len(result)} pending homework reviews")
    return result

@router.get("/by-telegram/{telegram}", response_model=List[HomeworkReviewInfo])
def get_homework_reviews_by_telegram(telegram: str, db: Session = Depends(get_db)):
    logger.info(f"GET /api/homework_review/by-telegram/{telegram} - Retrieving homework reviews by student telegram")
    
    # Находим студента по telegram
    student = db.query(Student).filter(
        Student.telegram == telegram,
        Student.is_deleted == False
    ).first()
    
    if not student:
        logger.info(f"GET /api/homework_review/by-telegram/{telegram} - Student not found with telegram: {telegram}")
        return []
    
    logger.info(f"GET /api/homework_review/by-telegram/{telegram} - Found student: {student.full_name} (ID: {student.id})")
    
    # Получаем все homework reviews для этого студента
    homework_reviews = db.query(HomeworkReview).filter(
        HomeworkReview.student_id == student.id
    ).all()
    
    result = []
    work_map = dict() # {student_id,work_number} -> HomeworkReviewInfo
    
    for rec in homework_reviews:
        # Получаем информацию о варианте домашнего задания
        # Сначала находим ID домашнего задания по номеру
        homework = db.query(Homework).filter(Homework.number == rec.number).first()
        variant_number = None
        if homework:
            variant = db.query(StudentHomeworkVariant).filter(
                StudentHomeworkVariant.student_id == rec.student_id,
                StudentHomeworkVariant.homework_id == homework.id
            ).first()
            variant_number = variant.variant_number if variant else None
        
        status = f"{student.id:>16}_{rec.number:>4}"

        review =HomeworkReviewInfo(
            id = rec.id,
            number=rec.number,
            send_date =rec.send_date,
            review_date =rec.review_date,
            url = rec.url,
            result = rec.result,
            comments = rec.comments,
            local_directory = rec.local_directory,
            ai_percentage = rec.ai_percentage,
            variant_number = variant_number,
            student={
                'id' : student.id,
                'year': student.year,
                'full_name': student.full_name,
                'telegram': student.telegram,
                'github': student.github,
                'group_number': student.group_number,
                'chat_id': student.chat_id,
                'is_deleted': student.is_deleted
            }
        )

        if status in work_map:
            if review["result"] > work_map[status]["result"]:
                work_map[status] = review
            else:
                if review["send_date"] and work_map[status]["send_date"] and review["send_date"] > work_map[status]["send_date"]:
                    work_map[status] = review
        else:
            work_map[status] = review
    
    for val in work_map.values():
        result.append(val)
    
    logger.info(f"GET /api/homework_review/by-telegram/{telegram} - Retrieved {len(result)} homework reviews")
    return result

@router.post("/", response_model=HomeworkReviewInfo)
@router.post("", response_model=HomeworkReviewInfo)
def add_homework_review(att: HomeworkReviewCreate, db: Session = Depends(get_db)):
    logger.info(f"POST /api/homework_review - Adding new homework review for student_id: {att['student_id']}, homework_number: {att['number']}")
    db_att = HomeworkReview(
        student_id=att['student_id'],
        number = att['number'],
        send_date = att['send_date'],
        review_date = att['review_date'] if att['review_date'] else None,
        url = att['url'],
        result = att['result'],
        comments = att['comments']
    )
    db.add(db_att)
    db.commit()
    db.refresh(db_att)
    student = db.query(Student).filter(Student.id == db_att.student_id, Student.is_deleted == False).first()
    if not student:
        logger.warning(f"POST /api/homework_review - Student not found for ID: {db_att.student_id}")
        raise HTTPException(status_code=404, detail="Student not found")
    
    logger.info(f"POST /api/homework_review - Successfully added homework review with ID: {db_att.id}")

    # Получаем информацию о варианте домашнего задания
    # Сначала находим ID домашнего задания по номеру
    homework = db.query(Homework).filter(Homework.number == db_att.number).first()
    variant_number = None
    if homework:
        variant = db.query(StudentHomeworkVariant).filter(
            StudentHomeworkVariant.student_id == db_att.student_id,
            StudentHomeworkVariant.homework_id == homework.id
        ).first()
        variant_number = variant.variant_number if variant else None

    return HomeworkReviewInfo(
                id = db_att.id,
                number=db_att.number,
                send_date =db_att.send_date,
                review_date =db_att.review_date,
                url = db_att.url,
                result = db_att.result,
                comments = db_att.comments,
                local_directory = db_att.local_directory,
                ai_percentage = db_att.ai_percentage,
                variant_number = variant_number,
                student={
                    'id' : student.id,
                    'year': student.year,
                    'full_name': student.full_name,
                    'telegram': student.telegram,
                    'github': student.github,
                    'group_number': student.group_number,
                    'chat_id': student.chat_id,
                    'is_deleted': student.is_deleted
                }
            )

@router.put("/{homework_review_id}", response_model=HomeworkReviewInfo)
def update_homework_review(homework_review_id: int, att: HomeworkReviewUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/homework_review/{homework_review_id} - Updating homework review")
    db_att = db.query(HomeworkReview).filter(HomeworkReview.id == homework_review_id).first()
    if not db_att:
        logger.warning(f"PUT /api/homework_review/{homework_review_id} - HomeworkReview record not found")
        raise HTTPException(status_code=404, detail="HomeworkReview record not found")
    for key, value in att.items():
        # Исключаем student_id из обновления, так как это связь с другой таблицей
        if key == 'student_id':
            continue
        elif key in ['review_date', 'ai_percentage']:
            # Для этих полей разрешаем None и пустые строки
            if value == "":
                setattr(db_att, key, None)
            else:
                setattr(db_att, key, value)
        elif value is not None:
            # Для остальных полей только не-None значения
            setattr(db_att, key, value)
    db.commit()
    db.refresh(db_att)
    student = db.query(Student).filter(Student.id == db_att.student_id).first()
    if not student:
        logger.warning(f"PUT /api/homework_review/{homework_review_id} - Student not found for ID: {db_att.student_id}")
        raise HTTPException(status_code=404, detail="Student not found")
    
    logger.info(f"PUT /api/homework_review/{homework_review_id} - Successfully updated homework review")

    # Получаем информацию о варианте домашнего задания
    # Сначала находим ID домашнего задания по номеру
    homework = db.query(Homework).filter(Homework.number == db_att.number).first()
    variant_number = None
    if homework:
        variant = db.query(StudentHomeworkVariant).filter(
            StudentHomeworkVariant.student_id == db_att.student_id,
            StudentHomeworkVariant.homework_id == homework.id
        ).first()
        variant_number = variant.variant_number if variant else None

    return HomeworkReviewInfo(
                id = db_att.id,
                number=db_att.number,
                send_date =db_att.send_date,
                review_date =db_att.review_date,
                url = db_att.url,
                result = db_att.result,
                comments = db_att.comments,
                local_directory = db_att.local_directory,
                ai_percentage = db_att.ai_percentage,
                variant_number = variant_number,
                student={
                    'id' : student.id,
                    'year': student.year,
                    'full_name': student.full_name,
                    'telegram': student.telegram,
                    'github': student.github,
                    'group_number': student.group_number,
                    'chat_id': student.chat_id,
                    'is_deleted': student.is_deleted
                }
            )

@router.post("/{homework_review_id}/download", response_model=HomeworkReviewInfo)
def download_homework_project(homework_review_id: int, db: Session = Depends(get_db)):
    logger.info(f"POST /api/homework_review/{homework_review_id}/download - Downloading homework project")
    
    # Получаем запись о домашней работе
    db_att = db.query(HomeworkReview).filter(HomeworkReview.id == homework_review_id).first()
    if not db_att:
        logger.warning(f"POST /api/homework_review/{homework_review_id}/download - HomeworkReview record not found")
        raise HTTPException(status_code=404, detail="HomeworkReview record not found")
    
    # Проверяем, что URL является GitHub репозиторием
    if not db_att.url or "github.com" not in db_att.url:
        logger.warning(f"POST /api/homework_review/{homework_review_id}/download - Invalid GitHub URL: {db_att.url}")
        raise HTTPException(status_code=400, detail="URL must be a valid GitHub repository")
    
    try:
        # Создаем временную директорию для проекта
        temp_dir = tempfile.mkdtemp(prefix=f"homework_{homework_review_id}_")
        
        # Формируем имя директории на основе ID и даты
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        project_name = f"homework_{homework_review_id}_{timestamp}"
        
        # Клонируем репозиторий
        logger.info(f"POST /api/homework_review/{homework_review_id}/download - Cloning repository: {db_att.url}")
        result = subprocess.run(
            ["git", "clone", db_att.url, project_name],
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=300  # 5 минут таймаут
        )
        
        if result.returncode != 0:
            logger.error(f"POST /api/homework_review/{homework_review_id}/download - Git clone failed: {result.stderr}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=f"Failed to clone repository: {result.stderr}")
        
        # Полный путь к скачанному проекту
        project_path = os.path.join(temp_dir, project_name)
        
        # Проверяем, что директория существует и не пустая
        if not os.path.exists(project_path) or not os.listdir(project_path):
            logger.error(f"POST /api/homework_review/{homework_review_id}/download - Project directory is empty or does not exist")
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail="Project directory is empty or does not exist")
        
        # Обновляем запись в базе данных
        db_att.local_directory = project_path
        db.commit()
        db.refresh(db_att)
        
        # Получаем информацию о студенте
        student = db.query(Student).filter(Student.id == db_att.student_id).first()
        
        logger.info(f"POST /api/homework_review/{homework_review_id}/download - Successfully downloaded project to: {project_path}")
        
        # Получаем информацию о варианте домашнего задания
        # Сначала находим ID домашнего задания по номеру
        homework = db.query(Homework).filter(Homework.number == db_att.number).first()
        variant_number = None
        if homework:
            variant = db.query(StudentHomeworkVariant).filter(
                StudentHomeworkVariant.student_id == db_att.student_id,
                StudentHomeworkVariant.homework_id == homework.id
            ).first()
            variant_number = variant.variant_number if variant else None
        
        return HomeworkReviewInfo(
            id = db_att.id,
            number=db_att.number,
            send_date =db_att.send_date,
            review_date =db_att.review_date,
            url = db_att.url,
            result = db_att.result,
            comments = db_att.comments,
            local_directory = db_att.local_directory,
            ai_percentage = db_att.ai_percentage,
            variant_number = variant_number,
            student={
                'id' : student.id,
                'year': student.year,
                'full_name': student.full_name,
                'telegram': student.telegram,
                'github': student.github,
                'group_number': student.group_number,
                'chat_id': student.chat_id,
                'is_deleted': student.is_deleted
            }
        )
        
    except subprocess.TimeoutExpired:
        logger.error(f"POST /api/homework_review/{homework_review_id}/download - Git clone timeout")
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=408, detail="Repository download timeout")
    except Exception as e:
        logger.error(f"POST /api/homework_review/{homework_review_id}/download - Unexpected error: {str(e)}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.post("/{homework_review_id}/check-ai", response_model=dict)
async def check_ai_generated_code(homework_review_id: int, db: Session = Depends(get_db)):
    logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Checking for AI-generated code")
    
    # Получаем запись о домашней работе
    db_att = db.query(HomeworkReview).filter(HomeworkReview.id == homework_review_id).first()
    if not db_att:
        logger.warning(f"POST /api/homework_review/{homework_review_id}/check-ai - HomeworkReview record not found")
        raise HTTPException(status_code=404, detail="HomeworkReview record not found")
    
    # Проверяем, что локальная директория существует
    if not db_att.local_directory or not os.path.exists(db_att.local_directory):
        logger.warning(f"POST /api/homework_review/{homework_review_id}/check-ai - Local directory not found: {db_att.local_directory}")
        raise HTTPException(status_code=400, detail="Local directory not found. Please download the project first.")
    
    try:
        # Собираем все файлы из директории
        code_files = []
        for root, dirs, files in os.walk(db_att.local_directory):
            # Исключаем служебные директории
            dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', 'node_modules', '.vscode', '.idea']]
            
            for file in files:
                file_path = os.path.join(root, file)
                # Проверяем только текстовые файлы с кодом
                if file.endswith(('.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.html', '.css', '.scss', '.sass')):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            if content.strip():  # Проверяем, что файл не пустой
                                relative_path = os.path.relpath(file_path, db_att.local_directory)
                                code_files.append({
                                    'path': relative_path,
                                    'content': content
                                })
                    except Exception as e:
                        logger.warning(f"Could not read file {file_path}: {e}")
                        continue
        
        if not code_files:
            logger.warning(f"POST /api/homework_review/{homework_review_id}/check-ai - No code files found")
            raise HTTPException(status_code=400, detail="No code files found in the project")
        
        logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Found {len(code_files)} code files")
        
        # Инициализируем OpenAI клиент
        # Получаем API ключ из переменной окружения
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            logger.error("OPENAI_API_KEY environment variable not set")
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        client = AsyncOpenAI(api_key=openai_api_key,base_url="https://api.deepseek.com")
        
        # Проверяем каждый файл с помощью OpenAI API
        ai_percentages = []
        total_files = len(code_files)
        
        for i, file_info in enumerate(code_files):
            logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Checking file {i+1}/{total_files}: {file_info['path']}")
            
            # Подготавливаем промпт для OpenAI
            prompt = f"""Задача: Определить, был ли данный код написан человеком или сгенерирован AI. Проанализируйте следующие аспекты и приведите аргументированное объяснение:

Стиль и структура кода:

Использование или отсутствие комментариев.
Наличие избыточных или ненужных элементов (например, дублирующиеся импорты или переменные).
Стиль именования переменных, функций и классов. Совпадает ли стиль с типичными шаблонами, используемыми в AI-сгенерированном коде?
Структурная логика:

Есть ли в коде элементы, которые кажутся "по шаблону" или стандартизированными (например, функции с минимальной логикой, типичные фрагменты кода без оригинальных решений)?
Код содержит ли абстрактные или слишком обобщённые подходы, которые могут быть свойственны AI (например, использование большого количества внешних библиотек или абстракций)?
Проверка на типичные ошибки или недочёты:

Есть ли явные ошибки или недочёты, такие как дублирующиеся включения файлов, неиспользуемые переменные, избыточные вычисления или проверки (например, неправильное использование file.good() вместо более идиоматичных конструкций)?
Обратите внимание на возможные неточности в логике работы с файлами или сетевыми соединениями.
Стиль кодирования:

Насколько код структурирован и логичен с точки зрения человека? Например, неестественные или неинтуитивно понятные блоки кода могут указывать на AI.
Проверить, используются ли стандартные шаблоны кода, характерные для AI-генерации (например, код, построенный по типовым фрагментам документации, часто с минимальной логикой).
Отсутствие/наличие инновационности:

Наблюдается ли в коде оригинальность, нехарактерная для типичных примеров из документации? Это может быть признаком работы человека.
Или код более стандартен, похож на фрагменты из готовых шаблонов и примеров? Это может указывать на использование AI.
Задача: На основе вашего анализа укажите процентное соотношение вероятности, что код был написан человеком и сгенерирован AI. 

Score using weighted metrics:
- 0% = Clear human traits (context-specific hacks, natural inconsistencies)
- 50% = Ambiguous with AI indicators
- 100% = Strong AI patterns (template-like structure, robotic consistency)

Return ONLY the percentage (0-100) without any additional text.

File: {file_info['path']}
Code:
```
{file_info['content'][:4000]}  # Ограничиваем размер для API
```

Return only the percentage number, nothing else."""
            
            try:
                # Отправляем запрос в DeepSeek API
                response = await client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.1,
                    timeout=30
                )
                
                ai_percentage_text = response.choices[0].message.content.strip()
                logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Response: {ai_percentage_text}")
                
                # Извлекаем процент из ответа
                try:
                    # Убираем все символы кроме цифр и точки
                    ai_percentage = float(''.join(c for c in ai_percentage_text if c.isdigit() or c == '.'))
                    ai_percentage = max(0, min(100, ai_percentage))  # Ограничиваем от 0 до 100
                    ai_percentages.append({
                        'file': file_info['path'],
                        'ai_percentage': ai_percentage
                    })
                    logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - File {file_info['path']}: {ai_percentage}% AI")
                except ValueError:
                    logger.warning(f"POST /api/homework_review/{homework_review_id}/check-ai - Could not parse AI percentage for {file_info['path']}: {ai_percentage_text}")
                    ai_percentages.append({
                        'file': file_info['path'],
                        'ai_percentage': 0,
                        'error': f"Could not parse response: {ai_percentage_text}"
                    })
            
            except asyncio.TimeoutError:
                logger.error(f"POST /api/homework_review/{homework_review_id}/check-ai - Timeout for file {file_info['path']}")
                ai_percentages.append({
                    'file': file_info['path'],
                    'ai_percentage': 0,
                    'error': "Timeout"
                })
            except Exception as e:
                logger.error(f"POST /api/homework_review/{homework_review_id}/check-ai - Error checking file {file_info['path']}: {e}")
                ai_percentages.append({
                    'file': file_info['path'],
                    'ai_percentage': 0,
                    'error': str(e)
                })
        
        # Вычисляем общий процент AI-генерации
        valid_percentages = [item['ai_percentage'] for item in ai_percentages if 'error' not in item]
        overall_ai_percentage = sum(valid_percentages) / len(valid_percentages) if valid_percentages else 0
        
        # Сохраняем результат в базу данных
        logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Saving AI percentage to database: {round(overall_ai_percentage, 2)}%")
        db_att.ai_percentage = round(overall_ai_percentage, 2)
        db.commit()
        db.refresh(db_att)
        logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Successfully saved AI percentage to database")
        
        # Формируем результат
        result = {
            'homework_review_id': homework_review_id,
            'total_files': total_files,
            'overall_ai_percentage': round(overall_ai_percentage, 2),
            'files_checked': ai_percentages,
            'summary': {
                'high_ai_files': len([f for f in ai_percentages if f.get('ai_percentage', 0) > 70]),
                'medium_ai_files': len([f for f in ai_percentages if 30 < f.get('ai_percentage', 0) <= 70]),
                'low_ai_files': len([f for f in ai_percentages if f.get('ai_percentage', 0) <= 30])
            }
        }
        
        logger.info(f"POST /api/homework_review/{homework_review_id}/check-ai - Analysis complete. Overall AI percentage: {overall_ai_percentage:.2f}%")
        
        return result
        
    except Exception as e:
        logger.error(f"POST /api/homework_review/{homework_review_id}/check-ai - Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.delete("/{homework_review_id}", response_model=dict)
def delete_homework_review(homework_review_id: int, db: Session = Depends(get_db)):
    logger.info(f"DELETE /api/homework_review/{homework_review_id} - Hard deleting homework review")
    
    # Получаем запись о домашней работе
    db_att = db.query(HomeworkReview).filter(HomeworkReview.id == homework_review_id).first()
    if not db_att:
        logger.warning(f"DELETE /api/homework_review/{homework_review_id} - HomeworkReview record not found")
        raise HTTPException(status_code=404, detail="HomeworkReview record not found")
    
    try:
        # Удаляем локальную директорию проекта, если она существует
        if db_att.local_directory and os.path.exists(db_att.local_directory):
            logger.info(f"DELETE /api/homework_review/{homework_review_id} - Removing local directory: {db_att.local_directory}")
            shutil.rmtree(db_att.local_directory, ignore_errors=True)
        
        # Получаем информацию о студенте для логирования
        student = db.query(Student).filter(Student.id == db_att.student_id).first()
        student_name = student.full_name if student else f"Student ID {db_att.student_id}"
        
        # Удаляем запись из базы данных
        db.delete(db_att)
        db.commit()
        
        logger.info(f"DELETE /api/homework_review/{homework_review_id} - Successfully deleted homework review for student: {student_name}")
        
        return {
            "success": True,
            "message": f"Homework review {homework_review_id} has been permanently deleted",
            "deleted_review": {
                "id": homework_review_id,
                "student_name": student_name,
                "homework_number": db_att.number,
                "url": db_att.url
            }
        }
        
    except Exception as e:
        logger.error(f"DELETE /api/homework_review/{homework_review_id} - Error deleting homework review: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting homework review: {str(e)}")
