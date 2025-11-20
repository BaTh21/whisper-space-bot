import cloudinary
import cloudinary.uploader
import cloudinary.api
from cloudinary.utils import cloudinary_url
from app.core.config import settings


def configure_cloudinary():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )
configure_cloudinary()
def upload_to_cloudinary(file_content, public_id=None, folder=None):
    """
    Upload file to Cloudinary
    """
    try:
        upload_result = cloudinary.uploader.upload(
            file_content,
            public_id=public_id,
            folder=folder or settings.CLOUDINARY_UPLOAD_FOLDER,
            overwrite=True,
            resource_type="image",
            transformation=[
                {"width": 400, "height": 400, "crop": "fill"},
                {"quality": "auto"},
                {"format": "auto"}
            ]
        )
        return upload_result
    except Exception as e:
        raise Exception(f"Cloudinary upload failed: {str(e)}")

def delete_from_cloudinary(public_id):
    """
    Delete file from Cloudinary
    """
    try:
        result = cloudinary.uploader.destroy(public_id)
        return result.get('result') == 'ok'
    except Exception as e:
        print(f"Failed to delete from Cloudinary: {str(e)}")
        return False

def extract_public_id_from_url(url):
    """
    Extract public_id from Cloudinary URL
    """
    try:
        # URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567/folder/filename.jpg
        parts = url.split('/')
        upload_index = parts.index('upload')
        public_id_with_version = '/'.join(parts[upload_index + 2:])
        # Remove file extension
        public_id = public_id_with_version.rsplit('.', 1)[0]
        return public_id
    except (ValueError, IndexError):
        return None