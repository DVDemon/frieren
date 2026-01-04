from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from typing import Dict, Any
from database import get_db, Student, Teacher, TeacherGroup, Lecture, Attendance, Homework, HomeworkReview, StudentHomeworkVariant, ExamGrade
from models import StudentInfo, TeacherInfo, TeacherGroupInfo, LectureInfo, AttendanceInfo, HomeworkInfo, HomeworkReviewInfo, StudentHomeworkVariantInfo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/all")
def export_all_data(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Экспорт всех данных из системы в единый JSON файл
    """
    logger.info("GET /api/export/all - Exporting all data")
    
    try:
        # Получаем всех студентов (включая удаленных)
        students = db.query(Student).all()
        students_data = [
            {
                "id": s.id,
                "year": s.year,
                "full_name": s.full_name,
                "telegram": s.telegram,
                "github": s.github,
                "group_number": s.group_number,
                "chat_id": s.chat_id,
                "is_deleted": s.is_deleted
            } for s in students
        ]
        
        # Получаем всех преподавателей (включая удаленных)
        teachers = db.query(Teacher).all()
        teachers_data = [
            {
                "id": t.id,
                "full_name": t.full_name,
                "telegram": t.telegram,
                "is_deleted": t.is_deleted
            } for t in teachers
        ]
        
        # Получаем все связи преподавателей с группами
        teacher_groups = db.query(TeacherGroup).all()
        teacher_groups_data = [
            {
                "id": tg.id,
                "teacher_id": tg.teacher_id,
                "group_number": tg.group_number
            } for tg in teacher_groups
        ]
        
        # Получаем все лекции
        lectures = db.query(Lecture).all()
        lectures_data = [
            {
                "id": l.id,
                "number": l.number,
                "topic": l.topic,
                "date": l.date,
                "start_time": l.start_time,
                "secret_code": l.secret_code,
                "max_student": l.max_student,
                "github_example": l.github_example
            } for l in lectures
        ]
        
        # Получаем все записи посещаемости
        attendance_records = db.query(Attendance).all()
        attendance_data = [
            {
                "id": att.id,
                "student_id": att.student_id,
                "lecture_id": att.lecture_id,
                "present": att.present
            } for att in attendance_records
        ]
        
        # Получаем все домашние задания
        homework = db.query(Homework).all()
        homework_data = [
            {
                "id": h.id,
                "number": h.number,
                "due_date": h.due_date,
                "short_description": h.short_description,
                "example_link": h.example_link,
                "assigned_date": h.assigned_date,
                "variants_count": h.variants_count
            } for h in homework
        ]
        
        # Получаем все проверки домашних заданий
        homework_reviews = db.query(HomeworkReview).all()
        homework_reviews_data = [
            {
                "id": hr.id,
                "student_id": hr.student_id,
                "number": hr.number,
                "send_date": hr.send_date,
                "review_date": hr.review_date,
                "url": hr.url,
                "result": hr.result,
                "comments": hr.comments,
                "local_directory": hr.local_directory,
                "ai_percentage": hr.ai_percentage
            } for hr in homework_reviews
        ]
        
        # Получаем все варианты домашних заданий студентов
        student_homework_variants = db.query(StudentHomeworkVariant).all()
        student_homework_variants_data = [
            {
                "id": shv.id,
                "student_id": shv.student_id,
                "homework_id": shv.homework_id,
                "variant_number": shv.variant_number
            } for shv in student_homework_variants
        ]
        
        # Получаем все экзаменационные оценки (без pdf_blob)
        exam_grades = db.query(ExamGrade).all()
        exam_grades_data = [
            {
                "id": eg.id,
                "date": eg.date,
                "grade": eg.grade,
                "variant_number": eg.variant_number,
                "student_id": eg.student_id
            } for eg in exam_grades
        ]
        
        # Формируем итоговый объект экспорта в формате, подходящем для импорта
        export_data = {
            "students": students_data,
            "teachers": teachers_data,
            "teacher_groups": teacher_groups_data,
            "lectures": lectures_data,
            "attendance": attendance_data,
            "homework": homework_data,
            "homework_reviews": homework_reviews_data,
            "student_homework_variants": student_homework_variants_data,
            "exam_grades": exam_grades_data
        }
        
        logger.info(f"GET /api/export/all - Successfully exported {len(students_data)} students, {len(teachers_data)} teachers, {len(lectures_data)} lectures, {len(homework_data)} homework assignments, {len(exam_grades_data)} exam grades")
        
        return export_data
        
    except Exception as e:
        logger.error(f"GET /api/export/all - Error exporting data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при экспорте данных: {str(e)}")
