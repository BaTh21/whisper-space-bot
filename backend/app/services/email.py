# app/services/email.py
import aiosmtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional
import asyncio

from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Email service with robust error handling and multiple fallbacks"""
    
    def __init__(self):
        self.smtp_enabled = settings.SMTP_ENABLED and all([
            settings.SMTP_HOST,
            settings.SMTP_USER,
            settings.SMTP_PASS,
            settings.SMTP_FROM
        ])
        
        if self.smtp_enabled:
            logger.info(f"SMTP configured: {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        else:
            logger.warning("SMTP not configured or incomplete")
    
    async def send_verification_email(self, email: str, code: str) -> bool:
        """
        Send verification email with multiple fallback strategies
        Returns True if email was sent successfully or in development mode
        """
        # Always log the code for debugging
        logger.info(f"Attempting to send verification email to {email}, code: {code}")
        
        # In development mode, just log and return success
        if settings.is_development():
            print(f"📧 [DEVELOPMENT] Verification code for {email}: {code}")
            print(f"📧 [DEVELOPMENT] To send real emails, set ENVIRONMENT=production")
            return True
        
        # In production, try to send real email
        if not self.smtp_enabled:
            logger.error("Cannot send email: SMTP not configured")
            print(f"📧 [ERROR] Cannot send email to {email}. Code: {code}")
            print(f"📧 [ERROR] Check SMTP configuration in .env file")
            return False
        
        try:
            # Try to send email with multiple SMTP configurations
            success = await self._send_with_retry(email, code)
            
            if success:
                logger.info(f"Email sent successfully to {email}")
                return True
            else:
                logger.error(f"Failed to send email to {email} after all retries")
                print(f"📧 [FALLBACK] Verification code for {email}: {code}")
                return False
                
        except Exception as e:
            logger.error(f"Email sending error for {email}: {str(e)}")
            print(f"📧 [ERROR] Failed to send email to {email}: {str(e)}")
            print(f"📧 [FALLBACK] Verification code: {code}")
            return False
    
    async def _send_with_retry(self, email: str, code: str) -> bool:
        """Try multiple SMTP configurations with retries"""
        
        # Different SMTP configurations to try
        # For Gmail: Port 587 with STARTTLS, Port 465 with SSL/TLS
        configs = [
            {"port": 587, "use_tls": False, "start_tls": True},  # STARTTLS
            {"port": 465, "use_tls": True, "start_tls": False},  # SSL/TLS
            {"port": 25, "use_tls": False, "start_tls": False},  # Fallback
        ]
        
        for config in configs:
            try:
                logger.info(f"Trying SMTP on port {config['port']}")
                success = await self._send_smtp_email(email, code, config)
                if success:
                    return True
            except Exception as e:
                logger.warning(f"SMTP port {config['port']} failed: {str(e)}")
                continue
        
        return False
    
    async def _send_smtp_email(self, email: str, code: str, config: dict) -> bool:
        """Send email using specific SMTP configuration"""
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["From"] = settings.SMTP_FROM
            message["To"] = email
            message["Subject"] = "Whisper Space - Verify Your Email"
            
            # Generate email content
            text_content, html_content = self._generate_email_content(code)
            
            # Attach parts
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Create SSL context
            ssl_context = ssl.create_default_context()
            
            # Send email based on configuration
            if config["use_tls"]:
                # SSL/TLS (port 465)
                await aiosmtplib.send(
                    message,
                    hostname=settings.SMTP_HOST,
                    port=config["port"],
                    username=settings.SMTP_USER,
                    password=settings.SMTP_PASS,
                    use_tls=True,
                    tls_context=ssl_context,
                    timeout=30
                )
            elif config.get("start_tls", False):
                # STARTTLS (port 587)
                await aiosmtplib.send(
                    message,
                    hostname=settings.SMTP_HOST,
                    port=config["port"],
                    username=settings.SMTP_USER,
                    password=settings.SMTP_PASS,
                    start_tls=True,
                    timeout=30
                )
            else:
                # Plain connection (port 25 - not recommended for production)
                await aiosmtplib.send(
                    message,
                    hostname=settings.SMTP_HOST,
                    port=config["port"],
                    username=settings.SMTP_USER,
                    password=settings.SMTP_PASS,
                    timeout=30
                )
            
            return True
            
        except Exception as e:
            logger.error(f"SMTP error on port {config['port']}: {str(e)}")
            raise
    
    def _generate_email_content(self, code: str):
        """Generate text and HTML email content"""
        current_year = datetime.now().year
        
        text_content = f"""
        Whisper Space - Verify Your Email
        
        Hello,
        
        Thank you for signing up for Whisper Space. 
        Use the verification code below to confirm your email address:
        
        Verification Code: {code}
        
        This code will expire in 10 minutes.
        
        If you didn't request this email, please ignore it.
        
        © {current_year} Whisper Space. All rights reserved.
        """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email - Whisper Space</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="padding: 40px 30px; text-align: center;">
                                    <h1 style="color: #333; margin-bottom: 30px;">Verify Your Email</h1>
                                    
                                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                                        Hello,
                                    </p>
                                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                                        Thank you for signing up for <strong>Whisper Space</strong>.
                                        Use the verification code below to confirm your email address:
                                    </p>
                                    
                                    <div style="margin: 40px 0;">
                                        <div style="display: inline-block; background-color: #4a90e2; color: white; 
                                                    font-size: 32px; font-weight: bold; padding: 20px 40px; 
                                                    border-radius: 8px; letter-spacing: 5px;">
                                            {code}
                                        </div>
                                    </div>
                                    
                                    <p style="color: #888; font-size: 14px; margin-bottom: 40px;">
                                        This code will expire in <strong>10 minutes</strong>.
                                    </p>
                                    
                                    <div style="border-top: 1px solid #eee; padding-top: 20px;">
                                        <p style="color: #999; font-size: 12px;">
                                            If you didn't request this email, you can safely ignore it.<br>
                                            © {current_year} Whisper Space. All rights reserved.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        return text_content, html_content
    
    async def test_connection(self) -> dict:
        """Test SMTP connection"""
        if not self.smtp_enabled:
            return {"status": "error", "message": "SMTP not configured"}
        
        # Try both common ports
        ports_to_test = [587, 465]
        
        for port in ports_to_test:
            try:
                ssl_context = ssl.create_default_context()
                
                if port == 465:
                    # SSL/TLS
                    await aiosmtplib.connect(
                        hostname=settings.SMTP_HOST,
                        port=port,
                        use_tls=True,
                        username=settings.SMTP_USER,
                        password=settings.SMTP_PASS,
                        tls_context=ssl_context,
                        timeout=10
                    )
                else:
                    # STARTTLS
                    await aiosmtplib.connect(
                        hostname=settings.SMTP_HOST,
                        port=port,
                        start_tls=True,
                        username=settings.SMTP_USER,
                        password=settings.SMTP_PASS,
                        timeout=10
                    )
                
                return {
                    "status": "success", 
                    "message": f"Connected to {settings.SMTP_HOST}:{port}"
                }
                
            except Exception as e:
                logger.warning(f"Connection failed on port {port}: {str(e)}")
                continue
        
        return {
            "status": "error", 
            "message": f"Failed to connect to {settings.SMTP_HOST} on ports 587 or 465",
            "config": {
                "host": settings.SMTP_HOST,
                "user": settings.SMTP_USER,
                "has_password": bool(settings.SMTP_PASS)
            }
        }

# Create global instance
email_service = EmailService()

# Backward compatibility function
async def send_verification_email(email: str, code: str) -> bool:
    """Legacy function for backward compatibility"""
    return await email_service.send_verification_email(email, code)