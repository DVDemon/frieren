from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
import logging
from models import (
    StudentCreate, TeacherCreate, LectureCreate, HomeworkCreate, 
    HomeworkReviewCreate, AttendanceCreate, TeacherGroupCreate,
    StudentHomeworkVariantCreate
)
from database import (
    get_db, Student, Teacher, Lecture, Homework, HomeworkReview, 
    Attendance, TeacherGroup, StudentHomeworkVariant, ExamGrade
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["import"])

@router.post("/all")
async def import_all_data(data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Импортирует все данные из JSON файла.
    Сначала очищает все таблицы, затем импортирует новые данные.
    """
    logger.info("POST /api/import/all - Starting data import")
    
    try:
        # Очищаем все таблицы в правильном порядке (учитывая внешние ключи)
        logger.info("POST /api/import/all - Clearing existing data")
        
        # Удаляем данные в порядке зависимостей
        db.query(ExamGrade).delete()
        db.query(StudentHomeworkVariant).delete()
        db.query(HomeworkReview).delete()
        db.query(Attendance).delete()
        db.query(TeacherGroup).delete()
        db.query(Student).delete()
        db.query(Teacher).delete()
        db.query(Lecture).delete()
        db.query(Homework).delete()
        
        db.commit()
        logger.info("POST /api/import/all - Existing data cleared")
        
        # Счетчики для статистики
        import_stats = {
            'students': 0,
            'teachers': 0,
            'lectures': 0,
            'homework': 0,
            'homework_reviews': 0,
            'attendance': 0,
            'teacher_groups': 0,
            'student_homework_variants': 0,
            'exam_grades': 0,
            'total_records': 0
        }
        
        # Карты соответствия старых и новых ID
        id_mapping = {
            'students': {},
            'teachers': {},
            'lectures': {},
            'homework': {}
        }
        
        # Импортируем преподавателей
        if 'teachers' in data and data['teachers']:
            logger.info(f"POST /api/import/all - Importing {len(data['teachers'])} teachers")
            for teacher_data in data['teachers']:
                # Сохраняем старый ID для маппинга
                old_teacher_id = teacher_data.pop('id', None)
                is_deleted = teacher_data.pop('is_deleted', False)  # Сохраняем флаг удаления
                
                db_teacher = Teacher(**teacher_data)
                db_teacher.is_deleted = is_deleted  # Устанавливаем флаг удаления
                db.add(db_teacher)
                db.flush()  # Получаем новый ID
                
                # Сохраняем соответствие старого и нового ID
                if old_teacher_id is not None:
                    id_mapping['teachers'][old_teacher_id] = db_teacher.id
                
                import_stats['teachers'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['teachers']} teachers")
        
        # Импортируем студентов
        if 'students' in data and data['students']:
            logger.info(f"POST /api/import/all - Importing {len(data['students'])} students")
            for student_data in data['students']:
                # Сохраняем старый ID для маппинга
                old_student_id = student_data.pop('id', None)
                is_deleted = student_data.pop('is_deleted', False)  # Сохраняем флаг удаления
                
                db_student = Student(**student_data)
                db_student.is_deleted = is_deleted  # Устанавливаем флаг удаления
                db.add(db_student)
                db.flush()  # Получаем новый ID
                
                # Сохраняем соответствие старого и нового ID
                if old_student_id is not None:
                    id_mapping['students'][old_student_id] = db_student.id
                
                import_stats['students'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['students']} students")
        
        # Импортируем лекции
        if 'lectures' in data and data['lectures']:
            logger.info(f"POST /api/import/all - Importing {len(data['lectures'])} lectures")
            for lecture_data in data['lectures']:
                # Сохраняем старый ID для маппинга
                old_lecture_id = lecture_data.pop('id', None)
                
                # Обрабатываем опциональные поля (могут отсутствовать в старых данных)
                if 'max_student' not in lecture_data:
                    lecture_data['max_student'] = None
                if 'start_time' not in lecture_data:
                    lecture_data['start_time'] = None
                if 'github_example' not in lecture_data:
                    lecture_data['github_example'] = None
                if 'secret_code' not in lecture_data:
                    lecture_data['secret_code'] = None
                
                db_lecture = Lecture(**lecture_data)
                db.add(db_lecture)
                db.flush()  # Получаем новый ID
                
                # Сохраняем соответствие старого и нового ID
                if old_lecture_id is not None:
                    id_mapping['lectures'][old_lecture_id] = db_lecture.id
                
                import_stats['lectures'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['lectures']} lectures")
        
        # Импортируем домашние задания
        if 'homework' in data and data['homework']:
            logger.info(f"POST /api/import/all - Importing {len(data['homework'])} homework")
            for homework_data in data['homework']:
                # Сохраняем старый ID для маппинга
                old_homework_id = homework_data.pop('id', None)
                
                db_homework = Homework(**homework_data)
                db.add(db_homework)
                db.flush()  # Получаем новый ID
                
                # Сохраняем соответствие старого и нового ID
                if old_homework_id is not None:
                    id_mapping['homework'][old_homework_id] = db_homework.id
                
                import_stats['homework'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['homework']} homework")
        
        # Импортируем связи преподавателей с группами
        if 'teacher_groups' in data and data['teacher_groups']:
            logger.info(f"POST /api/import/all - Importing {len(data['teacher_groups'])} teacher groups")
            for tg_data in data['teacher_groups']:
                tg_data.pop('id', None)
                
                # Обновляем teacher_id используя маппинг
                old_teacher_id = tg_data.get('teacher_id')
                if old_teacher_id and old_teacher_id in id_mapping['teachers']:
                    tg_data['teacher_id'] = id_mapping['teachers'][old_teacher_id]
                
                db_tg = TeacherGroup(**tg_data)
                db.add(db_tg)
                import_stats['teacher_groups'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['teacher_groups']} teacher groups")
        
        # Импортируем варианты домашних заданий студентов
        if 'student_homework_variants' in data and data['student_homework_variants']:
            logger.info(f"POST /api/import/all - Importing {len(data['student_homework_variants'])} student homework variants")
            for variant_data in data['student_homework_variants']:
                variant_data.pop('id', None)
                
                # Обновляем student_id и homework_id используя маппинг
                old_student_id = variant_data.get('student_id')
                if old_student_id and old_student_id in id_mapping['students']:
                    variant_data['student_id'] = id_mapping['students'][old_student_id]
                
                old_homework_id = variant_data.get('homework_id')
                if old_homework_id and old_homework_id in id_mapping['homework']:
                    variant_data['homework_id'] = id_mapping['homework'][old_homework_id]
                
                db_variant = StudentHomeworkVariant(**variant_data)
                db.add(db_variant)
                import_stats['student_homework_variants'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['student_homework_variants']} student homework variants")
        
        # Импортируем проверки домашних заданий
        if 'homework_reviews' in data and data['homework_reviews']:
            logger.info(f"POST /api/import/all - Importing {len(data['homework_reviews'])} homework reviews")
            for review_data in data['homework_reviews']:
                review_data.pop('id', None)
                
                # Обновляем student_id используя маппинг
                old_student_id = review_data.get('student_id')
                if old_student_id and old_student_id in id_mapping['students']:
                    review_data['student_id'] = id_mapping['students'][old_student_id]
                
                # Обрабатываем опциональные поля (могут отсутствовать в старых данных)
                if 'review_date' not in review_data:
                    review_data['review_date'] = None
                if 'local_directory' not in review_data:
                    review_data['local_directory'] = None
                if 'ai_percentage' not in review_data:
                    review_data['ai_percentage'] = None
                
                db_review = HomeworkReview(**review_data)
                db.add(db_review)
                import_stats['homework_reviews'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['homework_reviews']} homework reviews")
        
        # Импортируем посещаемость
        if 'attendance' in data and data['attendance']:
            logger.info(f"POST /api/import/all - Importing {len(data['attendance'])} attendance records")
            for attendance_data in data['attendance']:
                attendance_data.pop('id', None)
                
                # Обновляем student_id и lecture_id используя маппинг
                old_student_id = attendance_data.get('student_id')
                if old_student_id and old_student_id in id_mapping['students']:
                    attendance_data['student_id'] = id_mapping['students'][old_student_id]
                
                old_lecture_id = attendance_data.get('lecture_id')
                if old_lecture_id and old_lecture_id in id_mapping['lectures']:
                    attendance_data['lecture_id'] = id_mapping['lectures'][old_lecture_id]
                
                db_attendance = Attendance(**attendance_data)
                db.add(db_attendance)
                import_stats['attendance'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['attendance']} attendance records")
        
        # Импортируем экзаменационные оценки
        if 'exam_grades' in data and data['exam_grades']:
            logger.info(f"POST /api/import/all - Importing {len(data['exam_grades'])} exam grades")
            for exam_grade_data in data['exam_grades']:
                exam_grade_data.pop('id', None)
                
                # Обновляем student_id используя маппинг
                old_student_id = exam_grade_data.get('student_id')
                if old_student_id and old_student_id in id_mapping['students']:
                    exam_grade_data['student_id'] = id_mapping['students'][old_student_id]
                
                # Создаем запись без pdf_blob (pdf_blob не экспортируется)
                db_exam_grade = ExamGrade(
                    date=exam_grade_data['date'],
                    grade=exam_grade_data['grade'],
                    variant_number=exam_grade_data['variant_number'],
                    student_id=exam_grade_data['student_id'],
                    pdf_blob=None  # PDF файлы не импортируются
                )
                db.add(db_exam_grade)
                import_stats['exam_grades'] += 1
            
            db.commit()
            logger.info(f"POST /api/import/all - Imported {import_stats['exam_grades']} exam grades")
        
        # Вычисляем общее количество записей
        import_stats['total_records'] = sum([
            import_stats['students'],
            import_stats['teachers'],
            import_stats['lectures'],
            import_stats['homework'],
            import_stats['homework_reviews'],
            import_stats['attendance'],
            import_stats['teacher_groups'],
            import_stats['student_homework_variants'],
            import_stats['exam_grades']
        ])
        
        logger.info(f"POST /api/import/all - Import completed successfully. Total records: {import_stats['total_records']}")
        
        return {
            "message": "Data imported successfully",
            "summary": import_stats
        }
        
    except Exception as e:
        logger.error(f"POST /api/import/all - Import failed: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
