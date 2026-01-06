from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, select
import logging
import os
import traceback
import gspread
from typing import Dict, Any, List
from database import get_db, Student, Teacher, TeacherGroup, Lecture, Attendance, Homework, HomeworkReview, StudentHomeworkVariant, ExamGrade
from models import StudentInfo, TeacherInfo, TeacherGroupInfo, LectureInfo, AttendanceInfo, HomeworkInfo, HomeworkReviewInfo, StudentHomeworkVariantInfo

from oauth2client.service_account import ServiceAccountCredentials
import gspread
from gspread.exceptions import WorksheetNotFound

logger = logging.getLogger(__name__)

JSON_KEYFILE        = 'google/credentials.json'
scope               = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
credentials         = ServiceAccountCredentials.from_json_keyfile_name(JSON_KEYFILE, scope)

# Получаем sheet_id из переменных окружения
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
if not GOOGLE_SHEET_ID:
    raise ValueError("GOOGLE_SHEET_ID environment variable is not set")

STUDENT_NAMES = "Студенты"
LECTIONS_NAMES = "Лекции"
RATING_NAMES = "Оценки"
EXAM_NAMES = "exam"

router = APIRouter(prefix="/api/google_sheet", tags=["export"])

@router.get("/all")
def export_all_google_sheet(db: Session = Depends(get_db)) -> Dict[str, Any]:
    # try to connect to google sheet
    data = dict()

    try:
        logger.info(f"Starting export_all_google_sheet. GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID[:20]}..." if GOOGLE_SHEET_ID else "GOOGLE_SHEET_ID is not set")
        
        logger.debug("Authorizing gspread client...")
        client = gspread.authorize(credentials)
        
        logger.debug(f"Opening spreadsheet by key: {GOOGLE_SHEET_ID}")
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        
        logger.debug(f"Getting worksheet: {STUDENT_NAMES}")
        try:
            sheet = spreadsheet.worksheet(STUDENT_NAMES)
            logger.debug(f"Found existing {STUDENT_NAMES} worksheet")
        except WorksheetNotFound:
            logger.warning(f"Worksheet {STUDENT_NAMES} not found, creating new one")
            sheet = spreadsheet.add_worksheet(title=STUDENT_NAMES, rows=1000, cols=50)
            logger.info(f"Created new {STUDENT_NAMES} worksheet")
        
        sheet_data = sheet.get_all_values()
        logger.debug(f"Retrieved {len(sheet_data)} rows from {STUDENT_NAMES} sheet")

        # Получаем всех студентов
        logger.debug("Querying students from database...")
        students = db.query(Student).filter(Student.is_deleted == False).all()
        logger.info(f"Found {len(students)} students")
        
        # Получаем всех преподавателей и их группы
        logger.debug("Querying teacher groups from database...")
        teacher_groups = db.query(TeacherGroup).all()
        teachers = {tg.group_number: tg.teacher_id for tg in teacher_groups}
        teacher_names = {}
        for tg in teacher_groups:
            teacher = db.query(Teacher).filter(Teacher.id == tg.teacher_id, Teacher.is_deleted == False).first()
            if teacher:
                teacher_names[tg.group_number] = teacher.full_name
        logger.debug(f"Found {len(teacher_names)} teacher groups")
        
        # Получаем все домашние задания
        logger.debug("Querying homeworks from database...")
        homeworks = db.query(Homework).all()
        logger.info(f"Found {len(homeworks)} homeworks")
        
        # Получаем варианты домашних заданий для студентов
        logger.debug("Querying student homework variants from database...")
        student_variants = db.query(StudentHomeworkVariant).all()
        variants_dict = {}
        for variant in student_variants:
            key = (variant.student_id, variant.homework_id)
            variants_dict[key] = variant.variant_number
        logger.debug(f"Found {len(student_variants)} student homework variants")

        # Формируем данные студентов с дополнительной информацией
        students_data = []
        for student in students:
            # Находим преподавателя для группы студента
            teacher_name = teacher_names.get(student.group_number, "")
            
            # Формируем варианты домашних заданий
            homework_variants = []
            for homework in homeworks:
                variant_key = (student.id, homework.id)
                variant_number = variants_dict.get(variant_key, "")
                homework_variants.append(str(variant_number) if variant_number else "")
            
            # Вычисляем статистику студента
            # Суммарный балл за все homework_review (только последние отправки по каждому варианту)
            # Подзапрос для получения максимального id для каждой комбинации (student_id, number)
            subquery = db.query(
                func.max(HomeworkReview.id).label('max_id')
            ).filter(
                HomeworkReview.student_id == student.id
            ).group_by(
                HomeworkReview.number
            ).subquery()
            
            total_homework_score = db.query(func.coalesce(func.sum(HomeworkReview.result), 0)).filter(
                and_(
                    HomeworkReview.student_id == student.id,
                    HomeworkReview.id.in_(select(subquery.c.max_id))
                )
            ).scalar() or 0
            
            # Средний балл за vibe coding - среднее значение ai_percentage из homework_review
            # где ai_percentage заполнен (не NULL)
            ai_percentage = db.query(func.avg(HomeworkReview.ai_percentage)).filter(
                HomeworkReview.student_id == student.id,
                HomeworkReview.ai_percentage.isnot(None)
            ).scalar()
            
            # Количество посещенных лекций (где present = 1)
            attendance_count = db.query(func.count(Attendance.id)).filter(
                Attendance.student_id == student.id,
                Attendance.present == 1
            ).scalar() or 0
            
            student_data = {
                "id": student.id,
                "full_name": student.full_name,
                "telegram": student.telegram,
                "github": student.github,
                "group_number": student.group_number,
                "teacher": teacher_name,
                "total_homework_score": int(total_homework_score),
                "ai_percentage": int(ai_percentage) if ai_percentage is not None else "",
                "attendance_count": int(attendance_count)
            }
            
            # Добавляем варианты домашних заданий
            for i, homework in enumerate(homeworks):
                student_data[f"homework_{homework.number}_variant"] = homework_variants[i]
            
            students_data.append(student_data)
        
        logger.info(f"Processed {len(students_data)} students with their data")

        # Записываем students_data в data (в Google Sheet)
        # Сначала очищаем существующие данные (кроме заголовков)
        logger.debug("Preparing sheet for update...")
        if sheet_data and len(sheet_data) > 1:
            logger.debug(f"Resizing sheet from {len(sheet_data)} rows to 1 row (keeping header)")
            sheet.resize(rows=1)  # Оставляем только заголовки

        # Формируем заголовки
        logger.debug("Building headers...")
        headers = ["id", "full_name", "telegram", "github", "group_number", "teacher", "total_homework_score", "ai_percentage", "attendance_count"]
        for homework in homeworks:
            headers.append(f"homework_{homework.number}_variant")
        logger.debug(f"Headers: {headers}")

        # Формируем строки для записи
        logger.debug("Building rows for update...")
        rows = [headers]
        for student_data in students_data:
            row = [
                student_data["id"],
                student_data["full_name"],
                student_data["telegram"],
                student_data["github"],
                student_data["group_number"],
                student_data["teacher"],
                student_data["total_homework_score"],
                str(student_data["ai_percentage"]) if student_data["ai_percentage"] is not None else "",
                student_data["attendance_count"]
            ]
            # Добавляем варианты домашних заданий
            for homework in homeworks:
                row.append(student_data[f"homework_{homework.number}_variant"])
            rows.append(row)

        # Записываем все строки в лист студентов
        logger.info(f"Updating {STUDENT_NAMES} sheet with {len(rows)} rows (including header)")
        sheet.update("A1", rows)
        logger.info(f"Successfully updated {STUDENT_NAMES} sheet")
        
        # Теперь заполняем лист с данными о посещаемости лекций
        try:
            logger.debug(f"Processing {LECTIONS_NAMES} sheet...")
            # Получаем или создаем лист "Лекции"
            try:
                logger.debug(f"Trying to get existing {LECTIONS_NAMES} worksheet...")
                lectures_sheet = spreadsheet.worksheet(LECTIONS_NAMES)
                logger.debug(f"Found existing {LECTIONS_NAMES} worksheet")
            except WorksheetNotFound:
                logger.warning(f"Worksheet {LECTIONS_NAMES} not found, creating new one")
                lectures_sheet = spreadsheet.add_worksheet(title=LECTIONS_NAMES, rows=1000, cols=50)
                logger.info(f"Created new {LECTIONS_NAMES} worksheet")
            
            # Получаем все лекции
            lectures = db.query(Lecture).order_by(Lecture.number).all()
            
            # Получаем данные о посещаемости
            attendance_records = db.query(Attendance).all()
            attendance_dict = {}
            for record in attendance_records:
                key = (record.student_id, record.lecture_id)
                attendance_dict[key] = record.present
            
            # Формируем заголовки для листа лекций
            lectures_headers = ["id", "full_name", "telegram"]
            for lecture in lectures:
                lectures_headers.append(f"lecture_{lecture.number}")
            
            # Формируем строки для листа лекций
            lectures_rows = [lectures_headers]
            for student in students:
                row = [
                    student.id,
                    student.full_name,
                    student.telegram
                ]
                # Добавляем данные о посещаемости для каждой лекции
                for lecture in lectures:
                    attendance_key = (student.id, lecture.id)
                    present = attendance_dict.get(attendance_key, 0)
                    row.append("Да" if present == 1 else "Нет")
                lectures_rows.append(row)
            
            # Записываем данные в лист лекций
            logger.info(f"Updating {LECTIONS_NAMES} sheet with {len(lectures_rows)} rows")
            lectures_sheet.clear()
            lectures_sheet.update("A1", lectures_rows)
            logger.info(f"Successfully updated {LECTIONS_NAMES} sheet")
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.warning(f"Error creating/updating lectures sheet: {str(e)}")
            logger.warning(f"Error type: {type(e).__name__}")
            logger.warning(f"Error traceback:\n{error_traceback}")
            # Продолжаем выполнение, даже если не удалось создать лист лекций
        
        # Теперь заполняем лист с данными об оценках
        try:
            logger.debug(f"Processing {RATING_NAMES} sheet...")
            # Получаем или создаем лист "Оценки"
            try:
                logger.debug(f"Trying to get existing {RATING_NAMES} worksheet...")
                ratings_sheet = spreadsheet.worksheet(RATING_NAMES)
                logger.debug(f"Found existing {RATING_NAMES} worksheet")
            except WorksheetNotFound:
                logger.warning(f"Worksheet {RATING_NAMES} not found, creating new one")
                ratings_sheet = spreadsheet.add_worksheet(title=RATING_NAMES, rows=1000, cols=50)
                logger.info(f"Created new {RATING_NAMES} worksheet")
            
            # Получаем все проверки домашних заданий
            homework_reviews = db.query(HomeworkReview).all()
            reviews_dict = {}
            for review in homework_reviews:
                key = (review.student_id, review.number)
                reviews_dict[key] = review
            
            # Формируем заголовки для листа оценок
            ratings_headers = ["full_name", "telegram","group_number"]
            for homework in homeworks:
                ratings_headers.extend([
                    f"homework_{homework.number}_url",
                    f"homework_{homework.number}_send_date",
                    f"homework_{homework.number}_review_date",
                    f"homework_{homework.number}_ai_percentage",
                    f"homework_{homework.number}_grade"
                ])
            
            # Получаем существующие данные из листа оценок
            existing_ratings_data = ratings_sheet.get_all_values()
            existing_ratings_dict = {}
            
            if len(existing_ratings_data) > 1:  # Есть данные кроме заголовков
                # Создаем словарь существующих данных по студентам
                for row in existing_ratings_data[1:]:  # Пропускаем заголовки
                    if len(row) >= 3:  # Минимум full_name и telegram
                        student_name = row[0]
                        student_telegram = row[1]
                        student_group_number = row[2]
                        existing_ratings_dict[student_telegram] = row
            
            # Формируем строки для листа оценок
            ratings_rows = [ratings_headers]
            for student in students:
                row = [student.full_name, student.telegram,student.group_number]
                
                # Проверяем, есть ли существующие данные для этого студента
                existing_row = existing_ratings_dict.get(student.telegram, [])
                
                for homework in homeworks:
                    review_key = (student.id, homework.number)
                    review = reviews_dict.get(review_key)
                    
                    # URL репозитория
                    if review and review.url:
                        row.append(review.url)
                    # elif existing_row and len(existing_row) > 2 + (homework.number - 1) * 5:
                    #     row.append(existing_row[2 + (homework.number - 1) * 5] or "")
                    else:
                        row.append("")
                    
                    # Дата отправки
                    if review and review.send_date:
                        row.append(review.send_date)
                    # elif existing_row and len(existing_row) > 3 + (homework.number - 1) * 5:
                    #     row.append(existing_row[3 + (homework.number - 1) * 5] or "")
                    else:
                        row.append("")
                    
                    # Дата проверки
                    if review and review.review_date:
                        row.append(review.review_date)
                    elif existing_row and len(existing_row) >= 5 + (homework.number - 1) * 5:
                        row.append(existing_row[3+2 + (homework.number - 1) * 5] or "")
                    else:
                        row.append("")
                    
                    # Процент AI генерации
                    if review and review.ai_percentage is not None:
                        row.append(str(review.ai_percentage))
                    else:
                        row.append("")
                    
                    # Оценка преподавателя
                    if review and review.result and review.result > 0:
                        row.append(str(review.result))
                    elif existing_row and len(existing_row) >= 7 + (homework.number - 1) * 5:
                        row.append(existing_row[7 + (homework.number - 1) * 5] or "")
                    else:
                        row.append("")
                
                ratings_rows.append(row)
            
            # Записываем данные в лист оценок
            logger.info(f"Updating {RATING_NAMES} sheet with {len(ratings_rows)} rows")
            ratings_sheet.clear()
            ratings_sheet.update("A1", ratings_rows)
            logger.info(f"Successfully updated {RATING_NAMES} sheet")
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.warning(f"Error creating/updating ratings sheet: {str(e)}")
            logger.warning(f"Error type: {type(e).__name__}")
            logger.warning(f"Error traceback:\n{error_traceback}")
            # Продолжаем выполнение, даже если не удалось создать лист оценок
        
        # Теперь заполняем лист с данными об экзаменационных оценках
        try:
            logger.debug(f"Processing {EXAM_NAMES} sheet...")
            # Получаем или создаем лист "exam"
            try:
                logger.debug(f"Trying to get existing {EXAM_NAMES} worksheet...")
                exam_sheet = spreadsheet.worksheet(EXAM_NAMES)
                logger.debug(f"Found existing {EXAM_NAMES} worksheet")
            except WorksheetNotFound:
                logger.warning(f"Worksheet {EXAM_NAMES} not found, creating new one")
                exam_sheet = spreadsheet.add_worksheet(title=EXAM_NAMES, rows=1000, cols=50)
                logger.info(f"Created new {EXAM_NAMES} worksheet")
            
            # Получаем все экзаменационные оценки
            exam_grades = db.query(ExamGrade).all()
            
            # Создаем словарь для быстрого поиска оценок по student_id
            exam_grades_dict = {}
            for exam_grade in exam_grades:
                if exam_grade.student_id not in exam_grades_dict:
                    exam_grades_dict[exam_grade.student_id] = []
                exam_grades_dict[exam_grade.student_id].append(exam_grade)
            
            # Формируем заголовки для листа экзаменов
            exam_headers = ["id", "full_name", "telegram", "group_number", "date", "grade", "variant_number"]
            
            # Формируем строки для листа экзаменов
            exam_rows = [exam_headers]
            for student in students:
                # Получаем оценки для этого студента
                student_exam_grades = exam_grades_dict.get(student.id, [])
                
                if student_exam_grades:
                    # Если у студента есть оценки, создаем строку для каждой оценки
                    for exam_grade in student_exam_grades:
                        row = [
                            student.id,
                            student.full_name,
                            student.telegram,
                            student.group_number,
                            exam_grade.date,
                            exam_grade.grade,
                            exam_grade.variant_number
                        ]
                        exam_rows.append(row)
                else:
                    # Если у студента нет оценок, создаем строку с пустыми полями для оценки
                    row = [
                        student.id,
                        student.full_name,
                        student.telegram,
                        student.group_number,
                        "",  # date
                        "",  # grade
                        ""   # variant_number
                    ]
                    exam_rows.append(row)
            
            # Записываем данные в лист экзаменов
            logger.info(f"Updating {EXAM_NAMES} sheet with {len(exam_rows)} rows")
            exam_sheet.clear()
            exam_sheet.update("A1", exam_rows)
            logger.info(f"Successfully updated {EXAM_NAMES} sheet with {len(exam_rows) - 1} data rows")
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.warning(f"Error creating/updating exam sheet: {str(e)}")
            logger.warning(f"Error type: {type(e).__name__}")
            logger.warning(f"Error traceback:\n{error_traceback}")
            # Продолжаем выполнение, даже если не удалось создать лист экзаменов
        
        # Возвращаем структурированный ответ
        lectures_count = len(lectures) if 'lectures' in locals() else 0
        reviews_count = len(homework_reviews) if 'homework_reviews' in locals() else 0
        exam_grades_count = len(exam_grades) if 'exam_grades' in locals() else 0
        
        logger.info(f"Export completed successfully. Students: {len(students_data)}, Homeworks: {len(homeworks)}, Lectures: {lectures_count}, Reviews: {reviews_count}, Exam grades: {exam_grades_count}")
        
        data = {
            "success": True,
            "message": "Data exported successfully to Google Sheet",
            "students_count": len(students_data),
            "homeworks_count": len(homeworks),
            "lectures_count": lectures_count,
            "reviews_count": reviews_count,
            "exam_grades_count": exam_grades_count,
            "sheet_data": rows
        }

    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"Error exporting all google sheet: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error traceback:\n{error_traceback}")
        logger.error(f"GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID}")
        logger.error(f"STUDENT_NAMES: {STUDENT_NAMES}")
        logger.error(f"LECTIONS_NAMES: {LECTIONS_NAMES}")
        logger.error(f"RATING_NAMES: {RATING_NAMES}")
        logger.error(f"EXAM_NAMES: {EXAM_NAMES}")
        raise HTTPException(status_code=500, detail=str(e))

        
    return data

@router.post("/export-student-attendance")
def export_student_attendance_to_google_sheet(student_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Экспортирует информацию о посещаемости лекций одного студента в Google Sheet
    """
    data = dict()
    
    try:
        logger.info(f"Starting export_student_attendance_to_google_sheet for student_id: {student_id}")
        
        # Находим студента в базе с таким id
        logger.debug(f"Querying student with id: {student_id}")
        student = db.query(Student).filter(Student.id == student_id, Student.is_deleted == False).first()
        if not student:
            logger.warning(f"Student with id {student_id} not found")
            raise HTTPException(status_code=404, detail=f"Student with id {student_id} not found")
        
        logger.debug(f"Found student: {student.full_name} (telegram: {student.telegram})")
        
        # Подключаемся к Google Sheet
        logger.debug("Authorizing gspread client...")
        client = gspread.authorize(credentials)
        
        logger.debug(f"Opening spreadsheet by key: {GOOGLE_SHEET_ID}")
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        
        # Получаем лист "Лекции"
        try:
            logger.debug(f"Trying to get existing {LECTIONS_NAMES} worksheet...")
            sheet = spreadsheet.worksheet(LECTIONS_NAMES)
            logger.debug(f"Found existing {LECTIONS_NAMES} worksheet")
        except WorksheetNotFound:
            logger.warning(f"Worksheet {LECTIONS_NAMES} not found, creating new one")
            sheet = spreadsheet.add_worksheet(title=LECTIONS_NAMES, rows=1000, cols=50)
            logger.info(f"Created new {LECTIONS_NAMES} worksheet")
        
        # Получаем все данные из листа
        sheet_data = sheet.get_all_values()
        
        # Получаем все лекции
        lectures = db.query(Lecture).order_by(Lecture.number).all()
        
        # Получаем данные о посещаемости студента
        attendance_records = db.query(Attendance).filter(Attendance.student_id == student_id).all()
        attendance_dict = {}
        for record in attendance_records:
            attendance_dict[record.lecture_id] = record.present
        
        # Формируем заголовки если лист пустой
        if len(sheet_data) == 0:
            headers = ["id", "full_name", "telegram"]
            for lecture in lectures:
                headers.append(f"lecture_{lecture.number}")
            sheet_data = [headers]
        
        # Находим строку студента по telegram
        student_row_index = None
        for i, row in enumerate(sheet_data):
            if len(row) >= 3 and row[2] == student.telegram:  # Проверяем по telegram (индекс 2)
                student_row_index = i
                break
        
        # Формируем данные студента
        student_data = [
            student.id,
            student.full_name,
            student.telegram
        ]
        
        # Добавляем данные о посещаемости для каждой лекции
        for lecture in lectures:
            present = attendance_dict.get(lecture.id, 0)
            student_data.append("Да" if present == 1 else "Нет")
        
        # Если строка студента найдена, обновляем её
        if student_row_index is not None:
            # Убеждаемся, что у нас достаточно колонок в строке
            while len(sheet_data[student_row_index]) < len(student_data):
                sheet_data[student_row_index].append("")
            
            # Обновляем данные в строке
            for i, value in enumerate(student_data):
                sheet_data[student_row_index][i] = value
            
            action = "updated"
        else:
            # Добавляем новую строку в конец
            sheet_data.append(student_data)
            student_row_index = len(sheet_data) - 1
            action = "added"
        
        # Записываем обновленные данные в лист
        sheet.clear()
        sheet.update("A1", sheet_data)
        
        # Подсчитываем статистику посещаемости
        total_lectures = len(lectures)
        attended_lectures = sum(1 for present in attendance_dict.values() if present == 1)
        attendance_percentage = round((attended_lectures / total_lectures) * 100) if total_lectures > 0 else 0
        
        data = {
            "success": True,
            "message": f"Student attendance {student_id} exported successfully to Google Sheet",
            "student_name": student.full_name,
            "student_telegram": student.telegram,
            "total_lectures": total_lectures,
            "attended_lectures": attended_lectures,
            "attendance_percentage": attendance_percentage,
            "row_number": student_row_index + 1,  # +1 для отображения номера строки в Google Sheets
            "action": action
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"Error exporting student attendance {student_id} to google sheet: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error traceback:\n{error_traceback}")
        logger.error(f"GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID}")
        logger.error(f"LECTIONS_NAMES: {LECTIONS_NAMES}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return data

@router.post("/export-student")
def export_student_to_google_sheet(student_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Экспортирует информацию по одному студенту в Google Sheet
    """
    data = dict()
    
    try:
        logger.info(f"Starting export_student_to_google_sheet for student_id: {student_id}")
        
        # Находим студента в базе с таким id
        logger.debug(f"Querying student with id: {student_id}")
        student = db.query(Student).filter(Student.id == student_id, Student.is_deleted == False).first()
        if not student:
            logger.warning(f"Student with id {student_id} not found")
            raise HTTPException(status_code=404, detail=f"Student with id {student_id} not found")
        
        logger.debug(f"Found student: {student.full_name} (telegram: {student.telegram}, group: {student.group_number})")
        
        # Подключаемся к Google Sheet
        logger.debug("Authorizing gspread client...")
        client = gspread.authorize(credentials)
        
        logger.debug(f"Opening spreadsheet by key: {GOOGLE_SHEET_ID}")
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        
        # Получаем лист "Студенты"
        try:
            logger.debug(f"Trying to get existing {STUDENT_NAMES} worksheet...")
            sheet = spreadsheet.worksheet(STUDENT_NAMES)
            logger.debug(f"Found existing {STUDENT_NAMES} worksheet")
        except WorksheetNotFound:
            logger.warning(f"Worksheet {STUDENT_NAMES} not found, creating new one")
            sheet = spreadsheet.add_worksheet(title=STUDENT_NAMES, rows=1000, cols=50)
            logger.info(f"Created new {STUDENT_NAMES} worksheet")
        
        # Получаем все данные из листа
        sheet_data = sheet.get_all_values()
        
        # Получаем всех преподавателей и их группы
        teacher_groups = db.query(TeacherGroup).all()
        teacher_names = {}
        for tg in teacher_groups:
            teacher = db.query(Teacher).filter(Teacher.id == tg.teacher_id, Teacher.is_deleted == False).first()
            if teacher:
                teacher_names[tg.group_number] = teacher.full_name
        
        # Получаем все домашние задания
        homeworks = db.query(Homework).all()
        
        # Получаем варианты домашних заданий для студента
        student_variants = db.query(StudentHomeworkVariant).filter(StudentHomeworkVariant.student_id == student_id).all()
        variants_dict = {}
        for variant in student_variants:
            variants_dict[variant.homework_id] = variant.variant_number
        
        # Находим преподавателя для группы студента
        teacher_name = teacher_names.get(student.group_number, "")
        
        # Вычисляем статистику студента
        # Суммарный балл за все homework_review (только последние отправки по каждому варианту)
        # Подзапрос для получения максимального id для каждой комбинации (student_id, number)
        subquery = db.query(
            func.max(HomeworkReview.id).label('max_id')
        ).filter(
            HomeworkReview.student_id == student.id
        ).group_by(
            HomeworkReview.number
        ).subquery()
        
        total_homework_score = db.query(func.coalesce(func.sum(HomeworkReview.result), 0)).filter(
            and_(
                HomeworkReview.student_id == student.id,
                HomeworkReview.id.in_(select(subquery.c.max_id))
            )
        ).scalar() or 0
        
        # Средний балл за vibe coding - среднее значение ai_percentage из homework_review
        # где ai_percentage заполнен (не NULL)
        ai_percentage = db.query(func.avg(HomeworkReview.ai_percentage)).filter(
            HomeworkReview.student_id == student.id,
            HomeworkReview.ai_percentage.isnot(None)
        ).scalar()
        
        # Количество посещенных лекций (где present = 1)
        attendance_count = db.query(func.count(Attendance.id)).filter(
            Attendance.student_id == student.id,
            Attendance.present == 1
        ).scalar() or 0
        
        # Формируем заголовки если лист пустой
        if len(sheet_data) == 0:
            headers = ["id", "full_name", "telegram", "github", "group_number", "teacher", "total_homework_score", "ai_percentage", "attendance_count"]
            for homework in homeworks:
                headers.append(f"homework_{homework.number}_variant")
            sheet_data = [headers]
        
        # Находим строку студента по telegram
        student_row_index = None
        for i, row in enumerate(sheet_data):
            if len(row) >= 4 and row[2] == student.telegram:  # Проверяем по telegram (индекс 2)
                student_row_index = i
                break
        
        # Формируем данные студента
        student_data = [
            student.id,
            student.full_name,
            student.telegram,
            student.github,
            student.group_number,
            teacher_name,
            int(total_homework_score),
            str(ai_percentage) if ai_percentage is not None else "",
            int(attendance_count)
        ]
        
        # Добавляем варианты домашних заданий
        for homework in homeworks:
            variant_number = variants_dict.get(homework.id, "")
            student_data.append(str(variant_number) if variant_number else "")
        
        # Если строка студента найдена, обновляем её
        if student_row_index is not None:
            # Убеждаемся, что у нас достаточно колонок в строке
            while len(sheet_data[student_row_index]) < len(student_data):
                sheet_data[student_row_index].append("")
            
            # Обновляем данные в строке
            for i, value in enumerate(student_data):
                sheet_data[student_row_index][i] = value
            
            action = "updated"
        else:
            # Добавляем новую строку в конец
            sheet_data.append(student_data)
            student_row_index = len(sheet_data) - 1
            action = "added"
        
        # Записываем обновленные данные в лист
        sheet.clear()
        sheet.update("A1", sheet_data)
        
        data = {
            "success": True,
            "message": f"Student {student_id} exported successfully to Google Sheet",
            "student_name": student.full_name,
            "student_telegram": student.telegram,
            "group_number": student.group_number,
            "teacher_name": teacher_name,
            "homeworks_count": len(homeworks),
            "variants_count": len(student_variants),
            "row_number": student_row_index + 1,  # +1 для отображения номера строки в Google Sheets
            "action": action
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"Error exporting student {student_id} to google sheet: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error traceback:\n{error_traceback}")
        logger.error(f"GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID}")
        logger.error(f"STUDENT_NAMES: {STUDENT_NAMES}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return data

@router.post("/export-review")
def export_review_to_google_sheet(review_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Экспортирует конкретную проверку домашнего задания по ID в Google Sheet
    """
    data = dict()
    
    try:
        logger.info(f"Starting export_review_to_google_sheet for review_id: {review_id}")
        
        # Находим homework_review в базе с таким id
        logger.debug(f"Querying homework review with id: {review_id}")
        review = db.query(HomeworkReview).filter(HomeworkReview.id == review_id).first()
        if not review:
            logger.warning(f"Homework review with id {review_id} not found")
            raise HTTPException(status_code=404, detail=f"Homework review with id {review_id} not found")
        
        logger.debug(f"Found review: student_id={review.student_id}, number={review.number}, url={review.url}")
        
        # Находим студента для которого homework_review
        logger.debug(f"Querying student with id: {review.student_id}")
        student = db.query(Student).filter(Student.id == review.student_id).first()
        if not student:
            logger.warning(f"Student with id {review.student_id} not found")
            raise HTTPException(status_code=404, detail=f"Student with id {review.student_id} not found")
        
        logger.debug(f"Found student: {student.full_name} (telegram: {student.telegram})")
        
        # Подключаемся к Google Sheet
        logger.debug("Authorizing gspread client...")
        client = gspread.authorize(credentials)
        
        logger.debug(f"Opening spreadsheet by key: {GOOGLE_SHEET_ID}")
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        
        # Получаем или создаем лист "Оценки"
        try:
            logger.debug(f"Trying to get existing {RATING_NAMES} worksheet...")
            ratings_sheet = spreadsheet.worksheet(RATING_NAMES)
            logger.debug(f"Found existing {RATING_NAMES} worksheet")
        except WorksheetNotFound:
            logger.warning(f"Worksheet {RATING_NAMES} not found, creating new one")
            ratings_sheet = spreadsheet.add_worksheet(title=RATING_NAMES, rows=1000, cols=50)
            logger.info(f"Created new {RATING_NAMES} worksheet")
        
        # Получаем все данные из листа
        ratings_data = ratings_sheet.get_all_values()
        
        # Получаем все домашние задания для определения структуры колонок
        homeworks = db.query(Homework).all()
        homeworks_by_number = {homework.number: homework for homework in homeworks}
        
        # Формируем заголовки если лист пустой
        if len(ratings_data) == 0:
            ratings_headers = ["full_name", "telegram","group_number"]
            for homework in homeworks:
                ratings_headers.extend([
                    f"homework_{homework.number}_url",
                    f"homework_{homework.number}_send_date",
                    f"homework_{homework.number}_review_date",
                    f"homework_{homework.number}_ai_percentage",
                    f"homework_{homework.number}_grade"
                ])
            ratings_data = [ratings_headers]
        
        # Находим или создаем строку для студента
        student_row_index = None
        for i, row in enumerate(ratings_data):
            if len(row) >= 2 and row[1] == student.telegram:  # Проверяем по telegram
                student_row_index = i
                break
        
        # Если строка студента не найдена, добавляем новую
        if student_row_index is None:
            # Создаем новую строку для студента
            new_row = [student.full_name, student.telegram,student.group_number]
            
            # Добавляем пустые колонки для всех домашних заданий
            for homework in homeworks:
                new_row.extend(["", "", "", "", ""])  # url, send_date, review_date, ai_percentage, grade
            
            ratings_data.append(new_row)
            student_row_index = len(ratings_data) - 1
        
        # Вычисляем индексы колонок для данного домашнего задания
        homework_number = review.number
        base_index = 3 + (homework_number - 1) * 5
        url_index = base_index
        send_date_index = base_index + 1
        review_date_index = base_index + 2
        ai_percentage_index = base_index + 3
        grade_index = base_index + 4
        
        # Убеждаемся, что у нас достаточно колонок в строке
        while len(ratings_data[student_row_index]) <= grade_index:
            ratings_data[student_row_index].append("")
        
        # Обновляем данные в строке студента
        row = ratings_data[student_row_index]
        
        # URL репозитория
        if review.url:
            row[url_index] = review.url
        
        # Дата отправки
        if review.send_date:
            row[send_date_index] = review.send_date
        
        # Дата проверки
        if review.review_date:
            row[review_date_index] = review.review_date
        
        # Процент AI генерации
        if review.ai_percentage is not None:
            row[ai_percentage_index] = str(review.ai_percentage)
        
        # Оценка преподавателя
        if review.result and review.result > 0:
            row[grade_index] = str(review.result)
        
        # Записываем обновленные данные в лист
        ratings_sheet.clear()
        ratings_sheet.update("A1", ratings_data)
        
        data = {
            "success": True,
            "message": f"Review {review_id} exported successfully to Google Sheet",
            "student_name": student.full_name,
            "student_telegram": student.telegram,
            "homework_number": homework_number,
            "row_updated": student_row_index + 1,  # +1 для отображения номера строки в Google Sheets
            "url_updated": bool(review.url),
            "send_date_updated": bool(review.send_date),
            "review_date_updated": bool(review.review_date),
            "ai_percentage_updated": review.ai_percentage is not None,
            "grade_updated": bool(review.result and review.result > 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"Error exporting review {review_id} to google sheet: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error traceback:\n{error_traceback}")
        logger.error(f"GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID}")
        logger.error(f"RATING_NAMES: {RATING_NAMES}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return data

@router.post("/import-ratings")
def import_ratings_from_google_sheet(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Импортирует данные о проверках домашних заданий из Google Sheet
    """
    data = dict()
    
    try:
        logger.info("Starting import_ratings_from_google_sheet")
        logger.debug(f"GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID}")
        
        logger.debug("Authorizing gspread client...")
        client = gspread.authorize(credentials)
        
        logger.debug(f"Opening spreadsheet by key: {GOOGLE_SHEET_ID}")
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        
        # Получаем лист "Оценки"
        try:
            logger.debug(f"Trying to get existing {RATING_NAMES} worksheet...")
            ratings_sheet = spreadsheet.worksheet(RATING_NAMES)
            logger.debug(f"Found existing {RATING_NAMES} worksheet")
        except WorksheetNotFound:
            logger.warning(f"Worksheet {RATING_NAMES} not found, creating new one")
            ratings_sheet = spreadsheet.add_worksheet(title=RATING_NAMES, rows=1000, cols=50)
            logger.info(f"Created new {RATING_NAMES} worksheet")
        
        # Получаем данные из листа
        ratings_data = ratings_sheet.get_all_values()
        
        if len(ratings_data) < 2:  # Только заголовки или пустой лист
            return {
                "success": True,
                "message": "No data to import",
                "imported_count": 0,
                "updated_count": 0,
                "created_count": 0
            }
        
        # Получаем заголовки
        headers = ratings_data[0]
        
        # Получаем всех студентов для поиска по telegram
        students = db.query(Student).filter(Student.is_deleted == False).all()
        students_by_telegram = {student.telegram: student for student in students}
        
        # Получаем все домашние задания
        homeworks = db.query(Homework).all()
        homeworks_by_number = {homework.number: homework for homework in homeworks}
        
        # Счетчики для статистики
        imported_count = 0
        updated_count = 0
        created_count = 0
        
        # Обрабатываем каждую строку данных (пропускаем заголовки)
        for row in ratings_data[1:]:
            if len(row) < 2:  # Минимум full_name и telegram
                continue
                
            full_name = row[0]
            telegram = row[1]
            
            # Находим студента по telegram
            student = students_by_telegram.get(telegram)
            if not student:
                logger.warning(f"Student not found for telegram: {telegram}")
                continue
            
            # Обрабатываем каждое домашнее задание
            for homework in homeworks:
                homework_number = homework.number
                
                # Вычисляем индексы колонок для данного домашнего задания
                base_index = 3 + (homework_number - 1) * 5
                url_index = base_index
                send_date_index = base_index + 1
                review_date_index = base_index + 2
                ai_percentage_index = base_index + 3
                grade_index = base_index + 4
                
                # Проверяем, что у нас есть достаточно колонок
                if len(row) <= grade_index:
                    continue
                
                # Получаем данные из строки
                url = row[url_index] if url_index < len(row) else ""
                send_date = row[send_date_index] if send_date_index < len(row) else ""
                review_date = row[review_date_index] if review_date_index < len(row) else ""
                ai_percentage_str = row[ai_percentage_index] if ai_percentage_index < len(row) else ""
                grade_str = row[grade_index] if grade_index < len(row) else ""

                grade_str = grade_str.lstrip("'").lstrip("`")
                
                # Проверяем, есть ли хотя бы одно заполненное поле
                has_data = any([
                    url.strip(),
                    send_date.strip(),
                    review_date.strip(),
                    ai_percentage_str.strip(),
                    grade_str.strip()
                ])
                
                if not has_data:
                    continue
                
                # Парсим числовые значения
                ai_percentage = None
                if ai_percentage_str.strip():
                    try:
                        ai_percentage = float(ai_percentage_str)
                    except ValueError:
                        logger.warning(f"Invalid AI percentage for student {telegram}, homework {homework_number}: {ai_percentage_str}")
                
                grade = None
                if grade_str.strip():
                    try:
                        grade = int(grade_str)
                    except ValueError:
                        logger.warning(f"Invalid grade for student {telegram}, homework {homework_number}: {grade_str}")
                
                # Ищем самую последнюю запись homework_review для данного студента и домашнего задания
                existing_review = db.query(HomeworkReview).filter(
                    HomeworkReview.student_id == student.id,
                    HomeworkReview.number == homework_number
                ).order_by(HomeworkReview.id.desc()).first()
                
                if existing_review:
                    # Обновляем существующую запись
                    update_data = {}

                    
                    
                    if url.strip():
                        update_data["url"] = url
                    if send_date.strip():
                        update_data["send_date"] = send_date
                    if review_date.strip():
                        update_data["review_date"] = review_date
                    if ai_percentage is not None:
                        update_data["ai_percentage"] = ai_percentage
                    if grade is not None and grade > 0:
                        update_data["result"] = grade

                    logger.debug(f"Updating review for student {telegram}, homework {homework_number}")
                    logger.debug(f"Update data: {update_data}")
                    logger.debug(f"Existing review: {existing_review.__dict__}")
                    
                    # Обновляем только заполненные поля
                    for field, value in update_data.items():
                        setattr(existing_review, field, value)
                    
                    db.commit()
                    updated_count += 1
                    logger.info(f"Updated review for student {telegram}, homework {homework_number}")
                    
                else:
                    # Создаем новую запись
                    new_review = HomeworkReview(
                        student_id=student.id,
                        number=homework_number,
                        send_date=send_date if send_date.strip() else "",
                        review_date=review_date if review_date.strip() else None,
                        url=url if url.strip() else "",
                        result=grade if grade is not None and grade > 0 else 0,
                        comments="",
                        ai_percentage=ai_percentage
                    )
                    
                    db.add(new_review)
                    db.commit()
                    created_count += 1
                    logger.info(f"Created new review for student {telegram}, homework {homework_number}")
                
                imported_count += 1
        
        data = {
            "success": True,
            "message": "Data imported successfully from Google Sheet",
            "imported_count": imported_count,
            "updated_count": updated_count,
            "created_count": created_count
        }
        
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"Error importing ratings from google sheet: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error traceback:\n{error_traceback}")
        logger.error(f"GOOGLE_SHEET_ID: {GOOGLE_SHEET_ID}")
        logger.error(f"RATING_NAMES: {RATING_NAMES}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return data
