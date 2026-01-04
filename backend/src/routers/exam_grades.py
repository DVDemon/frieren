from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, DataError, OperationalError
from typing import List, Optional
import logging
from models import ExamGradeInfo, ExamGradeCreate, ExamGradeUpdate, StudentInfo
from database import get_db, ExamGrade, Student

logger = logging.getLogger(__name__)

# Разрешенные типы файлов
ALLOWED_FILE_TYPES = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg"
}

def is_allowed_file_type(content_type: str) -> bool:
    """Проверяет, является ли тип файла разрешенным"""
    return content_type in ALLOWED_FILE_TYPES

def get_file_extension(content_type: str) -> str:
    """Возвращает расширение файла на основе content_type"""
    return ALLOWED_FILE_TYPES.get(content_type, "bin")

def detect_file_type(blob: bytes) -> str:
    """Определяет тип файла по содержимому (magic bytes)"""
    if len(blob) < 4:
        return "application/octet-stream"
    
    # PDF: начинается с %PDF
    if blob[:4] == b'%PDF':
        return "application/pdf"
    # PNG: начинается с PNG signature
    if blob[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    # JPEG: начинается с FF D8 FF
    if blob[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    
    return "application/octet-stream"

router = APIRouter(prefix="/api/exam_grades", tags=["exam_grades"])

@router.get("/", response_model=List[ExamGradeInfo])
@router.get("", response_model=List[ExamGradeInfo])
def get_exam_grades(db: Session = Depends(get_db)):
    """
    Получить все экзаменационные оценки
    """
    logger.info("GET /api/exam_grades - Retrieving all exam grades")
    exam_grades = db.query(ExamGrade).all()
    result = []
    
    for exam_grade in exam_grades:
        student = db.query(Student).filter(
            Student.id == exam_grade.student_id,
            Student.is_deleted == False
        ).first()
        
        if student:
            result.append(ExamGradeInfo(
                id=exam_grade.id,
                date=exam_grade.date,
                grade=exam_grade.grade,
                variant_number=exam_grade.variant_number,
                student_id=exam_grade.student_id,
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
                has_pdf=exam_grade.pdf_blob is not None
            ))
    
    logger.info(f"GET /api/exam_grades - Retrieved {len(result)} exam grades")
    return result

@router.get("/{exam_grade_id}", response_model=ExamGradeInfo)
def get_exam_grade(exam_grade_id: int, db: Session = Depends(get_db)):
    """
    Получить экзаменационную оценку по ID
    """
    logger.info(f"GET /api/exam_grades/{exam_grade_id} - Retrieving exam grade")
    exam_grade = db.query(ExamGrade).filter(ExamGrade.id == exam_grade_id).first()
    
    if not exam_grade:
        logger.warning(f"GET /api/exam_grades/{exam_grade_id} - Exam grade not found")
        raise HTTPException(status_code=404, detail="Exam grade not found")
    
    student = db.query(Student).filter(
        Student.id == exam_grade.student_id,
        Student.is_deleted == False
    ).first()
    
    if not student:
        logger.warning(f"GET /api/exam_grades/{exam_grade_id} - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    
    return ExamGradeInfo(
        id=exam_grade.id,
        date=exam_grade.date,
        grade=exam_grade.grade,
        variant_number=exam_grade.variant_number,
        student_id=exam_grade.student_id,
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
        has_pdf=exam_grade.pdf_blob is not None
    )

@router.get("/by-student/{student_id}", response_model=List[ExamGradeInfo])
def get_exam_grades_by_student(student_id: int, db: Session = Depends(get_db)):
    """
    Получить все экзаменационные оценки для конкретного студента
    """
    logger.info(f"GET /api/exam_grades/by-student/{student_id} - Retrieving exam grades for student")
    
    # Проверяем, что студент существует
    student = db.query(Student).filter(
        Student.id == student_id,
        Student.is_deleted == False
    ).first()
    
    if not student:
        logger.warning(f"GET /api/exam_grades/by-student/{student_id} - Student not found")
        raise HTTPException(status_code=404, detail="Student not found")
    
    exam_grades = db.query(ExamGrade).filter(ExamGrade.student_id == student_id).all()
    result = []
    
    for exam_grade in exam_grades:
        result.append(ExamGradeInfo(
            id=exam_grade.id,
            date=exam_grade.date,
            grade=exam_grade.grade,
            variant_number=exam_grade.variant_number,
            student_id=exam_grade.student_id,
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
            has_pdf=exam_grade.pdf_blob is not None
        ))
    
    logger.info(f"GET /api/exam_grades/by-student/{student_id} - Retrieved {len(result)} exam grades")
    return result

@router.post("/", response_model=ExamGradeInfo)
def create_exam_grade_json(
    exam_grade: ExamGradeCreate,
    db: Session = Depends(get_db)
):
    """
    Создать новую экзаменационную оценку (JSON, без PDF)
    """
    logger.info(f"POST /api/exam_grades - Creating exam grade for student_id: {exam_grade['student_id']}")
    
    # Проверяем, что студент существует
    student = db.query(Student).filter(
        Student.id == exam_grade['student_id'],
        Student.is_deleted == False
    ).first()
    
    if not student:
        logger.warning(f"POST /api/exam_grades - Student not found: {exam_grade['student_id']}")
        raise HTTPException(status_code=404, detail="Student not found")
    
    try:
        db_exam_grade = ExamGrade(
            date=exam_grade['date'],
            grade=exam_grade['grade'],
            variant_number=exam_grade['variant_number'],
            student_id=exam_grade['student_id'],
            pdf_blob=None
        )
        db.add(db_exam_grade)
        db.commit()
        db.refresh(db_exam_grade)
        
        logger.info(f"POST /api/exam_grades - Successfully created exam grade with ID: {db_exam_grade.id}")
        
        return ExamGradeInfo(
            id=db_exam_grade.id,
            date=db_exam_grade.date,
            grade=db_exam_grade.grade,
            variant_number=db_exam_grade.variant_number,
            student_id=db_exam_grade.student_id,
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
            has_pdf=db_exam_grade.pdf_blob is not None
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"POST /api/exam_grades - Database integrity error: {e}")
        raise HTTPException(
            status_code=400,
            detail="Database integrity error. Please check your data."
        )
    except (DataError, OperationalError) as e:
        db.rollback()
        logger.error(f"POST /api/exam_grades - Database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred. Please try again later."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"POST /api/exam_grades - Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error. Please try again later."
        )

@router.post("/with-pdf", response_model=ExamGradeInfo)
async def create_exam_grade_with_pdf(
    date: str = Form(...),
    grade: int = Form(...),
    variant_number: int = Form(...),
    student_id: int = Form(...),
    pdf_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Создать новую экзаменационную оценку с файлом (PDF, PNG, JPG, JPEG)
    """
    logger.info(f"POST /api/exam_grades/with-pdf - Creating exam grade for student_id: {student_id}")
    
    # Проверяем, что студент существует
    student = db.query(Student).filter(
        Student.id == student_id,
        Student.is_deleted == False
    ).first()
    
    if not student:
        logger.warning(f"POST /api/exam_grades/with-pdf - Student not found: {student_id}")
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Проверяем тип файла
    if not is_allowed_file_type(pdf_file.content_type):
        logger.warning(f"POST /api/exam_grades/with-pdf - Invalid file type: {pdf_file.content_type}")
        raise HTTPException(
            status_code=400, 
            detail="File must be a PDF, PNG, JPG, or JPEG"
        )
    
    # Читаем файл
    pdf_blob = await pdf_file.read()
    logger.info(f"POST /api/exam_grades/with-pdf - File uploaded, type: {pdf_file.content_type}, size: {len(pdf_blob)} bytes")
    
    try:
        db_exam_grade = ExamGrade(
            date=date,
            grade=grade,
            variant_number=variant_number,
            student_id=student_id,
            pdf_blob=pdf_blob
        )
        db.add(db_exam_grade)
        db.commit()
        db.refresh(db_exam_grade)
        
        logger.info(f"POST /api/exam_grades/with-pdf - Successfully created exam grade with ID: {db_exam_grade.id}")
        
        return ExamGradeInfo(
            id=db_exam_grade.id,
            date=db_exam_grade.date,
            grade=db_exam_grade.grade,
            variant_number=db_exam_grade.variant_number,
            student_id=db_exam_grade.student_id,
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
            has_pdf=db_exam_grade.pdf_blob is not None
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"POST /api/exam_grades/with-pdf - Database integrity error: {e}")
        raise HTTPException(
            status_code=400,
            detail="Database integrity error. Please check your data."
        )
    except (DataError, OperationalError) as e:
        db.rollback()
        logger.error(f"POST /api/exam_grades/with-pdf - Database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred. Please try again later."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"POST /api/exam_grades/with-pdf - Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error. Please try again later."
        )

@router.put("/{exam_grade_id}", response_model=ExamGradeInfo)
def update_exam_grade_json(
    exam_grade_id: int,
    exam_grade: ExamGradeUpdate,
    db: Session = Depends(get_db)
):
    """
    Обновить экзаменационную оценку (JSON, без PDF)
    Все поля опциональны
    """
    logger.info(f"PUT /api/exam_grades/{exam_grade_id} - Updating exam grade")
    
    db_exam_grade = db.query(ExamGrade).filter(ExamGrade.id == exam_grade_id).first()
    if not db_exam_grade:
        logger.warning(f"PUT /api/exam_grades/{exam_grade_id} - Exam grade not found")
        raise HTTPException(status_code=404, detail="Exam grade not found")
    
    # Обновляем поля, если они предоставлены
    for key, value in exam_grade.items():
        if value is not None:
            if key == 'student_id':
                # Проверяем, что новый студент существует
                student = db.query(Student).filter(
                    Student.id == value,
                    Student.is_deleted == False
                ).first()
                if not student:
                    logger.warning(f"PUT /api/exam_grades/{exam_grade_id} - Student not found: {value}")
                    raise HTTPException(status_code=404, detail="Student not found")
            setattr(db_exam_grade, key, value)
    
    try:
        db.commit()
        db.refresh(db_exam_grade)
        
        # Получаем информацию о студенте
        student = db.query(Student).filter(
            Student.id == db_exam_grade.student_id,
            Student.is_deleted == False
        ).first()
        
        if not student:
            logger.warning(f"PUT /api/exam_grades/{exam_grade_id} - Student not found")
            raise HTTPException(status_code=404, detail="Student not found")
        
        logger.info(f"PUT /api/exam_grades/{exam_grade_id} - Successfully updated exam grade")
        
        return ExamGradeInfo(
            id=db_exam_grade.id,
            date=db_exam_grade.date,
            grade=db_exam_grade.grade,
            variant_number=db_exam_grade.variant_number,
            student_id=db_exam_grade.student_id,
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
            has_pdf=db_exam_grade.pdf_blob is not None
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"PUT /api/exam_grades/{exam_grade_id} - Database integrity error: {e}")
        raise HTTPException(
            status_code=400,
            detail="Database integrity error. Please check your data."
        )
    except (DataError, OperationalError) as e:
        db.rollback()
        logger.error(f"PUT /api/exam_grades/{exam_grade_id} - Database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred. Please try again later."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"PUT /api/exam_grades/{exam_grade_id} - Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error. Please try again later."
        )

@router.put("/{exam_grade_id}/pdf", response_model=ExamGradeInfo)
async def update_exam_grade_pdf(
    exam_grade_id: int,
    pdf_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Обновить файл экзаменационной работы (PDF, PNG, JPG, JPEG)
    """
    logger.info(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Updating file")
    
    db_exam_grade = db.query(ExamGrade).filter(ExamGrade.id == exam_grade_id).first()
    if not db_exam_grade:
        logger.warning(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Exam grade not found")
        raise HTTPException(status_code=404, detail="Exam grade not found")
    
    # Проверяем тип файла
    if not is_allowed_file_type(pdf_file.content_type):
        logger.warning(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Invalid file type: {pdf_file.content_type}")
        raise HTTPException(
            status_code=400, 
            detail="File must be a PDF, PNG, JPG, or JPEG"
        )
    
    # Читаем файл
    pdf_blob = await pdf_file.read()
    db_exam_grade.pdf_blob = pdf_blob
    logger.info(f"PUT /api/exam_grades/{exam_grade_id}/pdf - File updated, type: {pdf_file.content_type}, size: {len(pdf_blob)} bytes")
    
    try:
        db.commit()
        db.refresh(db_exam_grade)
        
        # Получаем информацию о студенте
        student = db.query(Student).filter(
            Student.id == db_exam_grade.student_id,
            Student.is_deleted == False
        ).first()
        
        if not student:
            logger.warning(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Student not found")
            raise HTTPException(status_code=404, detail="Student not found")
        
        logger.info(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Successfully updated PDF")
        
        return ExamGradeInfo(
            id=db_exam_grade.id,
            date=db_exam_grade.date,
            grade=db_exam_grade.grade,
            variant_number=db_exam_grade.variant_number,
            student_id=db_exam_grade.student_id,
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
            has_pdf=db_exam_grade.pdf_blob is not None
        )
    except IntegrityError as e:
        db.rollback()
        logger.error(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Database integrity error: {e}")
        raise HTTPException(
            status_code=400,
            detail="Database integrity error. Please check your data."
        )
    except (DataError, OperationalError) as e:
        db.rollback()
        logger.error(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred. Please try again later."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"PUT /api/exam_grades/{exam_grade_id}/pdf - Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error. Please try again later."
        )

@router.get("/{exam_grade_id}/pdf")
def get_exam_grade_pdf(exam_grade_id: int, db: Session = Depends(get_db)):
    """
    Получить файл экзаменационной работы (PDF, PNG, JPG, JPEG)
    """
    logger.info(f"GET /api/exam_grades/{exam_grade_id}/pdf - Retrieving file")
    
    exam_grade = db.query(ExamGrade).filter(ExamGrade.id == exam_grade_id).first()
    if not exam_grade:
        logger.warning(f"GET /api/exam_grades/{exam_grade_id}/pdf - Exam grade not found")
        raise HTTPException(status_code=404, detail="Exam grade not found")
    
    if not exam_grade.pdf_blob:
        logger.warning(f"GET /api/exam_grades/{exam_grade_id}/pdf - File not found")
        raise HTTPException(status_code=404, detail="File not found for this exam grade")
    
    # Определяем тип файла по содержимому
    file_type = detect_file_type(exam_grade.pdf_blob)
    file_extension = get_file_extension(file_type)
    
    return Response(
        content=exam_grade.pdf_blob,
        media_type=file_type,
        headers={
            "Content-Disposition": f"attachment; filename=exam_grade_{exam_grade_id}.{file_extension}"
        }
    )

@router.delete("/{exam_grade_id}", response_model=dict)
def delete_exam_grade(exam_grade_id: int, db: Session = Depends(get_db)):
    """
    Удалить экзаменационную оценку
    """
    logger.info(f"DELETE /api/exam_grades/{exam_grade_id} - Deleting exam grade")
    
    exam_grade = db.query(ExamGrade).filter(ExamGrade.id == exam_grade_id).first()
    if not exam_grade:
        logger.warning(f"DELETE /api/exam_grades/{exam_grade_id} - Exam grade not found")
        raise HTTPException(status_code=404, detail="Exam grade not found")
    
    try:
        db.delete(exam_grade)
        db.commit()
        
        logger.info(f"DELETE /api/exam_grades/{exam_grade_id} - Successfully deleted exam grade")
        
        return {
            "success": True,
            "message": f"Exam grade {exam_grade_id} has been deleted"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"DELETE /api/exam_grades/{exam_grade_id} - Error deleting exam grade: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting exam grade: {str(e)}")

