import aiosmtplib
from email.message import EmailMessage
from ..core.config import settings
from datetime import datetime
import resend
async def send_verification_email(email: str, code: str):
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = email
    message["Subject"] = "Whisper Space - Verify Your Email"

    # Plain-text fallback
    message.set_content(f"Your verification code is: {code}")

    # HTML version
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f5f6fa; padding: 20px;">
        <div style="max-width: 480px; margin: auto; background: white; padding: 24px; border-radius: 8px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.08);">

          <h2 style="color: #333; text-align: center;">Verify Your Email</h2>

          <p>Hello,</p>
          <p>Your Whisper Space verification code is:</p>

          <div style="font-size: 28px; font-weight: bold; text-align: center; 
                      margin: 20px 0; padding: 16px; border-radius: 6px;
                      background: #4a90e2; color: white;">
            {code}
          </div>

          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this, you can safely ignore this email.</p>

          <hr style="margin-top: 32px; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #777; text-align: center;">
            © {datetime.now().year} Whisper Space
          </p>

        </div>
      </body>
    </html>
    """

    message.add_alternative(html_content, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        use_tls=True,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASS,
    )


# resend.api_key = settings.RESEND_API_KEY

# async def send_verification_email(email: str, code: str):
#     try:
#         # For testing, send to your verified email instead
#         # Remove this in production
#         test_email = "mokkolsambath21@gmail.com"  # Your verified email
#         actual_recipient = email  # Keep track of who it was meant for
        
#         print(f"📧 Sending verification email (test mode):")
#         print(f"   Intended for: {email}")
#         print(f"   Actually sending to: {test_email}")
#         print(f"   Code: {code}")
        
#         result = resend.Emails.send({
#             "from": settings.EMAIL_FROM,
#             "to": test_email,  # Send to your verified email
#             "subject": f"Whisper Space - Verify Email for {email}",
#             "html": f"""
#             <!DOCTYPE html>
#             <html>
#             <head>
#                 <style>
#                     body {{ 
#                         font-family: Arial, sans-serif; 
#                         line-height: 1.6; 
#                         color: #333; 
#                         max-width: 600px; 
#                         margin: 0 auto; 
#                         padding: 20px;
#                     }}
#                     .test-notice {{
#                         background: #fef3c7;
#                         border: 1px solid #f59e0b;
#                         padding: 15px;
#                         border-radius: 8px;
#                         margin-bottom: 20px;
#                     }}
#                     .code {{
#                         background: #f8f9fa;
#                         padding: 20px;
#                         text-align: center;
#                         font-size: 32px;
#                         font-weight: bold;
#                         letter-spacing: 8px;
#                         margin: 25px 0;
#                         border-radius: 8px;
#                         color: #2563eb;
#                         border: 2px dashed #cbd5e1;
#                     }}
#                 </style>
#             </head>
#             <body>
#                 <div class="test-notice">
#                     <strong>TEST EMAIL</strong><br>
#                     This was intended for: <strong>{email}</strong><br>
#                     In production, this would go directly to the user.
#                 </div>
                
#                 <div class="header" style="text-align: center; background: #2563eb; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
#                     <h1>Whisper Space</h1>
#                     <p>Verify Your Email Address</p>
#                 </div>
                
#                 <div style="padding: 25px;">
#                     <p>Hello!</p>
#                     <p>Welcome to Whisper Space! Please use the following verification code to complete your registration:</p>
                    
#                     <div class="code">{code}</div>
                    
#                     <p>Enter this 6-digit code in the verification field in the app.</p>
#                     <p><strong>This code will expire in 10 minutes.</strong></p>
#                 </div>
#             </body>
#             </html>
#             """
#         })
#         print(f"✅ Test email sent with code: {code}")
#         return True
#     except Exception as e:
#         print(f"❌ Failed to send email: {str(e)}")
#         return False