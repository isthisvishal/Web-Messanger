import type { EmailTemplateType } from "@prisma/client";

interface DefaultTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Web Messenger";

export const defaultTemplates: Record<EmailTemplateType, DefaultTemplate> = {
  LOGIN_OTP: {
    subject: `Your ${APP_NAME} Login Code`,
    htmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif}
.container{max-width:520px;margin:40px auto;background:linear-gradient(135deg,#13131a 0%,#1a1a2e 100%);border-radius:16px;border:1px solid rgba(139,92,246,.2);overflow:hidden}
.header{background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:32px;text-align:center}
.header h1{color:#fff;margin:0;font-size:24px;font-weight:700}
.body{padding:32px}
.greeting{color:#e2e8f0;font-size:16px;margin-bottom:16px}
.otp-box{background:rgba(139,92,246,.15);border:2px solid rgba(139,92,246,.4);border-radius:12px;padding:24px;text-align:center;margin:24px 0}
.otp-code{font-size:36px;letter-spacing:8px;color:#a78bfa;font-weight:800;font-family:'Courier New',monospace}
.info{color:#94a3b8;font-size:14px;margin-top:16px}
.footer{padding:24px 32px;border-top:1px solid rgba(139,92,246,.1);text-align:center}
.footer p{color:#64748b;font-size:12px;margin:0}</style></head>
<body><div class="container"><div class="header"><h1>🔐 ${APP_NAME}</h1></div>
<div class="body"><p class="greeting">Hi {{displayName}},</p>
<p style="color:#cbd5e1">Use the code below to complete your login:</p>
<div class="otp-box"><div class="otp-code">{{otp}}</div></div>
<p class="info">This code expires in {{expiryMinutes}} minutes. If you didn't request this, please ignore this email.</p></div>
<div class="footer"><p>© ${APP_NAME} — Zero-knowledge encrypted messaging</p></div></div></body></html>`,
    textBody: `Hi {{displayName}},\n\nYour login code: {{otp}}\n\nThis code expires in {{expiryMinutes}} minutes.\n\nIf you didn't request this, please ignore this email.\n\n— ${APP_NAME}`,
  },

  FORGOT_PASSWORD_OTP: {
    subject: `Reset Your ${APP_NAME} Password`,
    htmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif}
.container{max-width:520px;margin:40px auto;background:linear-gradient(135deg,#13131a 0%,#1a1a2e 100%);border-radius:16px;border:1px solid rgba(245,158,11,.2);overflow:hidden}
.header{background:linear-gradient(135deg,#d97706 0%,#b45309 100%);padding:32px;text-align:center}
.header h1{color:#fff;margin:0;font-size:24px}
.body{padding:32px}
.otp-box{background:rgba(245,158,11,.15);border:2px solid rgba(245,158,11,.4);border-radius:12px;padding:24px;text-align:center;margin:24px 0}
.otp-code{font-size:36px;letter-spacing:8px;color:#fbbf24;font-weight:800;font-family:'Courier New',monospace}
.info{color:#94a3b8;font-size:14px}
.footer{padding:24px 32px;border-top:1px solid rgba(245,158,11,.1);text-align:center}
.footer p{color:#64748b;font-size:12px;margin:0}</style></head>
<body><div class="container"><div class="header"><h1>🔑 Password Reset</h1></div>
<div class="body"><p style="color:#e2e8f0">Hi {{displayName}},</p>
<p style="color:#cbd5e1">We received a password reset request. Use this code:</p>
<div class="otp-box"><div class="otp-code">{{otp}}</div></div>
<p class="info">Requested at: {{requestedAt}}<br>Expires in {{expiryMinutes}} minutes.</p>
<p class="info">If you didn't request this, your account is safe — just ignore this email.</p></div>
<div class="footer"><p>© ${APP_NAME}</p></div></div></body></html>`,
    textBody: `Hi {{displayName}},\n\nPassword reset code: {{otp}}\nRequested: {{requestedAt}}\nExpires in {{expiryMinutes}} minutes.\n\n— ${APP_NAME}`,
  },

  EMAIL_VERIFICATION: {
    subject: `Verify Your ${APP_NAME} Email`,
    htmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif}
.container{max-width:520px;margin:40px auto;background:linear-gradient(135deg,#13131a 0%,#1a1a2e 100%);border-radius:16px;border:1px solid rgba(34,197,94,.2);overflow:hidden}
.header{background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:32px;text-align:center}
.header h1{color:#fff;margin:0;font-size:24px}
.body{padding:32px}
.otp-box{background:rgba(34,197,94,.15);border:2px solid rgba(34,197,94,.4);border-radius:12px;padding:24px;text-align:center;margin:24px 0}
.otp-code{font-size:36px;letter-spacing:8px;color:#4ade80;font-weight:800;font-family:'Courier New',monospace}
.info{color:#94a3b8;font-size:14px}
.footer{padding:24px 32px;border-top:1px solid rgba(34,197,94,.1);text-align:center}
.footer p{color:#64748b;font-size:12px;margin:0}</style></head>
<body><div class="container"><div class="header"><h1>✉️ Verify Email</h1></div>
<div class="body"><p style="color:#e2e8f0">Hi {{displayName}},</p>
<p style="color:#cbd5e1">Enter this code to verify your email:</p>
<div class="otp-box"><div class="otp-code">{{otp}}</div></div>
<p class="info">Expires in {{expiryMinutes}} minutes.</p></div>
<div class="footer"><p>© ${APP_NAME}</p></div></div></body></html>`,
    textBody: `Hi {{displayName}},\n\nVerification code: {{otp}}\nExpires in {{expiryMinutes}} minutes.\n\n— ${APP_NAME}`,
  },

  WELCOME: {
    subject: `Welcome to ${APP_NAME}! 🎉`,
    htmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif}
.container{max-width:520px;margin:40px auto;background:linear-gradient(135deg,#13131a 0%,#1a1a2e 100%);border-radius:16px;border:1px solid rgba(139,92,246,.2);overflow:hidden}
.header{background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);padding:40px;text-align:center}
.header h1{color:#fff;margin:0;font-size:28px}
.body{padding:32px;color:#cbd5e1}
.footer{padding:24px 32px;border-top:1px solid rgba(139,92,246,.1);text-align:center}
.footer p{color:#64748b;font-size:12px;margin:0}</style></head>
<body><div class="container"><div class="header"><h1>Welcome, {{displayName}}!</h1></div>
<div class="body"><p>Your account on {{appName}} is ready.</p>
<p>All messages are end-to-end encrypted — not even we can read them.</p>
<p>Start messaging securely today!</p></div>
<div class="footer"><p>© {{appName}}</p></div></div></body></html>`,
    textBody: `Welcome, {{displayName}}!\n\nYour {{appName}} account is ready. All messages are end-to-end encrypted.\n\n— {{appName}}`,
  },

  ACCOUNT_BANNED: {
    subject: `${APP_NAME} Account Suspended`,
    htmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif}
.container{max-width:520px;margin:40px auto;background:linear-gradient(135deg,#13131a 0%,#1a1a2e 100%);border-radius:16px;border:1px solid rgba(239,68,68,.2);overflow:hidden}
.header{background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:32px;text-align:center}
.header h1{color:#fff;margin:0;font-size:24px}
.body{padding:32px;color:#cbd5e1}
.reason{background:rgba(239,68,68,.1);border-left:4px solid #ef4444;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;color:#fca5a5}
.footer{padding:24px 32px;border-top:1px solid rgba(239,68,68,.1);text-align:center}
.footer p{color:#64748b;font-size:12px;margin:0}</style></head>
<body><div class="container"><div class="header"><h1>⚠️ Account Suspended</h1></div>
<div class="body"><p>Hi {{displayName}},</p><p>Your account has been suspended.</p>
<div class="reason">Reason: {{banReason}}</div>
<p style="color:#94a3b8;font-size:14px">If you believe this is an error, contact support.</p></div>
<div class="footer"><p>© ${APP_NAME}</p></div></div></body></html>`,
    textBody: `Hi {{displayName}},\n\nYour account has been suspended.\nReason: {{banReason}}\n\nContact support if you believe this is an error.\n\n— ${APP_NAME}`,
  },

  PASSWORD_CHANGED: {
    subject: `${APP_NAME} Password Changed`,
    htmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif}
.container{max-width:520px;margin:40px auto;background:linear-gradient(135deg,#13131a 0%,#1a1a2e 100%);border-radius:16px;border:1px solid rgba(59,130,246,.2);overflow:hidden}
.header{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:32px;text-align:center}
.header h1{color:#fff;margin:0;font-size:24px}
.body{padding:32px;color:#cbd5e1}
.footer{padding:24px 32px;border-top:1px solid rgba(59,130,246,.1);text-align:center}
.footer p{color:#64748b;font-size:12px;margin:0}</style></head>
<body><div class="container"><div class="header"><h1>🔒 Password Changed</h1></div>
<div class="body"><p>Hi {{displayName}},</p>
<p>Your password was changed at {{changedAt}}.</p>
<p>If this wasn't you, contact support immediately.</p></div>
<div class="footer"><p>© ${APP_NAME}</p></div></div></body></html>`,
    textBody: `Hi {{displayName}},\n\nYour password was changed at {{changedAt}}.\n\nIf this wasn't you, contact support immediately.\n\n— ${APP_NAME}`,
  },
};
