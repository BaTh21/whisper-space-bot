# cloudinary_config.py
import traceback
import cloudinary
# import cloudinary.uploader
# import cloudinary.api
from cloudinary import uploader, api
from cloudinary.utils import cloudinary_url
from app.core.config import settings
import uuid

def configure_cloudinary():
    """Configure Cloudinary with all necessary settings"""
    try:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )
        print("✅ Cloudinary configured successfully")
    except Exception as e:
        print(f"❌ Cloudinary configuration failed: {str(e)}")
        raise

configure_cloudinary()

def upload_to_cloudinary(file_content, public_id=None, folder=None, resource_type="image"):
    """
    Upload file to Cloudinary with support for different resource types
    """
    try:
        upload_kwargs = {
            "file": file_content,
            "public_id": public_id,
            "folder": folder or settings.CLOUDINARY_UPLOAD_FOLDER,
            "overwrite": True,
            "resource_type": resource_type,
        }
        
        # Only apply image transformations for images
        if resource_type == "image":
            upload_kwargs["transformation"] = [
                {"width": 400, "height": 400, "crop": "fill"},
                {"quality": "auto"},
                {"format": "auto"}
            ]
        
        upload_result = cloudinary.uploader.upload(**upload_kwargs)
        return upload_result
    except Exception as e:
        raise Exception(f"Cloudinary upload failed: {str(e)}")
    
def upload_voice_message(file_content: bytes, public_id: str = None, folder: str = "voice_messages"):
    try:
        import os
        from cloudinary.utils import cloudinary_url

        full_folder = f"{os.getenv('CLOUDINARY_UPLOAD_FOLDER', 'whisper_space')}/{folder}"
        if not public_id:
            public_id = f"voice_{uuid.uuid4().hex[:12]}"

        upload_result = uploader.upload(
            file_content,
            resource_type="video",
            folder=full_folder,
            public_id=public_id,
            overwrite=True,
            timeout=60
        )

        # Generate auto-format, auto-quality URL
        auto_url, _ = cloudinary_url(
            upload_result["public_id"],
            resource_type="video",
            format="auto",
            quality="auto",
            secure=True
        )

        print(f"VOICE UPLOAD SUCCESS → {auto_url}")
        return {
            "secure_url": auto_url,
            "public_id": upload_result["public_id"],
            "duration": upload_result.get("duration"),
            "bytes": upload_result.get("bytes"),
        }

    except Exception as e:
        print(f"Voice upload failed: {str(e)}")
        traceback.print_exc()
        raise Exception(f"Cloudinary upload failed: {str(e)}")
def delete_from_cloudinary(public_id, resource_type="image"):
    """
    Delete file from Cloudinary with resource type support
    """
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return result.get('result') == 'ok'
    except Exception as e:
        print(f"Failed to delete from Cloudinary: {str(e)}")
        return False

def extract_public_id_from_url(url):
    """
    Extract public_id from Cloudinary URL
    """
    try:
        parts = url.split('/')
        upload_index = parts.index('upload')
        public_id_with_version = '/'.join(parts[upload_index + 2:])
        public_id = public_id_with_version.rsplit('.', 1)[0]
        return public_id
    except (ValueError, IndexError):
        return None

def check_cloudinary_health():
    """Check if Cloudinary is properly configured and accessible"""
    try:
        # FIX: Use direct environment variable check
        import os
        cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
        api_key = os.getenv('CLOUDINARY_API_KEY') 
        api_secret = os.getenv('CLOUDINARY_API_SECRET')
        
        if not all([cloud_name, api_key, api_secret]):
            return False, "Missing Cloudinary environment variables"
        
        # Test with a simple API call
        api.ping()
        
        return True, "Cloudinary is properly configured and responsive"
    except Exception as e:
        return False, f"Cloudinary configuration error: {str(e)}"