import os
import base64
import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from pathlib import Path
import mimetypes

from app.core.cloudinary import delete_from_cloudinary, extract_public_id_from_url, upload_to_cloudinary

class ImageServiceSync:
    def __init__(self):
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        self.max_size = 5 * 1024 * 1024  # 5MB
    
    def validate_image_data(self, data_url: str) -> tuple:
        """Validate and parse base64 image data URL"""
        try:
            if not data_url.startswith('data:image/'):
                raise ValueError("Invalid image format")
            
            header, encoded = data_url.split(',', 1)
            mime_type = header.split(';')[0].split(':')[1]
            
            extension = mimetypes.guess_extension(mime_type)
            if not extension or extension not in self.allowed_extensions:
                raise ValueError(f"Unsupported image type: {mime_type}")
            
            image_data = base64.b64decode(encoded)
            
            if len(image_data) > self.max_size:
                raise ValueError(f"Image too large. Max size is {self.max_size // 1024 // 1024}MB")
            
            return image_data, extension, mime_type
        except Exception as e:
            raise ValueError(f"Invalid image data: {str(e)}")
    
    def save_base64_image(self, base64_data: str, is_diary: bool = True) -> str:
        """Save base64 image to Cloudinary and return URL"""
        try:
            image_data, extension, mime_type = self.validate_image_data(base64_data)
            
            filename = f"{uuid.uuid4().hex}{extension}"
            folder = "diaries" if is_diary else "comments"
            
            upload_result = upload_to_cloudinary(
                file_content=image_data,
                public_id=filename,
                folder=folder,
                resource_type="image"
            )
            
            return upload_result["secure_url"]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to save image: {str(e)}"
            )
    
    def save_multiple_images(self, images_data: List[str], is_diary: bool = True) -> List[str]:
        """Save multiple base64 images to Cloudinary"""
        saved_urls = []
        for img_data in images_data:
            if img_data:
                url = self.save_base64_image(img_data, is_diary)
                saved_urls.append(url)
        return saved_urls
    
    def delete_image(self, image_url: str):
        """Delete image from Cloudinary"""
        try:
            if image_url.startswith(('http://', 'https://')):
                public_id = extract_public_id_from_url(image_url)
                if public_id:
                    return delete_from_cloudinary(public_id, resource_type="image")
        except Exception:
            pass
        return False
    
    def cleanup_images(self, image_urls: List[str]):
        """Clean up multiple images from Cloudinary"""
        for url in image_urls:
            self.delete_image(url)

image_service_sync = ImageServiceSync()