# cloudinary_config.py
import cloudinary
import cloudinary.uploader
import cloudinary.api
from cloudinary.utils import cloudinary_url
from app.core.config import settings

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
    
def upload_voice_message(file_content, public_id=None, folder="voice_messages"):
    """
    Specialized function for uploading voice messages to Cloudinary
    """
    try:
        # Use the base folder from settings and append voice_messages
        base_folder = getattr(settings, 'CLOUDINARY_UPLOAD_FOLDER', 'whisper_space')
        full_folder = f"{base_folder}/{folder}" if base_folder else folder
        
        print(f"📁 Uploading to folder: {full_folder}")
        
        # Try multiple resource types for better compatibility
        resource_types_to_try = ["auto", "video", "raw"]
        
        for resource_type in resource_types_to_try:
            try:
                print(f"🔄 Trying resource_type: {resource_type}")
                upload_result = cloudinary.uploader.upload(
                    file_content,
                    public_id=public_id,
                    folder=full_folder,
                    overwrite=False,
                    resource_type=resource_type,
                    use_filename=True,
                    unique_filename=True,
                    timeout=60
                )
                print(f"✅ Success with resource_type: {resource_type}")
                return upload_result
            except Exception as type_error:
                print(f"❌ Failed with {resource_type}: {str(type_error)}")
                continue
        
        # If all resource types fail
        raise Exception(f"All resource types failed: {resource_types_to_try}")
            
    except Exception as e:
        raise Exception(f"Voice message upload failed: {str(e)}")

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