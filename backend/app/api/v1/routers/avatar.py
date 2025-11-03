from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import uuid
from pathlib import Path
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
router = APIRouter(prefix="/api/v1/avatars", tags=["avatars"])

# Avatar configuration
AVATAR_DIR = "static/avatars"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# Ensure avatar directory exists
os.makedirs(AVATAR_DIR, exist_ok=True)


@router.post("/upload")
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a new avatar for the current user
    """
    try:
        # Validate file extension
        file_extension = Path(avatar.filename).suffix.lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Only PNG and JPG files are allowed."
            )

        # Read file content
        content = await avatar.read()
        
        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 2MB."
            )

        # Generate unique filename
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        file_path = os.path.join(AVATAR_DIR, unique_filename)

        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # Verify file was saved
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save avatar file."
            )

        # Delete old avatar if it exists and is not the default
        if current_user.avatar_url:
            old_filename = os.path.basename(current_user.avatar_url)
            old_file_path = os.path.join(AVATAR_DIR, old_filename)
            if os.path.exists(old_file_path) and not old_filename.startswith("default_"):
                try:
                    os.remove(old_file_path)
                except OSError:
                    pass  # Ignore errors when deleting old files

        # Update user's avatar URL in database
        avatar_url = f"/static/avatars/{unique_filename}"
        current_user.avatar_url = avatar_url
        db.commit()

        return {
            "avatar_url": avatar_url,
            "message": "Avatar uploaded successfully",
            "filename": unique_filename
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar"
        )


@router.get("/{filename}")
async def get_avatar(filename: str):
    """
    Serve avatar file directly
    """
    file_path = os.path.join(AVATAR_DIR, filename)
    
    # Security check: prevent directory traversal
    if ".." in filename or not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avatar not found"
        )
    
    return FileResponse(file_path)


@router.delete("/delete")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete current user's avatar and set to default
    """
    try:
        if not current_user.avatar_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No avatar to delete"
            )

        # Extract filename from avatar_url
        filename = os.path.basename(current_user.avatar_url)
        file_path = os.path.join(AVATAR_DIR, filename)

        # Delete the file if it exists and is not a default avatar
        if os.path.exists(file_path) and not filename.startswith("default_"):
            os.remove(file_path)

        # Set avatar_url to null or default in database
        current_user.avatar_url = None
        db.commit()

        return {"message": "Avatar deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete avatar"
        )


@router.get("/info/files")
async def list_avatar_files():
    """
    List all avatar files in the directory (for debugging)
    """
    try:
        files = []
        for filename in os.listdir(AVATAR_DIR):
            file_path = os.path.join(AVATAR_DIR, filename)
            if os.path.isfile(file_path):
                file_size = os.path.getsize(file_path)
                files.append({
                    "filename": filename,
                    "size": file_size,
                    "url": f"/static/avatars/{filename}"
                })
        
        return {
            "total_files": len(files),
            "files": files
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list avatar files"
        )