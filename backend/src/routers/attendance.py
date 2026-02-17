from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timezone, timedelta
from models import AttendanceInfo, AttendanceCreate, AttendanceUpdate
from database import get_db, Attendance, Student, Lecture

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _lecture_has_presentation(lecture: Lecture) -> bool:
    """Проверяет, есть ли у лекции прикреплённая презентация."""
    try:
        return lecture.presentation_blob is not None and len(lecture.presentation_blob) > 0
    except Exception:
        return False


def validate_attendance_time(lecture_date: str, lecture_start_time: Optional[str]) -> bool:
    """
    Проверяет, что время получения запроса соответствует требованиям:
    - дата должна совпадать с датой лекции
    - время должно быть в диапазоне от минус 15 минут от начала лекции до плюс 15 минут от начала лекции
    """
    try:
        # Получаем текущее время в МСК
        msk_tz = timezone(timedelta(hours=3))  # МСК = UTC+3
        current_time = datetime.now(msk_tz)
        
        # Парсим дату лекции (предполагаем ISO формат)
        lecture_datetime = datetime.fromisoformat(lecture_date.replace('Z', '+00:00'))
        
        # Проверяем, что дата совпадает
        if current_time.date() != lecture_datetime.date():
            logger.warning(f"Date mismatch: current={current_time.date()}, lecture={lecture_datetime.date()}")
            return False
        
        # Если время начала лекции не указано, возвращаем False
        if not lecture_start_time:
            logger.warning("Lecture start_time is not specified")
            return False
        
        # Парсим время начала лекции (формат HH:MM)
        try:
            start_hour, start_minute = map(int, lecture_start_time.split(':'))
            lecture_start = current_time.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
        except (ValueError, AttributeError) as e:
            logger.error(f"Error parsing lecture start_time '{lecture_start_time}': {e}")
            return False
        
        # Вычисляем диапазон: от минус 15 минут до плюс 15 минут от начала лекции
        start_time = lecture_start - timedelta(minutes=15)
        end_time = lecture_start + timedelta(minutes=15)
        
        if not (start_time <= current_time <= end_time):
            logger.warning(f"Time out of range: current={current_time.time()}, allowed={start_time.time()}-{end_time.time()}")
            return False
        
        logger.info(f"Time validation passed: {current_time}")
        return True
        
    except Exception as e:
        logger.error(f"Error validating attendance time: {e}")
        return False

@router.get("/", response_model=List[AttendanceInfo])
@router.get("", response_model=List[AttendanceInfo])
def get_attendance(db: Session = Depends(get_db)):
    logger.info("GET /api/attendance - Retrieving all attendance records")
    records = db.query(Attendance).all()
    result = []
    for rec in records:
        student = db.query(Student).filter(Student.id == rec.student_id, Student.is_deleted == False).first()
        lecture = db.query(Lecture).filter(Lecture.id == rec.lecture_id).first()
        if student and lecture:
            result.append(AttendanceInfo(
                id = rec.id,
                student={
                    'id' : student.id,
                    'year': student.year,
                    'full_name': student.full_name,
                    'telegram': student.telegram,
                    'github': student.github,
                    'group_number': student.group_number,
                    'chat_id': student.chat_id,
                    'is_deleted': student.is_deleted
                },
                lecture={
                    'id' : lecture.id,
                    'number': lecture.number,
                    'topic': lecture.topic,
                    'date': lecture.date,
                    'start_time': lecture.start_time,
                    'secret_code': lecture.secret_code,
                    'max_student' : lecture.max_student,
                    'github_example' : lecture.github_example,
                    'has_presentation': _lecture_has_presentation(lecture),
                },
                present=bool(rec.present)
            ))
    logger.info(f"GET /api/attendance - Retrieved {len(result)} attendance records")
    return result

@router.post("/", response_model=AttendanceInfo)
@router.post("", response_model=AttendanceInfo)
def add_attendance(
    att: AttendanceCreate, 
    db: Session = Depends(get_db),
    skip_time_validation: bool = Query(False, description="Skip time validation for attendance recording")
):
    logger.info(f"POST /api/attendance - Adding attendance record for student_id: {att['student_id']}, lecture_id: {att['lecture_id']}")
    
    # Получаем информацию о лекции для проверки времени
    lecture = db.query(Lecture).filter(Lecture.id == att['lecture_id']).first()
    if not lecture:
        logger.error(f"POST /api/attendance - Lecture with id {att['lecture_id']} not found")
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    # Проверяем время получения запроса (если не отключено)
    if not skip_time_validation and not validate_attendance_time(lecture.date, lecture.start_time):
        logger.warning(f"POST /api/attendance - Time validation failed for lecture_id: {att['lecture_id']}")
        raise HTTPException(status_code=400, detail="Attendance can only be recorded on the lecture date within 15 minutes before and after lecture start time")
    
    if skip_time_validation:
        logger.info(f"POST /api/attendance - Time validation skipped for lecture_id: {att['lecture_id']}")
    
    # Проверяем, существует ли уже запись о посещении
    existing_attendance = db.query(Attendance).filter(
        Attendance.student_id == att['student_id'],
        Attendance.lecture_id == att['lecture_id']
    ).first()
    
    if existing_attendance:
        # Запись уже существует
        current_present = bool(existing_attendance.present)
        new_present = bool(att['present'])
        
        if current_present == new_present:
            # Значения одинаковые - ничего не делаем
            logger.info(f"POST /api/attendance - Attendance record already exists with same value (ID: {existing_attendance.id})")
            db_att = existing_attendance
        else:
            # Значения разные - обновляем существующую запись
            logger.info(f"POST /api/attendance - Updating existing attendance record (ID: {existing_attendance.id}) from {current_present} to {new_present}")
            existing_attendance.present = int(att['present'])
            db.commit()
            db.refresh(existing_attendance)
            db_att = existing_attendance
    else:
        # Записи нет - создаем новую
        logger.info(f"POST /api/attendance - Creating new attendance record")
        db_att = Attendance(student_id=att['student_id'], lecture_id=att['lecture_id'], present=int(att['present']))
        db.add(db_att)
        db.commit()
        db.refresh(db_att)
    
    # Получаем связанные данные для ответа
    student = db.query(Student).filter(Student.id == db_att.student_id, Student.is_deleted == False).first()
    # lecture уже получена выше для проверки времени
    
    logger.info(f"POST /api/attendance - Successfully processed attendance record with ID: {db_att.id}")
    return AttendanceInfo(
        id = db_att.id,
        student={
            'id' : student.id,
            'year': student.year,
            'full_name': student.full_name,
            'telegram': student.telegram,
            'github': student.github,
            'group_number': student.group_number,
            'chat_id': student.chat_id,
            'is_deleted': student.is_deleted
        },
        lecture={
            'id' : lecture.id,
            'number': lecture.number,
            'topic': lecture.topic,
            'date': lecture.date,
            'start_time': lecture.start_time,
            'secret_code': lecture.secret_code,
            'max_student': lecture.max_student,
            'github_example' : lecture.github_example,
            'has_presentation': _lecture_has_presentation(lecture),
        },
        present=bool(db_att.present)
    )

@router.put("/{attendance_id}", response_model=AttendanceInfo)
def update_attendance(attendance_id: int, att: AttendanceUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/attendance/{attendance_id} - Updating attendance record")
    db_att = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not db_att:
        logger.warning(f"PUT /api/attendance/{attendance_id} - Attendance record not found")
        raise HTTPException(status_code=404, detail="Attendance record not found")
    for key, value in att.items():
        if value is not None:
            if key == 'present':
                setattr(db_att, key, int(value))
            else:
                setattr(db_att, key, value)
    db.commit()
    db.refresh(db_att)
    student = db.query(Student).filter(Student.id == db_att.student_id, Student.is_deleted == False).first()
    lecture = db.query(Lecture).filter(Lecture.id == db_att.lecture_id).first()
    logger.info(f"PUT /api/attendance/{attendance_id} - Successfully updated attendance record")
    return AttendanceInfo(
        id = db_att.id,
        student={
            'id' : student.id,
            'year': student.year,
            'full_name': student.full_name,
            'telegram': student.telegram,
            'github': student.github,
            'group_number': student.group_number,
            'chat_id': student.chat_id,
            'is_deleted': student.is_deleted
        },
        lecture={
            'id' : lecture.id,
            'number': lecture.number,
            'topic': lecture.topic,
            'date': lecture.date,
            'start_time': lecture.start_time,
            'secret_code': lecture.secret_code,
            'max_student' : lecture.max_student,
            'github_example' : lecture.github_example,
            'has_presentation': _lecture_has_presentation(lecture),
        },
        present=bool(db_att.present)
    )
