# services/image_service_sync.py
import os
import base64
import uuid
import traceback
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
import mimetypes
import tempfile
from PIL import Image
import imageio
import numpy as np

from app.core.cloudinary import (
    delete_from_cloudinary, 
    extract_public_id_from_url,
    generate_video_thumbnail, 
    upload_to_cloudinary,
    upload_video_to_cloudinary,
)

class ImageServiceSync:
    def __init__(self):
        self.allowed_image_types = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
        self.allowed_video_types = {'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg'}
        self.max_image_size = 10 * 1024 * 1024  # 10MB
        self.max_video_size = 50 * 1024 * 1024  # 50MB
    
    def validate_and_decode_media(self, data_url: str) -> Tuple[bytes, str, str]:
        """Validate and decode base64 media data URL"""
        try:
            if not data_url or ',' not in data_url:
                raise ValueError("Invalid data URL format")
            
            header, encoded = data_url.split(',', 1)
            mime_info = header.split(';')[0]
            
            if ':' not in mime_info:
                raise ValueError("Invalid MIME type format")
            
            mime_type = mime_info.split(':')[1]
            
            # Validate MIME type
            if mime_type.startswith('image/'):
                if mime_type not in self.allowed_image_types:
                    raise ValueError(f"Unsupported image type: {mime_type}")
            elif mime_type.startswith('video/'):
                if mime_type not in self.allowed_video_types:
                    raise ValueError(f"Unsupported video type: {mime_type}")
            else:
                raise ValueError(f"Unsupported media type: {mime_type}")
            
            # Decode base64
            media_data = base64.b64decode(encoded)
            
            # Validate size
            if mime_type.startswith('image/'):
                if len(media_data) > self.max_image_size:
                    raise ValueError(f"Image too large. Max {self.max_image_size // 1024 // 1024}MB")
            elif mime_type.startswith('video/'):
                if len(media_data) > self.max_video_size:
                    raise ValueError(f"Video too large. Max {self.max_video_size // 1024 // 1024}MB")
            
            media_type = 'video' if mime_type.startswith('video/') else 'image'
            return media_data, mime_type, media_type
            
        except Exception as e:
            raise ValueError(f"Invalid media data: {str(e)}")
    
    def upload_image(self, image_data: bytes, folder: str = "images") -> str:
        """Upload image to Cloudinary"""
        try:
            filename = f"image_{uuid.uuid4().hex[:12]}"
            
            upload_result = upload_to_cloudinary(
                file_content=image_data,
                public_id=filename,
                folder=folder,
                resource_type="image",
                transformation=[
                    {"width": 1200, "height": 1200, "crop": "limit"},
                    {"quality": "auto"},
                    {"format": "auto"}
                ]
            )
            
            return upload_result["secure_url"]
            
        except Exception as e:
            raise Exception(f"Image upload failed: {str(e)}")
    
    def upload_video(self, video_data: bytes, folder: str = "videos") -> Tuple[str, Optional[str]]:
        """Upload video to Cloudinary with thumbnail"""
        try:
            upload_result = upload_video_to_cloudinary(video_data, folder)
            return upload_result["secure_url"], upload_result.get("thumbnail_url")
            
        except Exception as e:
            raise Exception(f"Video upload failed: {str(e)}")
    
    def save_single_media(self, media_data, is_diary=True):
        """Save single media (image or video) and return URL and thumbnail"""
        try:
            print(f"📤 save_single_media called with data starting: {media_data[:100] if media_data else 'None'}")
            
            # Check if it's a video
            if media_data.startswith('data:video/'):
                print("🎬 Detected video data")
                
                # Extract the base64 data
                if ',' not in media_data:
                    raise ValueError("Invalid data URL format")
                    
                header, data = media_data.split(',', 1)
                
                # Determine file format
                if 'mp4' in header:
                    format = 'mp4'
                elif 'webm' in header:
                    format = 'webm'
                else:
                    format = 'mp4'
                
                print(f"  Format: {format}")
                print(f"  Data length: {len(data)}")
                
                # Upload video to Cloudinary
                folder = "diary_videos" if is_diary else "comment_videos"
                print(f"  Uploading to folder: {folder}")
                
                # Decode base64
                video_bytes = base64.b64decode(data)
                print(f"  Decoded bytes: {len(video_bytes)}")
                
                upload_result = upload_video_to_cloudinary(
                    video_bytes,
                    folder=folder
                )
                
                video_url = upload_result.get('secure_url')
                thumbnail_url = upload_result.get('thumbnail_url')
                
                print(f"  Upload result:")
                print(f"    Video URL: {video_url}")
                print(f"    Thumbnail URL: {thumbnail_url}")
                
                # If thumbnail is missing, generate it
                if video_url and not thumbnail_url:
                    print("  Generating thumbnail...")
                    try:
                        thumbnail_url = generate_video_thumbnail(video_url)
                        print(f"    Generated thumbnail: {thumbnail_url}")
                    except Exception as thumb_error:
                        print(f"    Thumbnail generation failed: {str(thumb_error)}")
                        thumbnail_url = None
                
                return video_url, thumbnail_url
                
            else:
                print("🖼️ Detected image data")
                # It's an image
                folder = "diary_images" if is_diary else "comment_images"
                print(f"  Uploading to folder: {folder}")
                
                upload_result = upload_to_cloudinary(
                    media_data,
                    folder=folder,
                    resource_type="image"
                )
                
                image_url = upload_result.get('secure_url')
                print(f"  Image URL: {image_url}")
                
                return image_url, None
                
        except Exception as e:
            print(f"❌ save_single_media error: {str(e)}")
            traceback.print_exc()
            raise
    
    def save_multiple_images(self, images_data: List[str], is_diary: bool = True) -> List[str]:
        """Save multiple images"""
        saved_urls = []
        for i, img_data in enumerate(images_data):
            if img_data:
                try:
                    url, _ = self.save_single_media(img_data, is_diary)
                    saved_urls.append(url)
                except Exception:
                    continue
        return saved_urls
    
    def save_multiple_videos(self, video_data_list, is_diary=True):
        """Upload multiple videos and generate thumbnails"""
        video_urls = []
        video_thumbnails = []
        
        print(f"🎬 Processing {len(video_data_list)} videos...")
        
        for idx, video_data in enumerate(video_data_list):
            try:
                print(f"  Processing video {idx+1}/{len(video_data_list)}")
                
                # Upload video and get thumbnail
                video_url, thumbnail_url = self.save_single_media(video_data, is_diary=is_diary)
                
                if video_url:
                    video_urls.append(video_url)
                    video_thumbnails.append(thumbnail_url)
                    print(f"  ✅ Video {idx+1} uploaded successfully")
                    print(f"     URL: {video_url[:50]}...")
                    print(f"     Thumbnail: {thumbnail_url[:50] if thumbnail_url else 'None'}...")
                else:
                    print(f"  ⚠️ Video {idx+1} upload returned no URL")
                    
            except Exception as e:
                print(f"  ❌ Video {idx+1} upload error: {str(e)}")
                # Continue with other videos
                continue
        
        print(f"✅ Video processing complete:")
        print(f"  Videos uploaded: {len(video_urls)}")
        print(f"  Thumbnails generated: {len(video_thumbnails)}")
        
        return video_urls, video_thumbnails
    
    def delete_media(self, media_url: str) -> bool:
        """Delete media from Cloudinary"""
        try:
            if not media_url or not media_url.startswith(('http://', 'https://')):
                return False
            
            public_id = extract_public_id_from_url(media_url)
            if not public_id:
                return False
            
            # Determine resource type
            if 'video' in media_url.lower() or any(ext in media_url for ext in ['.mp4', '.mov', '.avi']):
                resource_type = "video"
            else:
                resource_type = "image"
            
            return delete_from_cloudinary(public_id, resource_type=resource_type)
            
        except Exception as e:
            print(f"Failed to delete media: {e}")
            return False
    
    def cleanup_media(self, media_urls: List[str]):
        """Clean up multiple media files"""
        if not media_urls:
            return
            
        for url in media_urls:
            if url:
                try:
                    public_id = extract_public_id_from_url(url)
                    if public_id:
                        if 'video' in url.lower():
                            delete_from_cloudinary(public_id, resource_type="video")
                        else:
                            delete_from_cloudinary(public_id, resource_type="image")
                except Exception:
                    pass

# Global instance
image_service_sync = ImageServiceSync()