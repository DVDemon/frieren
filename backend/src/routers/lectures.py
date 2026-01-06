from re import S
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
import logging
from models import LectureInfo, LectureCreate, LectureUpdate, LectureCapacityInfo, LectureCapacityUpdate
from database import get_db, Lecture, Attendance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lectures", tags=["lectures"])

@router.get("/", response_model=List[LectureInfo])
@router.get("", response_model=List[LectureInfo])  # Дублируем роут без trailing slash
def get_lectures(db: Session = Depends(get_db)):
    logger.info("GET /api/lectures - Retrieving all lectures")
    lectures = db.query(Lecture).all()
    logger.info(f"GET /api/lectures - Retrieved {len(lectures)} lectures")
    # Логируем ID всех лекций для отладки
    lecture_ids = [l.id for l in lectures]
    logger.info(f"GET /api/lectures - Available lecture IDs: {lecture_ids}")
    
    result = []
    for l in lectures:
        # Безопасная проверка наличия presentation_blob
        has_presentation = False
        try:
            has_presentation = l.presentation_blob is not None and len(l.presentation_blob) > 0
        except (AttributeError, TypeError):
            # Если поле не существует в БД (миграция не выполнена), считаем что презентации нет
            has_presentation = False
            logger.debug(f"Lecture {l.id}: presentation_blob field not accessible, assuming no presentation")
        
        result.append(LectureInfo(
            id=l.id, 
            number=l.number, 
            topic=l.topic, 
            date=l.date, 
            start_time=l.start_time, 
            secret_code=l.secret_code, 
            max_student=l.max_student, 
            github_example=l.github_example, 
            has_presentation=has_presentation
        ))
    
    logger.info(f"GET /api/lectures - Returning {len(result)} lectures with has_presentation info")
    return result

@router.get("/{lecture_id}", response_model=LectureInfo)
def get_lecture(lecture_id: int, db: Session = Depends(get_db)):
    logger.info(f"GET /api/lectures/{lecture_id} - Retrieving specific lecture")
    db_lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not db_lecture:
        logger.warning(f"GET /api/lectures/{lecture_id} - Lecture not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    logger.info(f"GET /api/lectures/{lecture_id} - Successfully retrieved lecture")
    # Безопасная проверка наличия presentation_blob
    has_presentation = False
    try:
        has_presentation = db_lecture.presentation_blob is not None and len(db_lecture.presentation_blob) > 0
    except (AttributeError, TypeError):
        has_presentation = False
        logger.debug(f"Lecture {lecture_id}: presentation_blob field not accessible, assuming no presentation")
    
    return LectureInfo(
        id=db_lecture.id, 
        number=db_lecture.number, 
        topic=db_lecture.topic, 
        date=db_lecture.date, 
        start_time=db_lecture.start_time, 
        secret_code=db_lecture.secret_code, 
        max_student=db_lecture.max_student, 
        github_example=db_lecture.github_example, 
        has_presentation=has_presentation
    )

# Кеш данных для ускорения поиска по секретному коду
lecture_cache = dict()
@router.get("/by-secret-code/{secret_code}", response_model=LectureInfo)
def get_lecture_by_secret_code(secret_code: str, db: Session = Depends(get_db)):
    logger.info(f"GET /api/lectures/by-secret-code/{secret_code} - Searching lecture by secret code")

    db_lecture = None
    if secret_code in lecture_cache:
        db_lecture = lecture_cache[secret_code]
        logger.info(f"GET /api/lectures/by-secret-code/{secret_code} - Successfully found lecture in cache") 

    if not db_lecture:
        db_lecture = db.query(Lecture).filter(Lecture.secret_code == secret_code).first()
        if not db_lecture:
            logger.warning(f"GET /api/lectures/by-secret-code/{secret_code} - Lecture not found")
            raise HTTPException(status_code=404, detail="Lecture not found")
        lecture_cache[secret_code] = db_lecture
        logger.info(f"GET /api/lectures/by-secret-code/{secret_code} - Successfully found lecture")

    # Безопасная проверка наличия presentation_blob
    has_presentation = False
    try:
        has_presentation = db_lecture.presentation_blob is not None and len(db_lecture.presentation_blob) > 0
    except (AttributeError, TypeError):
        has_presentation = False
    
    return LectureInfo(id=db_lecture.id, number=db_lecture.number, topic=db_lecture.topic, date=db_lecture.date, start_time=db_lecture.start_time, secret_code=db_lecture.secret_code, max_student=db_lecture.max_student, github_example=db_lecture.github_example, has_presentation=has_presentation)

@router.post("/", response_model=LectureInfo)
@router.post("", response_model=LectureInfo)
def add_lecture(lecture: LectureCreate, db: Session = Depends(get_db)):
    logger.info(f"POST /api/lectures - Adding new lecture: {lecture['topic']}")
    db_lecture = Lecture(**lecture)
    db.add(db_lecture)
    db.commit()
    db.refresh(db_lecture)
    logger.info(f"POST /api/lectures - Successfully added lecture with ID: {db_lecture.id}")
    return LectureInfo(id=db_lecture.id,  number=db_lecture.number, topic=db_lecture.topic, date=db_lecture.date, start_time=db_lecture.start_time, secret_code=db_lecture.secret_code, max_student=db_lecture.max_student, github_example=db_lecture.github_example, has_presentation=db_lecture.presentation_blob is not None)

@router.put("/{lecture_id}", response_model=LectureInfo)
def update_lecture(lecture_id: int, lecture: LectureUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/lectures/{lecture_id} - Updating lecture")
    db_lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not db_lecture:
        logger.warning(f"PUT /api/lectures/{lecture_id} - Lecture not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    for key, value in lecture.items():
        if value is not None:
            setattr(db_lecture, key, value)
    db.commit()
    db.refresh(db_lecture)
    logger.info(f"PUT /api/lectures/{lecture_id} - Successfully updated lecture")
    # Безопасная проверка наличия presentation_blob
    has_presentation = False
    try:
        has_presentation = db_lecture.presentation_blob is not None and len(db_lecture.presentation_blob) > 0
    except (AttributeError, TypeError):
        has_presentation = False
    
    return LectureInfo(id=db_lecture.id, number=db_lecture.number, topic=db_lecture.topic, date=db_lecture.date, start_time=db_lecture.start_time, secret_code=db_lecture.secret_code, max_student=db_lecture.max_student, github_example=db_lecture.github_example, has_presentation=has_presentation)

@router.delete("/{lecture_id}", response_model=dict)
def delete_lecture(lecture_id: int, db: Session = Depends(get_db)):
    logger.info(f"DELETE /api/lectures/{lecture_id} - Deleting lecture (type: {type(lecture_id)})")
    
    # Проверяем, существует ли лекция
    db_lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    logger.info(f"DELETE /api/lectures/{lecture_id} - Query result: {db_lecture}")
    
    if not db_lecture:
        logger.warning(f"DELETE /api/lectures/{lecture_id} - Lecture not found")
        # Проверим, какие лекции есть в базе
        all_lectures = db.query(Lecture).all()
        lecture_ids = [l.id for l in all_lectures]
        logger.info(f"DELETE /api/lectures/{lecture_id} - Available lecture IDs: {lecture_ids}")
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    # Сохраняем информацию о лекции до удаления
    lecture_info = {
        'id': db_lecture.id,
        'number': db_lecture.number,
        'topic': db_lecture.topic,
        'date': db_lecture.date,
        'secret_code': db_lecture.secret_code
    }
    
    try:
        # Удаляем связанные записи посещаемости
        attendance_records = db.query(Attendance).filter(Attendance.lecture_id == lecture_id).all()
        attendance_count = len(attendance_records)
        
        for attendance in attendance_records:
            db.delete(attendance)
        
        # Удаляем саму лекцию
        db.delete(db_lecture)
        db.commit()
        
        logger.info(f"DELETE /api/lectures/{lecture_id} - Successfully deleted lecture and {attendance_count} attendance records")
        
        return {
            "success": True,
            "message": f"Лекция {lecture_id} успешно удалена",
            "deleted_lecture": lecture_info,
            "deleted_attendance_count": attendance_count
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"DELETE /api/lectures/{lecture_id} - Error deleting lecture: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении лекции: {str(e)}")

@router.get("/capacity/{lecture_number}", response_model=LectureCapacityInfo)
def get_lecture_capacity(lecture_number: int, db: Session = Depends(get_db)):
    """
    Проверяет вместимость лекции по номеру.
    Возвращает информацию о текущем количестве студентов и ограничениях.
    """
    logger.info(f"GET /api/lectures/capacity/{lecture_number} - Checking lecture capacity")
    
    # Находим лекцию по номеру
    db_lecture = db.query(Lecture).filter(Lecture.number == lecture_number).first()
    if not db_lecture:
        logger.warning(f"GET /api/lectures/capacity/{lecture_number} - Lecture not found")
        raise HTTPException(status_code=404, detail="Лекция с таким номером не найдена")
    
    # Подсчитываем текущее количество студентов на лекции
    current_attendance = db.query(Attendance).filter(
        Attendance.lecture_id == db_lecture.id,
        Attendance.present == 1  # Только присутствующие студенты
    ).count()
    
    # Определяем ограничения
    max_student = db_lecture.max_student
    is_full = False
    can_attend = True
    remaining_slots = None
    
    if max_student is not None:
        is_full = current_attendance >= max_student
        can_attend = current_attendance < max_student
        remaining_slots = max(0, max_student - current_attendance)
    
    logger.info(f"GET /api/lectures/capacity/{lecture_number} - Lecture {db_lecture.id}: {current_attendance}/{max_student if max_student else 'unlimited'} students")
    
    return LectureCapacityInfo(
        lecture_id=db_lecture.id,
        lecture_number=db_lecture.number,
        lecture_topic=db_lecture.topic,
        max_student=max_student,
        current_attendance=current_attendance,
        is_full=is_full,
        can_attend=can_attend,
        github_example=db_lecture.github_example,
        remaining_slots=remaining_slots,
        start_time=db_lecture.start_time
    )

@router.put("/capacity/{lecture_number}", response_model=LectureCapacityInfo)
def update_lecture_capacity(lecture_number: int, capacity_update: LectureCapacityUpdate, db: Session = Depends(get_db)):
    """
    Обновляет вместимость лекции по номеру.
    Позволяет изменить максимальное количество студентов на лекции.
    """
    logger.info(f"PUT /api/lectures/capacity/{lecture_number} - Updating lecture capacity")
    
    # Находим лекцию по номеру
    db_lecture = db.query(Lecture).filter(Lecture.number == lecture_number).first()
    if not db_lecture:
        logger.warning(f"PUT /api/lectures/capacity/{lecture_number} - Lecture not found")
        raise HTTPException(status_code=404, detail="Лекция с таким номером не найдена")
    
    # Обновляем максимальное количество студентов
    old_max_student = db_lecture.max_student
    db_lecture.max_student = capacity_update["max_student"]
    db.commit()
    db.refresh(db_lecture)
    
    logger.info(f"PUT /api/lectures/capacity/{lecture_number} - Updated max_student from {old_max_student} to {db_lecture.max_student}")
    
    # Подсчитываем текущее количество студентов на лекции
    current_attendance = db.query(Attendance).filter(
        Attendance.lecture_id == db_lecture.id,
        Attendance.present == 1  # Только присутствующие студенты
    ).count()
    
    # Определяем ограничения
    max_student = db_lecture.max_student
    is_full = False
    can_attend = True
    remaining_slots = None
    
    if max_student is not None:
        is_full = current_attendance >= max_student
        can_attend = current_attendance < max_student
        remaining_slots = max(0, max_student - current_attendance)
    
    logger.info(f"PUT /api/lectures/capacity/{lecture_number} - Lecture {db_lecture.id}: {current_attendance}/{max_student if max_student else 'unlimited'} students")
    
    return LectureCapacityInfo(
        lecture_id=db_lecture.id,
        lecture_number=db_lecture.number,
        lecture_topic=db_lecture.topic,
        max_student=max_student,
        current_attendance=current_attendance,
        is_full=is_full,
        can_attend=can_attend,
        github_example=db_lecture.github_example,
        remaining_slots=remaining_slots,
        start_time=db_lecture.start_time
    )

@router.get("/by-number/{lecture_number}/presentation")
def get_lecture_presentation_by_number(lecture_number: int, db: Session = Depends(get_db)):
    """
    Скачивает презентацию лекции по номеру.
    Возвращает файл в формате PDF или PPTX.
    Используется ботом для получения материалов лекций.
    """
    logger.info(f"GET /api/lectures/by-number/{lecture_number}/presentation - Retrieving lecture presentation by number")
    
    db_lecture = db.query(Lecture).filter(Lecture.number == lecture_number).first()
    if not db_lecture:
        logger.warning(f"GET /api/lectures/by-number/{lecture_number}/presentation - Lecture not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    if not db_lecture.presentation_blob:
        logger.warning(f"GET /api/lectures/by-number/{lecture_number}/presentation - Presentation not found")
        raise HTTPException(status_code=404, detail="Presentation not found for this lecture")
    
    # Определяем тип файла по содержимому
    content = db_lecture.presentation_blob
    content_type = "application/pdf"
    filename = f"lecture_{lecture_number}_presentation.pdf"
    
    # Проверяем, является ли файл PPTX (ZIP архив)
    if content[:4] == b'PK\x03\x04':  # ZIP signature
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        filename = f"lecture_{lecture_number}_presentation.pptx"
    
    logger.info(f"GET /api/lectures/by-number/{lecture_number}/presentation - Successfully retrieved presentation ({content_type})")
    
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/{lecture_id}/presentation")
def get_lecture_presentation(lecture_id: int, db: Session = Depends(get_db)):
    """
    Скачивает презентацию лекции по ID.
    Возвращает файл в формате PDF или PPTX.
    """
    logger.info(f"GET /api/lectures/{lecture_id}/presentation - Retrieving lecture presentation")
    
    db_lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not db_lecture:
        logger.warning(f"GET /api/lectures/{lecture_id}/presentation - Lecture not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    if not db_lecture.presentation_blob:
        logger.warning(f"GET /api/lectures/{lecture_id}/presentation - Presentation not found")
        raise HTTPException(status_code=404, detail="Presentation not found for this lecture")
    
    # Определяем тип файла по содержимому
    content = db_lecture.presentation_blob
    content_type = "application/pdf"
    filename = f"lecture_{db_lecture.number}_presentation.pdf"
    
    # Проверяем, является ли файл PPTX (ZIP архив)
    if content[:4] == b'PK\x03\x04':  # ZIP signature
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        filename = f"lecture_{db_lecture.number}_presentation.pptx"
    
    logger.info(f"GET /api/lectures/{lecture_id}/presentation - Successfully retrieved presentation ({content_type})")
    
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.post("/{lecture_id}/presentation")
def upload_lecture_presentation(
    lecture_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Загружает презентацию для лекции.
    Принимает файлы в формате PDF или PPTX.
    """
    logger.info(f"POST /api/lectures/{lecture_id}/presentation - Uploading lecture presentation")
    
    # Проверяем формат файла
    file_extension = None
    if file.filename:
        file_extension = file.filename.lower().split('.')[-1]
    
    if file_extension not in ['pdf', 'pptx']:
        logger.warning(f"POST /api/lectures/{lecture_id}/presentation - Invalid file format: {file_extension}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format. Allowed formats: PDF, PPTX. Got: {file_extension}"
        )
    
    # Проверяем, существует ли лекция
    db_lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not db_lecture:
        logger.warning(f"POST /api/lectures/{lecture_id}/presentation - Lecture not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    # Читаем содержимое файла
    try:
        content = file.file.read()
        
        # Проверяем размер файла (например, максимум 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if len(content) > max_size:
            logger.warning(f"POST /api/lectures/{lecture_id}/presentation - File too large: {len(content)} bytes")
            raise HTTPException(status_code=400, detail="File too large. Maximum size: 50MB")
        
        # Сохраняем презентацию в базу данных
        db_lecture.presentation_blob = content
        db.commit()
        db.refresh(db_lecture)
        
        logger.info(f"POST /api/lectures/{lecture_id}/presentation - Successfully uploaded presentation ({len(content)} bytes)")
        
        return {
            "success": True,
            "message": f"Presentation uploaded successfully for lecture {lecture_id}",
            "filename": file.filename,
            "size": len(content)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"POST /api/lectures/{lecture_id}/presentation - Error uploading presentation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading presentation: {str(e)}")

@router.put("/{lecture_id}/presentation")
def update_lecture_presentation(
    lecture_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Обновляет презентацию для лекции.
    Принимает файлы в формате PDF или PPTX.
    """
    logger.info(f"PUT /api/lectures/{lecture_id}/presentation - Updating lecture presentation")
    
    # Проверяем формат файла
    file_extension = None
    if file.filename:
        file_extension = file.filename.lower().split('.')[-1]
    
    if file_extension not in ['pdf', 'pptx']:
        logger.warning(f"PUT /api/lectures/{lecture_id}/presentation - Invalid file format: {file_extension}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format. Allowed formats: PDF, PPTX. Got: {file_extension}"
        )
    
    # Проверяем, существует ли лекция
    db_lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not db_lecture:
        logger.warning(f"PUT /api/lectures/{lecture_id}/presentation - Lecture not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    # Читаем содержимое файла
    try:
        content = file.file.read()
        
        # Проверяем размер файла (например, максимум 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if len(content) > max_size:
            logger.warning(f"PUT /api/lectures/{lecture_id}/presentation - File too large: {len(content)} bytes")
            raise HTTPException(status_code=400, detail="File too large. Maximum size: 50MB")
        
        # Обновляем презентацию в базе данных
        db_lecture.presentation_blob = content
        db.commit()
        db.refresh(db_lecture)
        
        logger.info(f"PUT /api/lectures/{lecture_id}/presentation - Successfully updated presentation ({len(content)} bytes)")
        
        return {
            "success": True,
            "message": f"Presentation updated successfully for lecture {lecture_id}",
            "filename": file.filename,
            "size": len(content)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"PUT /api/lectures/{lecture_id}/presentation - Error updating presentation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating presentation: {str(e)}")
