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

    html_content = f"""
    <html>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f2f3f7; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; margin: 40px 0; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <h2 style="color: #333333; margin: 0; font-size: 24px;">Verify Your Email</h2>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 0; color: #555555; font-size: 16px;">
                    <p>Hello,</p>
                    <p>Thank you for signing up for Whisper Space. Use the verification code below to confirm your email address:</p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <div style="display: inline-block; font-size: 28px; font-weight: bold; color: #ffffff; background-color: #4a90e2; padding: 16px 32px; border-radius: 8px; letter-spacing: 2px;">
                      {code}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 0; color: #555555; font-size: 14px; text-align: center;">
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you did not request this email, you can safely ignore it.</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px; border-top: 1px solid #e0e0e0; text-align: center; color: #888888; font-size: 12px;">
                    <p>© {datetime.now().year} Whisper Space. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    message.add_alternative(html_content, subtype="html")
    try:
      await aiosmtplib.send(
          message,
          hostname=settings.SMTP_HOST,
          port=settings.SMTP_PORT,
          use_tls=True,
          username=settings.SMTP_USER,
          password=settings.SMTP_PASS,
      )
    except Exception as e:
      print(f"Failed to send email to {email}: {e}")