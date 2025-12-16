import os
import base64
import uuid
from datetime import datetime
from typing import List, Optional
import aiofiles
from fastapi import UploadFile, HTTPException, status
from pathlib import Path
import mimetypes

class ImageService:
    def __init__(self):
        self.base_dir = Path("uploads")
        self.diary_images_dir = self.base_dir / "diaries"
        self.comment_images_dir = self.base_dir / "comments"
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        self.max_size = 5 * 1024 * 1024  # 5MB
        
        # Create directories if they don't exist
        self.diary_images_dir.mkdir(parents=True, exist_ok=True)
        self.comment_images_dir.mkdir(parents=True, exist_ok=True)
    
    def validate_image_data(self, data_url: str) -> tuple:
        """Validate and parse base64 image data URL"""
        try:
            # Check if it's a data URL
            if not data_url.startswith('data:image/'):
                raise ValueError("Invalid image format")
            
            # Parse data URL
            header, encoded = data_url.split(',', 1)
            mime_type = header.split(';')[0].split(':')[1]
            
            # Get extension from mime type
            extension = mimetypes.guess_extension(mime_type)
            if not extension or extension not in self.allowed_extensions:
                raise ValueError(f"Unsupported image type: {mime_type}")
            
            # Decode base64
            image_data = base64.b64decode(encoded)
            
            # Check size
            if len(image_data) > self.max_size:
                raise ValueError(f"Image too large. Max size is {self.max_size // 1024 // 1024}MB")
            
            return image_data, extension
        except Exception as e:
            raise ValueError(f"Invalid image data: {str(e)}")
    
    async def save_base64_image(self, base64_data: str, is_diary: bool = True) -> str:
        """Save base64 image to disk and return file path"""
        try:
            image_data, extension = self.validate_image_data(base64_data)
            
            # Generate unique filename
            filename = f"{uuid.uuid4().hex}{extension}"
            
            # Determine directory
            save_dir = self.diary_images_dir if is_diary else self.comment_images_dir
            
            # Save file
            file_path = save_dir / filename
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_data)
            
            # Return relative path for storage in database
            return str(file_path.relative_to(self.base_dir))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to save image: {str(e)}"
            )
    
    async def save_multiple_images(self, images_data: List[str], is_diary: bool = True) -> List[str]:
        """Save multiple base64 images"""
        saved_paths = []
        for img_data in images_data:
            if img_data:  # Skip empty strings
                path = await self.save_base64_image(img_data, is_diary)
                saved_paths.append(path)
        return saved_paths
    
    def get_image_url(self, image_path: str) -> str:
        """Convert stored path to URL"""
        if not image_path:
            return ""
        return f"/uploads/{image_path}"
    
    async def delete_image(self, image_path: str):
        """Delete image file from disk"""
        try:
            file_path = self.base_dir / image_path
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass  # Silent fail for cleanup
    
    async def cleanup_images(self, image_paths: List[str]):
        """Clean up multiple images"""
        for path in image_paths:
            await self.delete_image(path)

# Singleton instance
image_service = ImageService()