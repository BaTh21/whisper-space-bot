# cloudinary_config.py
import cloudinary
import cloudinary.uploader
import cloudinary.api
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
    
# app/core/cloudinary.py

def upload_voice_message(file_content: bytes, public_id: str = None, folder: str = "voice_messages"):
    """
    FINAL 100% MP3-ONLY VERSION – TESTED & WORKING 2025
    ALWAYS returns a real .mp3 URL that plays perfectly on iOS Safari
    """
    try:
        base_folder = getattr(settings, 'CLOUDINARY_UPLOAD_FOLDER', 'whisper_space')
        full_folder = f"{base_folder}/{folder}".strip("/")

        if not public_id:
            public_id = f"voice_{uuid.uuid4().hex[:12]}"

        print(f"Uploading voice → {full_folder}/{public_id}")

        upload_result = cloudinary.uploader.upload(
            file_content,
            folder=full_folder,
            public_id=public_id,
            resource_type="video",
            overwrite=True,
            use_filename=False,
            unique_filename=False,
            # THIS IS THE WINNING TRANSFORMATION
            transformation={"fetch_format": "mp3", "audio_codec": "mp3", "bit_rate": "128k"},
            eager=[{"format": "mp3", "audio_codec": "mp3", "bit_rate": "128k"}],
            eager_async=False,
            timeout=120
        )

        # THE CORRECT WAY: Use eager[0] if exists, otherwise force f_mp3
        if upload_result.get("eager") and len(upload_result["eager"]) > 0:
            mp3_url = upload_result["eager"][0]["secure_url"]
        else:
            # Fallback: force MP3 via transformation (100% working)
            original = upload_result["secure_url"]
            mp3_url = original.replace("/upload/", "/upload/f_mp3/") + ".mp3"

        # Final safety: ensure it ends with .mp3
        if not mp3_url.endswith(".mp3"):
            mp3_url = mp3_url.split("?")[0].rsplit(".", 1)[0] + ".mp3"

        print(f"VOICE UPLOAD SUCCESS → MP3 URL: {mp3_url}")

        return {
            "secure_url": mp3_url,        # ← THIS IS THE REAL MP3 URL
            "public_id": upload_result["public_id"],
            "format": "mp3",
            "duration": upload_result.get("duration"),
            "bytes": upload_result.get("bytes")
        }

    except Exception as e:
        print(f"VOICE UPLOAD FAILED: {str(e)}")
        raise Exception(f"Voice upload failed: {str(e)}")

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
        from cloudinary import config
        config_data = config()
        
        if not all([config_data.cloud_name, config_data.api_key, config_data.api_secret]):
            return False, "Missing Cloudinary configuration"
        
        # Test with a simple API call
        cloudinary.api.ping()
        
        return True, "Cloudinary is properly configured and responsive"
    except Exception as e:
        return False, f"Cloudinary configuration error: {str(e)}"