from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import logging
from models import HomeworkInfo, HomeworkCreate, HomeworkUpdate
from database import get_db, Homework

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/homework", tags=["homework"])

@router.get("/", response_model=List[HomeworkInfo])
@router.get("", response_model=List[HomeworkInfo])
def get_homework(db: Session = Depends(get_db)):
    logger.info("GET /api/homework - Retrieving all homework assignments")
    homeworks = db.query(Homework).all()
    logger.info(f"GET /api/homework - Retrieved {len(homeworks)} homework assignments")
    return [HomeworkInfo(
        id = h.id,
        number=h.number,
        due_date=h.due_date,
        short_description=h.short_description,
        example_link=h.example_link,
        assigned_date=h.assigned_date,
        variants_count=h.variants_count
    ) for h in homeworks]

@router.post("/", response_model=HomeworkInfo)
@router.post("", response_model=HomeworkInfo)
def add_homework(hw: HomeworkCreate, db: Session = Depends(get_db)):
    logger.info(f"POST /api/homework - Adding new homework assignment: {hw['short_description']}")
    db_hw = Homework(**hw)
    db.add(db_hw)
    db.commit()
    db.refresh(db_hw)
    logger.info(f"POST /api/homework - Successfully added homework with ID: {db_hw.id}")
    return HomeworkInfo(
        id = db_hw.id,
        number=db_hw.number,
        due_date=db_hw.due_date,
        short_description=db_hw.short_description,
        example_link=db_hw.example_link,
        assigned_date=db_hw.assigned_date,
        variants_count=db_hw.variants_count
    )

@router.put("/{homework_id}", response_model=HomeworkInfo)
def update_homework(homework_id: int, hw: HomeworkUpdate, db: Session = Depends(get_db)):
    logger.info(f"PUT /api/homework/{homework_id} - Updating homework assignment")
    db_hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not db_hw:
        logger.warning(f"PUT /api/homework/{homework_id} - Homework not found")
        raise HTTPException(status_code=404, detail="Homework not found")
    for key, value in hw.items():
        if value is not None:
            setattr(db_hw, key, value)
    db.commit()
    db.refresh(db_hw)
    logger.info(f"PUT /api/homework/{homework_id} - Successfully updated homework assignment")
    return HomeworkInfo(
        id = db_hw.id,
        number=db_hw.number,
        due_date=db_hw.due_date,
        short_description=db_hw.short_description,
        example_link=db_hw.example_link,
        assigned_date=db_hw.assigned_date,
        variants_count=db_hw.variants_count
    )
