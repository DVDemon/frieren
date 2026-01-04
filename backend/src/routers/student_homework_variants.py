from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import logging
from models import StudentHomeworkVariantInfo, StudentHomeworkVariantCreate, StudentHomeworkVariantUpdate
from database import get_db, StudentHomeworkVariant, Student, Homework

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/student-homework-variants", tags=["student_homework_variants"])

@router.get("/", response_model=List[StudentHomeworkVariantInfo])
@router.get("", response_model=List[StudentHomeworkVariantInfo])
def get_student_homework_variants(db: Session = Depends(get_db)):
    logger.info("GET /api/student-homework-variants - Retrieving all student homework variants")
    variants = db.query(StudentHomeworkVariant).all()
    logger.info(f"GET /api/student-homework-variants - Retrieved {len(variants)} variants")
    return [StudentHomeworkVariantInfo(
        id=variant.id,
        student_id=variant.student_id,
        homework_id=variant.homework_id,
        variant_number=variant.variant_number
    ) for variant in variants]

@router.get("/student/{student_id}", response_model=List[StudentHomeworkVariantInfo])
def get_variants_by_student(student_id: int, db: Session = Depends(get_db)):
    logger.info(f"GET /api/student-homework-variants/student/{student_id} - Retrieving variants for student")
    variants = db.query(StudentHomeworkVariant).filter(StudentHomeworkVariant.student_id == student_id).all()
    logger.info(f"GET /api/student-homework-variants/student/{student_id} - Retrieved {len(variants)} variants")
    return [StudentHomeworkVariantInfo(
        id=variant.id,
        student_id=variant.student_id,
        homework_id=variant.homework_id,
        variant_number=variant.variant_number
    ) for variant in variants]

@router.get("/homework/{homework_id}", response_model=List[StudentHomeworkVariantInfo])
def get_variants_by_homework(homework_id: int, db: Session = Depends(get_db)):
    logger.info(f"GET /api/student-homework-variants/homework/{homework_id} - Retrieving variants for homework")
    variants = db.query(StudentHomeworkVariant).filter(StudentHomeworkVariant.homework_id == homework_id).all()
    logger.info(f"GET /api/student-homework-variants/homework/{homework_id} - Retrieved {len(variants)} variants")
    return [StudentHomeworkVariantInfo(
        id=variant.id,
        student_id=variant.student_id,
        homework_id=variant.homework_id,
        variant_number=variant.variant_number
    ) for variant in variants]

@router.get("/student/{student_id}/homework/{homework_id}", response_model=StudentHomeworkVariantInfo)
def get_variant_by_student_and_homework(student_id: int, homework_id: int, db: Session = Depends(get_db)):
    logger.info(f"GET /api/student-homework-variants/student/{student_id}/homework/{homework_id} - Retrieving specific variant")
    variant = db.query(StudentHomeworkVariant).filter(
        StudentHomeworkVariant.student_id == student_id,
        StudentHomeworkVariant.homework_id == homework_id
    ).first()
    
    if not variant:
        logger.warning(f"GET /api/student-homework-variants/student/{student_id}/homework/{homework_id} - Variant not found")
        raise HTTPException(status_code=404, detail="Variant not found")
    
    logger.info(f"GET /api/student-homework-variants/student/{student_id}/homework/{homework_id} - Found variant: {variant.variant_number}")
    return StudentHomeworkVariantInfo(
        id=variant.id,
        student_id=variant.student_id,
        homework_id=variant.homework_id,
        variant_number=variant.variant_number
    )

@router.post("/", response_model=StudentHomeworkVariantInfo)
@router.post("", response_model=StudentHomeworkVariantInfo)
def add_student_homework_variant(variant: StudentHomeworkVariantCreate, db: Session = Depends(get_db)):
    logger.info(f"POST /api/student-homework-variants - Adding variant for student_id: {variant['student_id']}, homework_id: {variant['homework_id']}")
    
    # Проверяем, существует ли уже вариант для этого студента и домашнего задания
    existing_variant = db.query(StudentHomeworkVariant).filter(
        StudentHomeworkVariant.student_id == variant['student_id'],
        StudentHomeworkVariant.homework_id == variant['homework_id']
    ).first()
    
    if existing_variant:
        logger.warning(f"POST /api/student-homework-variants - Variant already exists for student {variant['student_id']} and homework {variant['homework_id']}")
        raise HTTPException(status_code=400, detail="Variant already exists for this student and homework")
    
    # Проверяем, что студент существует и не удален
    student = db.query(Student).filter(Student.id == variant['student_id'], Student.is_deleted == False).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Проверяем, что домашнее задание существует
    homework = db.query(Homework).filter(Homework.id == variant['homework_id']).first()
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")
    
    # Проверяем, что номер варианта не превышает количество вариантов в задании
    if variant['variant_number'] > homework.variants_count:
        raise HTTPException(status_code=400, detail=f"Variant number cannot exceed {homework.variants_count}")
    
    db_variant = StudentHomeworkVariant(**variant)
    db.add(db_variant)
    db.commit()
    db.refresh(db_variant)
    
    logger.info(f"POST /api/student-homework-variants - Successfully added variant with ID: {db_variant.id}")
    return StudentHomeworkVariantInfo(
        id=db_variant.id,
        student_id=db_variant.student_id,
        homework_id=db_variant.homework_id,
        variant_number=db_variant.variant_number
    )

@router.put("/{variant_id}", response_model=StudentHomeworkVariantInfo)
def update_student_homework_variant(variant_id: int, variant: StudentHomeworkVariantUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/student-homework-variants/{variant_id} - Updating variant")
    db_variant = db.query(StudentHomeworkVariant).filter(StudentHomeworkVariant.id == variant_id).first()
    if not db_variant:
        logger.warning(f"PUT /api/student-homework-variants/{variant_id} - Variant not found")
        raise HTTPException(status_code=404, detail="Variant not found")
    
    # Если обновляется номер варианта, проверяем ограничения
    if 'variant_number' in variant and variant['variant_number'] is not None:
        homework = db.query(Homework).filter(Homework.id == db_variant.homework_id).first()
        if homework and variant['variant_number'] > homework.variants_count:
            raise HTTPException(status_code=400, detail=f"Variant number cannot exceed {homework.variants_count}")
    
    for key, value in variant.items():
        if value is not None:
            setattr(db_variant, key, value)
    
    db.commit()
    db.refresh(db_variant)
    
    logger.info(f"PUT /api/student-homework-variants/{variant_id} - Successfully updated variant")
    return StudentHomeworkVariantInfo(
        id=db_variant.id,
        student_id=db_variant.student_id,
        homework_id=db_variant.homework_id,
        variant_number=db_variant.variant_number
    )

@router.delete("/{variant_id}")
def delete_student_homework_variant(variant_id: int, db: Session = Depends(get_db)):
    logger.info(f"DELETE /api/student-homework-variants/{variant_id} - Deleting variant")
    db_variant = db.query(StudentHomeworkVariant).filter(StudentHomeworkVariant.id == variant_id).first()
    if not db_variant:
        logger.warning(f"DELETE /api/student-homework-variants/{variant_id} - Variant not found")
        raise HTTPException(status_code=404, detail="Variant not found")
    
    db.delete(db_variant)
    db.commit()
    
    logger.info(f"DELETE /api/student-homework-variants/{variant_id} - Successfully deleted variant")
    return {"message": "Variant deleted successfully"}

@router.post("/bulk", response_model=List[StudentHomeworkVariantInfo])
def create_bulk_variants_for_student(student_id: int, db: Session = Depends(get_db)):
    logger.info(f"POST /api/student-homework-variants/bulk - Creating bulk variants for student {student_id}")
    
    # Проверяем, что студент существует и не удален
    student = db.query(Student).filter(Student.id == student_id, Student.is_deleted == False).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Получаем все домашние задания
    all_homework = db.query(Homework).all()
    
    # Получаем существующие варианты для студента
    existing_variants = db.query(StudentHomeworkVariant).filter(
        StudentHomeworkVariant.student_id == student_id
    ).all()
    existing_homework_ids = {v.homework_id for v in existing_variants}
    
    created_variants = []
    
    for hw in all_homework:
        # Если вариант уже существует, пропускаем
        if hw.id in existing_homework_ids:
            continue
        
        # Генерируем случайный номер варианта от 1 до максимального
        import random
        variant_number = random.randint(1, hw.variants_count)
        
        # Создаем новый вариант
        new_variant = StudentHomeworkVariant(
            student_id=student_id,
            homework_id=hw.id,
            variant_number=variant_number
        )
        db.add(new_variant)
        created_variants.append(new_variant)
    
    db.commit()
    
    # Обновляем объекты для получения ID
    for variant in created_variants:
        db.refresh(variant)
    
    logger.info(f"POST /api/student-homework-variants/bulk - Created {len(created_variants)} variants for student {student_id}")
    
    return [StudentHomeworkVariantInfo(
        id=variant.id,
        student_id=variant.student_id,
        homework_id=variant.homework_id,
        variant_number=variant.variant_number
    ) for variant in created_variants]

@router.put("/bulk/{student_id}", response_model=List[StudentHomeworkVariantInfo])
def update_bulk_variants_for_student(student_id: int, variants_data: List[dict], db: Session = Depends(get_db)):
    logger.info(f"PUT /api/student-homework-variants/bulk/{student_id} - Updating bulk variants for student")
    
    # Проверяем, что студент существует и не удален
    student = db.query(Student).filter(Student.id == student_id, Student.is_deleted == False).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    updated_variants = []
    
    for variant_data in variants_data:
        homework_id = variant_data.get('homework_id')
        variant_number = variant_data.get('variant_number')
        
        if not homework_id or not variant_number:
            continue
        
        # Проверяем, что домашнее задание существует
        homework = db.query(Homework).filter(Homework.id == homework_id).first()
        if not homework:
            continue
        
        # Проверяем, что номер варианта не превышает максимальное количество
        if variant_number > homework.variants_count:
            continue
        
        # Ищем существующий вариант или создаем новый
        existing_variant = db.query(StudentHomeworkVariant).filter(
            StudentHomeworkVariant.student_id == student_id,
            StudentHomeworkVariant.homework_id == homework_id
        ).first()
        
        if existing_variant:
            # Обновляем существующий вариант
            existing_variant.variant_number = variant_number
            updated_variants.append(existing_variant)
        else:
            # Создаем новый вариант
            new_variant = StudentHomeworkVariant(
                student_id=student_id,
                homework_id=homework_id,
                variant_number=variant_number
            )
            db.add(new_variant)
            updated_variants.append(new_variant)
    
    db.commit()
    
    # Обновляем объекты для получения ID
    for variant in updated_variants:
        db.refresh(variant)
    
    logger.info(f"PUT /api/student-homework-variants/bulk/{student_id} - Updated {len(updated_variants)} variants")
    
    return [StudentHomeworkVariantInfo(
        id=variant.id,
        student_id=variant.student_id,
        homework_id=variant.homework_id,
        variant_number=variant.variant_number
    ) for variant in updated_variants]
