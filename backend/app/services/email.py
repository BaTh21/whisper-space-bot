import aiosmtplib
from email.message import EmailMessage
from ..core.config import settings

async def send_verification_email(email: str, code: str):
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = email
    message["Subject"] = "Whisper Space - Verify Your Email"
    message.set_content(f"Your verification code is: **{code}**")

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        start_tls=True,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASS,
    )