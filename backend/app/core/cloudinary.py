# cloudinary_config.py
import traceback
import cloudinary
from cloudinary import uploader, api
from cloudinary.utils import cloudinary_url
import uuid
import os

# Remove the direct settings import to avoid circular imports
# from app.core.config import settings  # ← Remove this

def configure_cloudinary():
    """Configure Cloudinary with all necessary settings"""
    try:
        # Use environment variables directly to avoid circular imports
        cloudinary.config(
            cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
            api_key=os.getenv('CLOUDINARY_API_KEY'),
            api_secret=os.getenv('CLOUDINARY_API_SECRET'),
            secure=True
        )
        print("✅ Cloudinary configured successfully")
    except Exception as e:
        print(f"❌ Cloudinary configuration failed: {str(e)}")
        raise

# Call configuration
configure_cloudinary()

def upload_to_cloudinary(file_content, public_id=None, folder=None, resource_type="image"):
    """
    Upload file to Cloudinary with support for different resource types
    """
    try:
        # Use consistent folder handling
        base_folder = os.getenv('CLOUDINARY_UPLOAD_FOLDER', 'whisper_space')
        
        upload_kwargs = {
            "file": file_content,
            "public_id": public_id,
            "folder": f"{base_folder}/{folder}" if folder else base_folder,
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
        
        upload_result = uploader.upload(**upload_kwargs)
        return upload_result
    except Exception as e:
        raise Exception(f"Cloudinary upload failed: {str(e)}")
    
def upload_voice_message(file_content: bytes, public_id: str = None, folder: str = "voice_messages"):
    """
    FIXED: Consistent folder handling
    """
    try:
        base_folder = os.getenv('CLOUDINARY_UPLOAD_FOLDER', 'whisper_space')
        full_folder = f"{base_folder}/{folder}"

        if not public_id:
            public_id = f"voice_{uuid.uuid4().hex[:12]}"

        print(f"📤 Uploading voice → {full_folder}/{public_id}")

        upload_result = uploader.upload(
            file_content,
            resource_type="video",  # Use "video" for audio files
            public_id=public_id,
            folder=full_folder,
            overwrite=True,
            format="mp3",
            timeout=30
        )

        mp3_url = upload_result["secure_url"]
        print(f"✅ VOICE UPLOAD SUCCESS → {mp3_url}")

        return {
            "secure_url": mp3_url,
            "public_id": upload_result["public_id"],
            "format": upload_result.get("format", "mp3"),
            "duration": upload_result.get("duration"),
            "bytes": upload_result.get("bytes"),
        }

    except Exception as e:
        print(f"❌ CRITICAL: Voice upload failed: {str(e)}")
        traceback.print_exc()
        raise Exception(f"Cloudinary upload failed: {str(e)}")

def delete_from_cloudinary(public_id, resource_type="image"):
    """
    Delete file from Cloudinary with resource type support
    """
    try:
        result = uploader.destroy(public_id, resource_type=resource_type)
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
        cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
        api_key = os.getenv('CLOUDINARY_API_KEY') 
        api_secret = os.getenv('CLOUDINARY_API_SECRET')
        
        if not all([cloud_name, api_key, api_secret]):
            return False, "Missing Cloudinary environment variables"
        
        # Test the configuration
        api.ping()
        
        return True, "Cloudinary is properly configured and responsive"
    except Exception as e:
        return False, f"Cloudinary configuration error: {str(e)}"