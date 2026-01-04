from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import logging
from models import TeacherInfo, TeacherCreate, TeacherUpdate, TeacherGroupInfo, TeacherGroupCreate, TeacherGroupUpdate, TeacherStatsInfo
from database import get_db, Teacher, TeacherGroup, Student, HomeworkReview

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/teachers", tags=["teachers"])

# Методы для преподавателей
@router.get("/", response_model=List[TeacherInfo])
@router.get("", response_model=List[TeacherInfo])
def get_teachers(db: Session = Depends(get_db)):
    logger.info("GET /api/teachers - Retrieving all teachers")
    teachers = db.query(Teacher).filter(Teacher.is_deleted == False).all()
    logger.info(f"GET /api/teachers - Retrieved {len(teachers)} teachers")
    return [TeacherInfo(
        id=teacher.id,
        full_name=teacher.full_name,
        telegram=teacher.telegram,
        is_deleted=teacher.is_deleted
    ) for teacher in teachers]

@router.post("/", response_model=TeacherInfo)
@router.post("", response_model=TeacherInfo)
def add_teacher(teacher: TeacherCreate, db: Session = Depends(get_db)):
    logger.info(f"POST /api/teachers - Adding new teacher: {teacher['full_name']}")
    db_teacher = Teacher(**teacher)
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    logger.info(f"POST /api/teachers - Successfully added teacher with ID: {db_teacher.id}")
    return TeacherInfo(
        id=db_teacher.id,
        full_name=db_teacher.full_name,
        telegram=db_teacher.telegram,
        is_deleted=db_teacher.is_deleted
    )

@router.put("/{teacher_id}", response_model=TeacherInfo)
def update_teacher(teacher_id: int, teacher: TeacherUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/teachers/{teacher_id} - Updating teacher")
    db_teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not db_teacher:
        logger.warning(f"PUT /api/teachers/{teacher_id} - Teacher not found")
        raise HTTPException(status_code=404, detail="Teacher not found")
    for key, value in teacher.items():
        if value is not None:
            setattr(db_teacher, key, value)
    db.commit()
    db.refresh(db_teacher)
    logger.info(f"PUT /api/teachers/{teacher_id} - Successfully updated teacher")
    return TeacherInfo(
        id=db_teacher.id,
        full_name=db_teacher.full_name,
        telegram=db_teacher.telegram,
        is_deleted=db_teacher.is_deleted
    )

@router.delete("/{teacher_id}", response_model=TeacherInfo)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    logger.info(f"DELETE /api/teachers/{teacher_id} - Soft deleting teacher")
    db_teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not db_teacher:
        logger.warning(f"DELETE /api/teachers/{teacher_id} - Teacher not found")
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # Мягкое удаление - устанавливаем флаг is_deleted
    db_teacher.is_deleted = True
    db.commit()
    db.refresh(db_teacher)
    
    logger.info(f"DELETE /api/teachers/{teacher_id} - Successfully soft deleted teacher: {db_teacher.full_name}")
    return TeacherInfo(
        id=db_teacher.id,
        full_name=db_teacher.full_name,
        telegram=db_teacher.telegram,
        is_deleted=db_teacher.is_deleted
    )

@router.get("/by-telegram/{telegram}", response_model=TeacherInfo)
def get_teacher_by_telegram(telegram: str, db: Session = Depends(get_db)):
    logger.info(f"GET /api/teachers/by-telegram/{telegram} - Searching for teacher by telegram")
    teacher = db.query(Teacher).filter(Teacher.telegram == telegram, Teacher.is_deleted == False).first()
    if not teacher:
        logger.warning(f"GET /api/teachers/by-telegram/{telegram} - Teacher not found")
        raise HTTPException(status_code=404, detail="Teacher not found")
    logger.info(f"GET /api/teachers/by-telegram/{telegram} - Found teacher: {teacher.full_name}")
    return TeacherInfo(
        id=teacher.id,
        full_name=teacher.full_name,
        telegram=teacher.telegram,
        is_deleted=teacher.is_deleted
    )

@router.get("/by-group/{group_number}", response_model=List[TeacherInfo])
def get_teachers_by_group(group_number: str, db: Session = Depends(get_db)):
    logger.info(f"GET /api/teachers/by-group/{group_number} - Searching for teachers by group number")
    
    try:
        # Сначала получаем teacher_id из TeacherGroup
        teacher_groups = db.query(TeacherGroup).filter(
            TeacherGroup.group_number == group_number
        ).all()
        
        if not teacher_groups:
            logger.info(f"GET /api/teachers/by-group/{group_number} - No teacher groups found for group {group_number}")
            return []
        
        # Получаем список teacher_id
        teacher_ids = [tg.teacher_id for tg in teacher_groups]
        
        # Получаем учителей по их ID
        teachers = db.query(Teacher).filter(
            Teacher.id.in_(teacher_ids),
            Teacher.is_deleted == False
        ).all()
        
        logger.info(f"GET /api/teachers/by-group/{group_number} - Found {len(teachers)} teachers for group {group_number}")
        
        return [TeacherInfo(
            id=teacher.id,
            full_name=teacher.full_name,
            telegram=teacher.telegram,
            is_deleted=teacher.is_deleted
        ) for teacher in teachers]
        
    except Exception as e:
        logger.error(f"GET /api/teachers/by-group/{group_number} - Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Методы для связи преподавателей с группами
@router.get("/groups", response_model=List[TeacherGroupInfo])
def get_teacher_groups(db: Session = Depends(get_db)):
    logger.info("GET /api/teachers/groups - Retrieving all teacher groups")
    teacher_groups = db.query(TeacherGroup).all()
    logger.info(f"GET /api/teachers/groups - Retrieved {len(teacher_groups)} teacher groups")
    return [TeacherGroupInfo(
        id=tg.id,
        teacher_id=tg.teacher_id,
        group_number=tg.group_number
    ) for tg in teacher_groups]

@router.get("/{teacher_id}/groups", response_model=List[TeacherGroupInfo])
def get_teacher_groups_by_teacher(teacher_id: int, db: Session = Depends(get_db)):
    logger.info(f"GET /api/teachers/{teacher_id}/groups - Retrieving groups for teacher")
    teacher_groups = db.query(TeacherGroup).filter(TeacherGroup.teacher_id == teacher_id).all()
    logger.info(f"GET /api/teachers/{teacher_id}/groups - Retrieved {len(teacher_groups)} groups")
    return [TeacherGroupInfo(
        id=tg.id,
        teacher_id=tg.teacher_id,
        group_number=tg.group_number
    ) for tg in teacher_groups]

@router.post("/groups", response_model=TeacherGroupInfo)
def add_teacher_group(teacher_group: TeacherGroupCreate, db: Session = Depends(get_db)):
    logger.info(f"POST /api/teachers/groups - Adding teacher group for teacher_id: {teacher_group['teacher_id']}, group: {teacher_group['group_number']}")
    db_teacher_group = TeacherGroup(**teacher_group)
    db.add(db_teacher_group)
    db.commit()
    db.refresh(db_teacher_group)
    logger.info(f"POST /api/teachers/groups - Successfully added teacher group with ID: {db_teacher_group.id}")
    return TeacherGroupInfo(
        id=db_teacher_group.id,
        teacher_id=db_teacher_group.teacher_id,
        group_number=db_teacher_group.group_number
    )

@router.put("/groups/{group_id}", response_model=TeacherGroupInfo)
def update_teacher_group(group_id: int, teacher_group: TeacherGroupUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/teachers/groups/{group_id} - Updating teacher group")
    db_teacher_group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not db_teacher_group:
        logger.warning(f"PUT /api/teachers/groups/{group_id} - Teacher group not found")
        raise HTTPException(status_code=404, detail="Teacher group not found")
    for key, value in teacher_group.items():
        if value is not None:
            setattr(db_teacher_group, key, value)
    db.commit()
    db.refresh(db_teacher_group)
    logger.info(f"PUT /api/teachers/groups/{group_id} - Successfully updated teacher group")
    return TeacherGroupInfo(
        id=db_teacher_group.id,
        teacher_id=db_teacher_group.teacher_id,
        group_number=db_teacher_group.group_number
    )

@router.delete("/groups/{group_id}")
def delete_teacher_group(group_id: int, db: Session = Depends(get_db)):
    logger.info(f"DELETE /api/teachers/groups/{group_id} - Deleting teacher group")
    db_teacher_group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not db_teacher_group:
        logger.warning(f"DELETE /api/teachers/groups/{group_id} - Teacher group not found")
        raise HTTPException(status_code=404, detail="Teacher group not found")
    
    db.delete(db_teacher_group)
    db.commit()
    
    logger.info(f"DELETE /api/teachers/groups/{group_id} - Successfully deleted teacher group")
    return {"message": "Teacher group deleted successfully"}

@router.get("/{teacher_id}/stats", response_model=TeacherStatsInfo)
def get_teacher_stats(teacher_id: int, db: Session = Depends(get_db)):
    """
    Получает статистику по работам для преподавателя:
    - Общее количество работ по группам, на которые назначен преподаватель
    - Количество непроверенных работ по группам, на которые назначен преподаватель
    """
    logger.info(f"GET /api/teachers/{teacher_id}/stats - Retrieving teacher statistics")
    
    # Проверяем, что преподаватель существует
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.is_deleted == False).first()
    if not teacher:
        logger.warning(f"GET /api/teachers/{teacher_id}/stats - Teacher not found")
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # 1. Находим группы, которые ведет данный преподаватель
    teacher_groups = db.query(TeacherGroup).filter(
        TeacherGroup.teacher_id == teacher_id
    ).all()
    
    if not teacher_groups:
        logger.info(f"GET /api/teachers/{teacher_id}/stats - No groups found for teacher")
        return TeacherStatsInfo(
            teacher_id=teacher_id,
            total_reviews=0,
            pending_reviews=0
        )
    
    # Получаем номера групп
    group_numbers = [tg.group_number.strip() for tg in teacher_groups if tg.group_number]
    logger.info(f"GET /api/teachers/{teacher_id}/stats - Teacher groups: {group_numbers}")
    
    if not group_numbers:
        return TeacherStatsInfo(
            teacher_id=teacher_id,
            total_reviews=0,
            pending_reviews=0
        )
    
    # 2. Находим студентов из этих групп
    students = db.query(Student).filter(
        Student.group_number.in_(group_numbers),
        Student.is_deleted == False
    ).all()
    
    if not students:
        logger.info(f"GET /api/teachers/{teacher_id}/stats - No students found in teacher groups")
        return TeacherStatsInfo(
            teacher_id=teacher_id,
            total_reviews=0,
            pending_reviews=0
        )
    
    student_ids = [student.id for student in students]
    logger.info(f"GET /api/teachers/{teacher_id}/stats - Students in groups: {len(student_ids)}")
    
    # 3. Получаем все работы студентов из групп преподавателя
    # Используем дедупликацию по student_id и number (берем последнюю работу по send_date)
    from sqlalchemy import func, and_, desc
    from sqlalchemy.orm import aliased
    
    # Получаем все работы студентов
    all_homework_reviews = db.query(HomeworkReview).filter(
        HomeworkReview.student_id.in_(student_ids)
    ).order_by(
        HomeworkReview.student_id,
        HomeworkReview.number,
        desc(HomeworkReview.send_date),
        desc(HomeworkReview.id)
    ).all()
    
    # Дедупликация: для каждой комбинации (student_id, number) берем работу по приоритету:
    # 1. Проверенные работы (result > 0) имеют приоритет над непроверенными (result == 0 или null)
    # 2. Если обе проверены или обе непроверены - берем последнюю по send_date
    work_map = {}  # {(student_id, number): HomeworkReview}
    
    for review in all_homework_reviews:
        key = (review.student_id, review.number)
        
        if key not in work_map:
            # Первая работа для этой комбинации
            work_map[key] = review
        else:
            existing_review = work_map[key]
            existing_result = existing_review.result or 0
            current_result = review.result or 0
            
            # Проверенные работы (result > 0) имеют приоритет над непроверенными
            if current_result > existing_result:
                # Текущая работа проверена, а существующая нет - заменяем
                work_map[key] = review
            elif current_result == existing_result:
                # Обе работы одинакового статуса (обе проверены или обе непроверены)
                # Берем последнюю по send_date
                existing_date = existing_review.send_date or ""
                current_date = review.send_date or ""
                
                if current_date > existing_date or (current_date == existing_date and review.id > existing_review.id):
                    work_map[key] = review
            # Если existing_result > current_result - оставляем существующую (она проверена)
    
    # Получаем список уникальных работ (последние по каждой комбинации)
    all_reviews = list(work_map.values())
    
    # Подсчитываем общее количество работ
    total_reviews = len(all_reviews)
    
    # Подсчитываем непроверенные работы (где result == 0 или null)
    pending_reviews = len([r for r in all_reviews if r.result == 0 or r.result is None])
    
    logger.info(f"GET /api/teachers/{teacher_id}/stats - Total reviews: {total_reviews}, Pending: {pending_reviews}")
    
    return TeacherStatsInfo(
        teacher_id=teacher_id,
        total_reviews=total_reviews,
        pending_reviews=pending_reviews
    )
