from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, DataError, OperationalError
from sqlalchemy import func
from typing import List, Dict
import logging
from models import StudentInfo, StudentCreate, StudentUpdate, StudentStatsInfo
from database import get_db, Student, HomeworkReview, Attendance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["students"])

@router.get("/", response_model=List[StudentInfo])
@router.get("", response_model=List[StudentInfo])  # Дублируем роут без trailing slash
def get_students(db: Session = Depends(get_db)):
    logger.info("GET /api/students - Retrieving all students")
    students = db.query(Student).filter(Student.is_deleted == False).all()
    logger.info(f"GET /api/students - Retrieved {len(students)} students")
    return [StudentInfo(
        id = s.id,
        year=s.year,
        full_name=s.full_name,
        telegram=s.telegram,
        github=s.github,
        group_number=s.group_number,
        chat_id=s.chat_id,
        is_deleted=s.is_deleted
    ) for s in students]

@router.post("/", response_model=StudentInfo)
@router.post("", response_model=StudentInfo)  # Дублируем роут без trailing slash
def add_student(student: StudentCreate, db: Session = Depends(get_db)):
    try:
        # Преобразуем TypedDict в словарь для безопасной работы
        student_dict = dict(student) if isinstance(student, dict) else student
        logger.info(f"POST /api/students - Adding new student: {student_dict.get('full_name', 'Unknown')}")
        
        # Проверка на существующего студента с таким telegram
        existing_student = db.query(Student).filter(
            Student.telegram == student_dict.get('telegram'),
            Student.is_deleted == False
        ).first()
        if existing_student:
            logger.warning(f"POST /api/students - Student with telegram {student_dict.get('telegram')} already exists")
            raise HTTPException(
                status_code=400,
                detail=f"Student with telegram {student_dict.get('telegram')} already exists"
            )
        
        db_student = Student(**student_dict)
        db.add(db_student)
        db.commit()
        db.refresh(db_student)
        logger.info(f"POST /api/students - Successfully added student with ID: {db_student.id}")
        return StudentInfo(
            id = db_student.id,
            year=db_student.year,
            full_name=db_student.full_name,
            telegram=db_student.telegram,
            github=db_student.github,
            group_number=db_student.group_number,
            chat_id=db_student.chat_id,
            is_deleted=db_student.is_deleted
        )
    except HTTPException:
        # Пробрасываем HTTPException дальше
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"POST /api/students - Database integrity error: {e}")
        # Проверяем, является ли это ошибкой дубликата
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'unique' in error_msg.lower() or 'duplicate' in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail="Student with this telegram or other unique field already exists"
            )
        raise HTTPException(
            status_code=400,
            detail="Database integrity error. Please check your data."
        )
    except (DataError, OperationalError) as e:
        db.rollback()
        logger.error(f"POST /api/students - Database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred. Please try again later."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"POST /api/students - Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error. Please try again later."
        )

@router.put("/{student_id}", response_model=StudentInfo)
def update_student(student_id: int, student: StudentUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/students/{student_id} - Updating student")
    db_student = db.query(Student).filter(Student.id == student_id).first()
    if not db_student:
        logger.warning(f"PUT /api/students/{student_id} - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    for key, value in student.items():
        if value is not None:
            setattr(db_student, key, value)
    db.commit()
    db.refresh(db_student)
    logger.info(f"PUT /api/students/{student_id} - Successfully updated student")
    return StudentInfo(
        id = db_student.id,
        year=db_student.year,
        full_name=db_student.full_name,
        telegram=db_student.telegram,
        github=db_student.github,
        group_number=db_student.group_number,
        chat_id=db_student.chat_id,
        is_deleted=db_student.is_deleted
    )

@router.get("/by-telegram/{telegram}", response_model=StudentInfo)
def get_student_by_telegram(telegram: str, db: Session = Depends(get_db)):
    logger.info(f"GET /api/students/by-telegram/{telegram} - Searching for student by telegram")
    student = db.query(Student).filter(Student.telegram == telegram, Student.is_deleted == False).first()
    if not student:
        logger.warning(f"GET /api/students/by-telegram/{telegram} - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    logger.info(f"GET /api/students/by-telegram/{telegram} - Found student: {student.full_name}")
    return StudentInfo(
        id=student.id,
        year=student.year,
        full_name=student.full_name,
        telegram=student.telegram,
        github=student.github,
        group_number=student.group_number,
        chat_id=student.chat_id,
        is_deleted=student.is_deleted
    )

@router.put("/by-telegram/{telegram}/chat-id", response_model=StudentInfo)
def update_student_chat_id(telegram: str, chat_id: int, db: Session = Depends(get_db)):
    """
    Обновляет chat_id студента по его telegram username.
    Может быть вызван с chat_id в query параметре или в теле запроса.
    """
    logger.info(f"PUT /api/students/by-telegram/{telegram}/chat-id - Updating chat_id for student")
    db_student = db.query(Student).filter(Student.telegram == telegram, Student.is_deleted == False).first()
    if not db_student:
        logger.warning(f"PUT /api/students/by-telegram/{telegram}/chat-id - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Обновляем chat_id только если он изменился
    if db_student.chat_id != chat_id:
        db_student.chat_id = chat_id
        db.commit()
        db.refresh(db_student)
        logger.info(f"PUT /api/students/by-telegram/{telegram}/chat-id - Successfully updated chat_id for student: {db_student.full_name} (new chat_id: {chat_id})")
    else:
        logger.debug(f"PUT /api/students/by-telegram/{telegram}/chat-id - chat_id unchanged for student: {db_student.full_name}")
    
    return StudentInfo(
        id=db_student.id,
        year=db_student.year,
        full_name=db_student.full_name,
        telegram=db_student.telegram,
        github=db_student.github,
        group_number=db_student.group_number,
        chat_id=db_student.chat_id,
        is_deleted=db_student.is_deleted
    )

@router.put("/by-telegram/{telegram}/chat-id-body", response_model=StudentInfo)
def update_student_chat_id_body(telegram: str, request_data: Dict[str, int] = Body(...), db: Session = Depends(get_db)):
    """
    Обновляет chat_id студента по его telegram username.
    Принимает chat_id в теле запроса в формате JSON: {"chat_id": 123456789}
    """
    chat_id = request_data.get('chat_id')
    if chat_id is None:
        raise HTTPException(status_code=400, detail="chat_id is required in request body")
    
    logger.info(f"PUT /api/students/by-telegram/{telegram}/chat-id-body - Updating chat_id for student")
    db_student = db.query(Student).filter(Student.telegram == telegram, Student.is_deleted == False).first()
    if not db_student:
        logger.warning(f"PUT /api/students/by-telegram/{telegram}/chat-id-body - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Обновляем chat_id только если он изменился
    if db_student.chat_id != chat_id:
        db_student.chat_id = chat_id
        db.commit()
        db.refresh(db_student)
        logger.info(f"PUT /api/students/by-telegram/{telegram}/chat-id-body - Successfully updated chat_id for student: {db_student.full_name} (new chat_id: {chat_id})")
    else:
        logger.debug(f"PUT /api/students/by-telegram/{telegram}/chat-id-body - chat_id unchanged for student: {db_student.full_name}")
    
    return StudentInfo(
        id=db_student.id,
        year=db_student.year,
        full_name=db_student.full_name,
        telegram=db_student.telegram,
        github=db_student.github,
        group_number=db_student.group_number,
        chat_id=db_student.chat_id,
        is_deleted=db_student.is_deleted
    )

@router.delete("/{student_id}", response_model=StudentInfo)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    logger.info(f"DELETE /api/students/{student_id} - Soft deleting student")
    db_student = db.query(Student).filter(Student.id == student_id).first()
    if not db_student:
        logger.warning(f"DELETE /api/students/{student_id} - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Мягкое удаление - устанавливаем флаг is_deleted
    db_student.is_deleted = True
    db.commit()
    db.refresh(db_student)
    
    logger.info(f"DELETE /api/students/{student_id} - Successfully soft deleted student: {db_student.full_name}")
    return StudentInfo(
        id=db_student.id,
        year=db_student.year,
        full_name=db_student.full_name,
        telegram=db_student.telegram,
        github=db_student.github,
        group_number=db_student.group_number,
        chat_id=db_student.chat_id,
        is_deleted=db_student.is_deleted
    )

@router.get("/stats", response_model=List[StudentStatsInfo])
def get_students_stats(db: Session = Depends(get_db)):
    """
    Получить список студентов с статистикой:
    - Суммарный балл за все homework_review
    - Средний балл за vibe coding
    - Количество посещенных лекций
    Список отсортирован по full_name, удаленные студенты исключены.
    """
    logger.info("GET /api/students/stats - Retrieving students statistics")
    
    # Получаем всех не удаленных студентов, отсортированных по full_name
    students = db.query(Student).filter(Student.is_deleted == False).order_by(Student.full_name).all()
    
    result = []
    
    for student in students:
        # Вычисляем суммарный балл за все homework_review
        total_homework_score = db.query(func.coalesce(func.sum(HomeworkReview.result), 0)).filter(
            HomeworkReview.student_id == student.id
        ).scalar() or 0
        
        # Вычисляем количество посещенных лекций (где present = 1)
        attendance_count = db.query(func.count(Attendance.id)).filter(
            Attendance.student_id == student.id,
            Attendance.present == 1
        ).scalar() or 0
        
        # Средний балл за vibe coding - среднее значение ai_percentage из homework_review
        # где ai_percentage заполнен (не NULL)
        ai_percentage = db.query(func.avg(HomeworkReview.ai_percentage)).filter(
            HomeworkReview.student_id == student.id,
            HomeworkReview.ai_percentage.isnot(None)
        ).scalar()
        
        result.append(StudentStatsInfo(
            student={
                'id': student.id,
                'year': student.year,
                'full_name': student.full_name,
                'telegram': student.telegram,
                'github': student.github,
                'group_number': student.group_number,
                'chat_id': student.chat_id,
                'is_deleted': student.is_deleted
            },
            total_homework_score=int(total_homework_score),
            ai_percentage=ai_percentage,
            attendance_count=int(attendance_count)
        ))
    
    logger.info(f"GET /api/students/stats - Retrieved statistics for {len(result)} students")
    return result
