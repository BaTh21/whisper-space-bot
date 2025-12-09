import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def send_verification_email_sync(to_email: str, code: str) -> bool:
    """
    Send verification email - SYNC version (MORE RELIABLE)
    """
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Whisper Space - Email Verification'
        msg['From'] = settings.SMTP_FROM
        msg['To'] = to_email
        
        # Text version
        text = f"""Whisper Space Verification Code: {code}
        
This code expires in 10 minutes.
If you didn't request this, please ignore this email."""
        
        # HTML version
        html = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .code {{ font-size: 32px; font-weight: bold; color: #4a90e2; padding: 20px; background: #f0f8ff; border-radius: 8px; text-align: center; margin: 20px 0; letter-spacing: 5px; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h2 style="color: #333;">Whisper Space</h2>
        <h3>Verify Your Email Address</h3>
        <p>Please use the following verification code to complete your registration:</p>
        
        <div class="code">{code}</div>
        
        <p style="color: #666;">This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't create an account with Whisper Space, please ignore this email.</p>
        
        <div class="footer">
            <p>© 2024 Whisper Space. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </div>
</body>
</html>"""
        
        # Add parts
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email with SSL (port 465)
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
        
        logger.info(f"✅ Email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"❌ SMTP Authentication failed: {e}")
        logger.error("Please check your Gmail app password")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False


async def send_verification_email(to_email: str, code: str) -> bool:
    """
    Async wrapper for email sending
    """
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        # Run sync function in thread pool
        result = await loop.run_in_executor(
            None, 
            send_verification_email_sync, 
            to_email, 
            code
        )
        return result
    except Exception as e:
        logger.error(f"❌ Async email error: {e}")
        return False