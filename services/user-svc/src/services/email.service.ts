import nodemailer, { Transporter } from "nodemailer";

// ─────────────────────────────────────────────────────
// Email Service (Nodemailer)
// ─────────────────────────────────────────────────────

let transporter: Transporter;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  return transporter;
}

// ─── HTML Email Templates ──────────────────────────────

function otpVerificationEmailHTML(otp: string, name: string): string {
  const digits = otp.split("");
  const digitBoxes = digits
    .map(
      (d) =>
        `<td style="width:48px;height:56px;background:#f0ecfa;border-radius:10px;text-align:center;font-size:28px;font-weight:800;color:#500088;letter-spacing:2px;border:2px solid #e0d4f5;">${d}</td>`
    )
    .join('<td style="width:8px;"></td>');

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Digiability</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Building an Inclusive Digital Community</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1e1b4b;margin:0 0 16px;font-size:20px;">Hey ${name}, verify your email 👋</h2>
              <p style="color:#4b5563;line-height:1.7;margin:0 0 24px;">
                Thanks for signing up! Use the verification code below to confirm your email address. This code expires in <strong>10 minutes</strong>.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>${digitBoxes}</tr>
                </table>
              </div>
              <p style="color:#4b5563;text-align:center;font-size:14px;margin:0 0 24px;">
                Enter this code in the app to verify your account.
              </p>
              <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} Digiability Community. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
}

function resetPasswordEmailHTML(resetUrl: string, name: string): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#ef4444,#f97316);padding:32px 40px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Digiability</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Password Reset Request</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1e1b4b;margin:0 0 16px;font-size:20px;">Reset your password, ${name}</h2>
              <p style="color:#4b5563;line-height:1.7;margin:0 0 24px;">
                We received a request to reset your password. Click the button below to create a new password. This link expires in <strong>1 hour</strong>.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}"
                   style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">
                  🔐 Reset Password
                </a>
              </div>
              <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
                If you didn't request a password reset, you can safely ignore this email — your password won't change.<br/>
                If the button doesn't work, copy this link:<br/>
                <a href="${resetUrl}" style="color:#ef4444;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} Digiability Community. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
}

// ─── Public API ────────────────────────────────────────

/**
 * Send account verification OTP email.
 */
export async function sendVerificationOtpEmail(
  to: string,
  name: string,
  otp: string
): Promise<void> {
  // Log OTP to console in development so you don't have to check email
  if (process.env.NODE_ENV === "development") {
    console.log(`\n[EmailService / DEV] Verification OTP for ${to}: ${otp}\n`);
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `${otp} — Verify your Digiability account`,
    html: otpVerificationEmailHTML(otp, name),
  });
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const baseUrl = process.env.CLIENT_BASE_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  // Log link to console in development so you don't have to check Mailtrap
  if (process.env.NODE_ENV === "development") {
    console.log(`\n[EmailService / DEV] Password Reset Link for ${to}:\n${resetUrl}\n`);
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Reset your Digiability password",
    html: resetPasswordEmailHTML(resetUrl, name),
  });
}

