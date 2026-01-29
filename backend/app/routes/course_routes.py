"""
Course Routes
Canvas-style course management with modules and lessons.
"""

from typing import Optional, List
from uuid import UUID
import uuid as uuid_module
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel

from ..database import get_db
from ..db_models import Course, CourseModule, ModuleItem, CourseEnrollment, StudentProgress, User
from ..auth_clerk import get_current_user_clerk, get_current_user_clerk_optional

# Alias for compatibility
get_current_user = get_current_user_clerk
get_optional_user = get_current_user_clerk_optional

router = APIRouter()


# ============= Schemas =============

class ModuleItemCreate(BaseModel):
    title: str
    item_type: str  # lesson, quiz, assignment, video, page
    content: Optional[str] = None
    video_url: Optional[str] = None
    session_id: Optional[str] = None  # Legacy: link to sessions table
    quiz_id: Optional[str] = None  # New: link to quizzes table
    duration_mins: Optional[int] = None
    points: int = 0


class ModuleCreate(BaseModel):
    title: str
    description: Optional[str] = None


class CourseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    difficulty_level: Optional[str] = None
    estimated_hours: Optional[int] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    difficulty_level: Optional[str] = None
    estimated_hours: Optional[int] = None
    is_published: Optional[bool] = None
    is_public: Optional[bool] = None


class ModuleItemResponse(BaseModel):
    id: str
    title: str
    item_type: str
    order_index: int
    content: Optional[str] = None
    video_url: Optional[str] = None
    session_id: Optional[str] = None
    quiz_id: Optional[str] = None
    duration_mins: Optional[int] = None
    points: int
    is_published: bool


class ModuleResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    order_index: int
    is_published: bool
    items: List[ModuleItemResponse] = []


class CourseResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    teacher_name: str
    teacher_id: str
    enrollment_code: Optional[str] = None
    is_published: bool
    is_public: bool
    tags: List[str] = []
    difficulty_level: Optional[str] = None
    estimated_hours: Optional[int] = None
    enrollment_count: int
    fork_count: int
    modules: List[ModuleResponse] = []
    created_at: str


class CourseListItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    teacher_name: str
    enrollment_code: Optional[str] = None
    module_count: int
    item_count: int
    enrollment_count: int
    is_published: bool
    is_public: bool
    tags: List[str] = []
    difficulty_level: Optional[str] = None
    created_at: str


# ============= Helper Functions =============

def generate_enrollment_code() -> str:
    """Generate a 6-character enrollment code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ============= Routes =============

@router.get("", response_model=dict)
async def list_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List courses created by the current teacher."""
    result = await db.execute(
        select(Course).where(Course.teacher_id == current_user.id).order_by(desc(Course.updated_at))
    )
    courses = result.scalars().all()
    
    items = []
    for course in courses:
        # Count modules and items
        modules_result = await db.execute(
            select(func.count()).where(CourseModule.course_id == course.id)
        )
        module_count = modules_result.scalar() or 0
        
        # Count total items across all modules
        items_result = await db.execute(
            select(func.count()).select_from(ModuleItem).join(CourseModule).where(CourseModule.course_id == course.id)
        )
        item_count = items_result.scalar() or 0
        
        items.append(CourseListItem(
            id=str(course.id),
            name=course.name,
            description=course.description,
            teacher_name=current_user.name,
            enrollment_code=course.enrollment_code,
            module_count=module_count,
            item_count=item_count,
            enrollment_count=course.enrollment_count,
            is_published=course.is_published,
            is_public=course.is_public,
            tags=course.tags or [],
            difficulty_level=course.difficulty_level,
            created_at=course.created_at.isoformat()
        ))
    
    return {"courses": items}


@router.post("", response_model=CourseResponse)
async def create_course(
    request: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new course."""
    course = Course(
        teacher_id=current_user.id,
        name=request.name,
        description=request.description,
        tags=request.tags,
        difficulty_level=request.difficulty_level,
        estimated_hours=request.estimated_hours,
        enrollment_code=generate_enrollment_code()
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    
    return CourseResponse(
        id=str(course.id),
        name=course.name,
        description=course.description,
        teacher_name=current_user.name,
        teacher_id=str(current_user.id),
        enrollment_code=course.enrollment_code,
        is_published=course.is_published,
        is_public=course.is_public,
        tags=course.tags or [],
        difficulty_level=course.difficulty_level,
        estimated_hours=course.estimated_hours,
        enrollment_count=0,
        fork_count=0,
        modules=[],
        created_at=course.created_at.isoformat()
    )


@router.get("/public", response_model=dict)
async def list_public_courses(
    db: AsyncSession = Depends(get_db),
    subject: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List all public courses for browsing (no auth required)."""
    query = select(Course).where(Course.is_public is True, Course.is_published is True)
    
    if subject:
        query = query.where(Course.difficulty_level == subject)  # or add subject field
    if difficulty:
        query = query.where(Course.difficulty_level == difficulty)
    if search:
        query = query.where(Course.name.ilike(f"%{search}%"))
    
    query = query.order_by(desc(Course.enrollment_count)).limit(limit).offset(offset)
    
    result = await db.execute(query)
    courses = result.scalars().all()
    
    items = []
    for course in courses:
        # Get teacher name
        teacher_name = "Instructor"
        if course.teacher_id:
            teacher_result = await db.execute(select(User).where(User.id == course.teacher_id))
            teacher = teacher_result.scalar_one_or_none()
            if teacher:
                teacher_name = teacher.name
        
        # Count modules
        modules_result = await db.execute(
            select(func.count()).where(CourseModule.course_id == course.id)
        )
        module_count = modules_result.scalar() or 0
        
        # Count items (lessons)
        items_result = await db.execute(
            select(func.count()).select_from(ModuleItem).join(CourseModule).where(CourseModule.course_id == course.id)
        )
        item_count = items_result.scalar() or 0
        
        items.append({
            "id": str(course.id),
            "name": course.name,
            "description": course.description,
            "subject": course.difficulty_level or "general",  # TODO: add proper subject field
            "difficulty_level": course.difficulty_level or "intermediate",
            "modules_count": module_count,
            "lessons_count": item_count,
            "enrolled_count": course.enrollment_count,
            "rating": 4.5,  # TODO: add ratings table
            "creator_name": teacher_name,
            "thumbnail_url": course.cover_image_url,
            "tags": course.tags or [],
            "estimated_hours": course.estimated_hours or 10,
        })
    
    return {"courses": items, "total": len(items)}


# ============= Enrollment Routes (must be before /{course_id} routes) =============

@router.get("/enrolled", response_model=dict)
async def list_enrolled_courses(
    db: AsyncSession = Depends(get_db),
    student_name: Optional[str] = None,
):
    """List courses a student is enrolled in."""
    if not student_name:
        return {"courses": []}

    # Get enrollments for this student
    result = await db.execute(
        select(CourseEnrollment, Course).join(Course).where(
            CourseEnrollment.student_name == student_name
        )
    )
    enrollments = result.all()

    items = []
    for enrollment, course in enrollments:
        # Get teacher name
        teacher_name = "Instructor"
        if course.teacher_id:
            teacher_result = await db.execute(select(User).where(User.id == course.teacher_id))
            teacher = teacher_result.scalar_one_or_none()
            if teacher:
                teacher_name = teacher.name

        # Count progress - get completed items for this student in this course
        progress_result = await db.execute(
            select(func.count()).select_from(StudentProgress).join(ModuleItem).join(CourseModule).where(
                StudentProgress.student_name == student_name,
                CourseModule.course_id == course.id,
                StudentProgress.status == "completed"
            )
        )
        completed_count = progress_result.scalar() or 0

        # Count total items
        items_result = await db.execute(
            select(func.count()).select_from(ModuleItem).join(CourseModule).where(
                CourseModule.course_id == course.id
            )
        )
        total_items = items_result.scalar() or 1

        items.append({
            "id": str(course.id),
            "name": course.name,
            "description": course.description,
            "teacher_name": teacher_name,
            "progress": int((completed_count / total_items) * 100) if total_items > 0 else 0,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
        })

    return {"courses": items}


@router.post("/enroll/{code}")
async def enroll_in_course(
    code: str,
    student_name: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Enroll in a course using enrollment code."""
    result = await db.execute(
        select(Course).where(Course.enrollment_code == code.upper())
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Invalid enrollment code")
    if not course.is_published:
        raise HTTPException(status_code=400, detail="Course is not open for enrollment")

    # Check if already enrolled
    existing = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == course.id,
            CourseEnrollment.student_name == student_name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already enrolled in this class")

    # Create enrollment
    enrollment = CourseEnrollment(
        course_id=course.id,
        student_id=current_user.id if current_user else None,
        student_name=student_name
    )
    db.add(enrollment)
    course.enrollment_count += 1

    await db.commit()

    return {
        "success": True,
        "course_id": str(course.id),
        "course_name": course.name,
        "message": f"Enrolled in {course.name}!"
    }


@router.delete("/unenroll/{course_id}")
async def unenroll_from_course(
    course_id: UUID,
    student_name: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Unenroll from a course (removes all duplicate enrollments)."""
    # Find all enrollments (handle duplicates)
    result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.student_name == student_name
        )
    )
    enrollments = result.scalars().all()

    if not enrollments:
        raise HTTPException(status_code=404, detail="Not enrolled in this class")

    # Get course to update count
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    # Delete all enrollments and update count
    for enrollment in enrollments:
        if course and course.enrollment_count > 0:
            course.enrollment_count -= 1
        await db.delete(enrollment)

    await db.commit()

    return {"success": True, "message": "Left the class"}


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    student_name: Optional[str] = Query(None)
):
    """Get course details with modules and items."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check access - allow if: public, owner, or enrolled student
    is_owner = current_user and course.teacher_id == current_user.id
    is_enrolled = False

    # Check enrollment by student_name or current_user
    if student_name or current_user:
        enrollment_query = select(CourseEnrollment).where(CourseEnrollment.course_id == course_id)
        if student_name:
            enrollment_query = enrollment_query.where(CourseEnrollment.student_name == student_name)
        elif current_user:
            enrollment_query = enrollment_query.where(CourseEnrollment.student_id == current_user.id)
        enrollment_result = await db.execute(enrollment_query)
        is_enrolled = enrollment_result.scalar_one_or_none() is not None

    if not course.is_public and not is_owner and not is_enrolled:
        raise HTTPException(status_code=403, detail="Course is not public")
    
    # Get teacher name
    teacher_name = "Unknown"
    if course.teacher_id:
        teacher_result = await db.execute(select(User).where(User.id == course.teacher_id))
        teacher = teacher_result.scalar_one_or_none()
        if teacher:
            teacher_name = teacher.name
    
    # Get modules with items
    modules_result = await db.execute(
        select(CourseModule).where(CourseModule.course_id == course_id).order_by(CourseModule.order_index)
    )
    modules = modules_result.scalars().all()
    
    module_responses = []
    for module in modules:
        items_result = await db.execute(
            select(ModuleItem).where(ModuleItem.module_id == module.id).order_by(ModuleItem.order_index)
        )
        items = items_result.scalars().all()
        
        module_responses.append(ModuleResponse(
            id=str(module.id),
            title=module.title,
            description=module.description,
            order_index=module.order_index,
            is_published=module.is_published,
            items=[
                ModuleItemResponse(
                    id=str(item.id),
                    title=item.title,
                    item_type=item.item_type,
                    order_index=item.order_index,
                    content=item.content if is_owner else None,  # Only show content to owner
                    video_url=item.video_url,
                    session_id=str(item.session_id) if item.session_id else None,
                    quiz_id=str(item.quiz_id) if item.quiz_id else None,
                    duration_mins=item.duration_mins,
                    points=item.points,
                    is_published=item.is_published
                )
                for item in items
            ]
        ))
    
    return CourseResponse(
        id=str(course.id),
        name=course.name,
        description=course.description,
        teacher_name=teacher_name,
        teacher_id=str(course.teacher_id) if course.teacher_id else "",
        enrollment_code=course.enrollment_code if is_owner else None,
        is_published=course.is_published,
        is_public=course.is_public,
        tags=course.tags or [],
        difficulty_level=course.difficulty_level,
        estimated_hours=course.estimated_hours,
        enrollment_count=course.enrollment_count,
        fork_count=course.fork_count,
        modules=module_responses,
        created_at=course.created_at.isoformat()
    )


@router.patch("/{course_id}", response_model=dict)
async def update_course(
    course_id: UUID,
    request: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update course details."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if request.name is not None:
        course.name = request.name
    if request.description is not None:
        course.description = request.description
    if request.tags is not None:
        course.tags = request.tags
    if request.difficulty_level is not None:
        course.difficulty_level = request.difficulty_level
    if request.estimated_hours is not None:
        course.estimated_hours = request.estimated_hours
    if request.is_published is not None:
        course.is_published = request.is_published
    if request.is_public is not None:
        course.is_public = request.is_public
    
    await db.commit()
    
    return {"success": True, "message": "Course updated"}


@router.delete("/{course_id}")
async def delete_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(course)
    await db.commit()
    
    return {"success": True, "message": "Course deleted"}


# ============= Students/Enrollment Routes =============

@router.get("/{course_id}/students")
async def get_course_students(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all enrolled students for a course (teacher only)."""
    # Verify course ownership
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get all enrollments for this course
    enrollments_result = await db.execute(
        select(CourseEnrollment).where(CourseEnrollment.course_id == course_id).order_by(CourseEnrollment.enrolled_at.desc())
    )
    enrollments = enrollments_result.scalars().all()

    students = []
    for enrollment in enrollments:
        students.append({
            "id": str(enrollment.id),
            "student_name": enrollment.student_name,
            "student_id": str(enrollment.student_id) if enrollment.student_id else None,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "role": enrollment.role,
        })

    return {"students": students}


@router.delete("/{course_id}/students/{enrollment_id}")
async def remove_student_from_course(
    course_id: UUID,
    enrollment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a student from a course (teacher only)."""
    # Verify course ownership
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Find and delete the enrollment
    enrollment_result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.id == enrollment_id,
            CourseEnrollment.course_id == course_id
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Student not found in this course")

    await db.delete(enrollment)
    if course.enrollment_count > 0:
        course.enrollment_count -= 1
    await db.commit()

    return {"success": True, "message": "Student removed from course"}


# ============= Module Routes =============

@router.post("/{course_id}/modules", response_model=ModuleResponse)
async def create_module(
    course_id: UUID,
    request: ModuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a module to a course."""
    # Verify course ownership
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get next order index
    count_result = await db.execute(
        select(func.count()).where(CourseModule.course_id == course_id)
    )
    order_index = count_result.scalar() or 0
    
    module = CourseModule(
        course_id=course_id,
        title=request.title,
        description=request.description,
        order_index=order_index
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    
    return ModuleResponse(
        id=str(module.id),
        title=module.title,
        description=module.description,
        order_index=module.order_index,
        is_published=module.is_published,
        items=[]
    )


@router.delete("/{course_id}/modules/{module_id}")
async def delete_module(
    course_id: UUID,
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a module."""
    result = await db.execute(
        select(CourseModule).join(Course).where(
            CourseModule.id == module_id,
            Course.teacher_id == current_user.id
        )
    )
    module = result.scalar_one_or_none()
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found or not authorized")
    
    await db.delete(module)
    await db.commit()
    
    return {"success": True}


# ============= Module Item Routes =============

@router.post("/{course_id}/modules/{module_id}/items", response_model=ModuleItemResponse)
async def create_module_item(
    course_id: UUID,
    module_id: UUID,
    request: ModuleItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add an item to a module."""
    # Verify ownership
    result = await db.execute(
        select(CourseModule).join(Course).where(
            CourseModule.id == module_id,
            Course.teacher_id == current_user.id
        )
    )
    module = result.scalar_one_or_none()
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found or not authorized")
    
    # Get next order index
    count_result = await db.execute(
        select(func.count()).where(ModuleItem.module_id == module_id)
    )
    order_index = count_result.scalar() or 0
    
    item = ModuleItem(
        module_id=module_id,
        title=request.title,
        item_type=request.item_type,
        order_index=order_index,
        content=request.content,
        video_url=request.video_url,
        session_id=uuid_module.UUID(request.session_id) if request.session_id else None,
        quiz_id=uuid_module.UUID(request.quiz_id) if request.quiz_id else None,
        duration_mins=request.duration_mins,
        points=request.points
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    return ModuleItemResponse(
        id=str(item.id),
        title=item.title,
        item_type=item.item_type,
        order_index=item.order_index,
        content=item.content,
        video_url=item.video_url,
        session_id=str(item.session_id) if item.session_id else None,
        quiz_id=str(item.quiz_id) if item.quiz_id else None,
        duration_mins=item.duration_mins,
        points=item.points,
        is_published=item.is_published
    )


@router.delete("/{course_id}/modules/{module_id}/items/{item_id}")
async def delete_module_item(
    course_id: UUID,
    module_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a module item."""
    result = await db.execute(
        select(ModuleItem).join(CourseModule).join(Course).where(
            ModuleItem.id == item_id,
            Course.teacher_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found or not authorized")
    
    await db.delete(item)
    await db.commit()
    
    return {"success": True}


@router.get("/{course_id}/items/{item_id}")
async def get_item(
    course_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a single module item by ID."""
    result = await db.execute(
        select(ModuleItem).join(CourseModule).where(
            ModuleItem.id == item_id,
            CourseModule.course_id == course_id
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {
        "id": str(item.id),
        "title": item.title,
        "item_type": item.item_type,
        "content": item.content,
        "video_url": item.video_url,
        "session_id": str(item.session_id) if item.session_id else None,
        "duration_mins": item.duration_mins,
        "points": item.points,
    }


@router.post("/{course_id}/items/{item_id}/complete")
async def complete_item(
    course_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    student_name: Optional[str] = None
):
    """Mark an item as completed for a student."""
    # Find the enrollment
    result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.student_name == student_name
        )
    )
    enrollment = result.scalar_one_or_none()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this course")
    
    # Check if already completed
    existing = await db.execute(
        select(StudentProgress).where(
            StudentProgress.student_id == enrollment.student_id,
            StudentProgress.item_id == item_id
        )
    )
    existing_progress = existing.scalar_one_or_none()
    if existing_progress and existing_progress.status == "completed":
        return {"success": True, "message": "Already completed"}

    if existing_progress:
        # Update existing progress to completed
        existing_progress.status = "completed"
        existing_progress.completed_at = datetime.now(timezone.utc)
    else:
        # Create progress record
        progress = StudentProgress(
            student_id=enrollment.student_id,
            student_name=enrollment.student_name,
            item_id=item_id,
            status="completed",
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress)
    await db.commit()

    return {"success": True}


# ============= Fork Course =============

@router.post("/{course_id}/fork")
async def fork_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fork a public course to your collection."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    original = result.scalar_one_or_none()
    
    if not original:
        raise HTTPException(status_code=404, detail="Course not found")
    if not original.is_public:
        raise HTTPException(status_code=403, detail="Course is not public")
    
    # Create the fork
    forked = Course(
        teacher_id=current_user.id,
        name=original.name,
        description=original.description,
        tags=original.tags,
        difficulty_level=original.difficulty_level,
        estimated_hours=original.estimated_hours,
        forked_from_id=original.id,
        enrollment_code=generate_enrollment_code()
    )
    db.add(forked)
    await db.flush()
    
    # Copy modules and items
    modules_result = await db.execute(
        select(CourseModule).where(CourseModule.course_id == course_id).order_by(CourseModule.order_index)
    )
    modules = modules_result.scalars().all()
    
    for module in modules:
        new_module = CourseModule(
            course_id=forked.id,
            title=module.title,
            description=module.description,
            order_index=module.order_index
        )
        db.add(new_module)
        await db.flush()
        
        # Copy items
        items_result = await db.execute(
            select(ModuleItem).where(ModuleItem.module_id == module.id).order_by(ModuleItem.order_index)
        )
        items = items_result.scalars().all()
        
        for item in items:
            new_item = ModuleItem(
                module_id=new_module.id,
                title=item.title,
                item_type=item.item_type,
                order_index=item.order_index,
                content=item.content,
                video_url=item.video_url,
                duration_mins=item.duration_mins,
                points=item.points
            )
            db.add(new_item)
    
    original.fork_count += 1
    await db.commit()
    
    return {
        "success": True,
        "course_id": str(forked.id),
        "message": f"Forked '{original.name}' to your courses!"
    }
