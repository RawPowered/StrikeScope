import nodemailer from 'nodemailer'
import db from './db.js'

export interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromEmail: string
  fromName: string
}

export function getEmailConfig(companyId: string): EmailConfig | null {
  const row = db.prepare('SELECT smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name FROM company_email_config WHERE company_id = ?').get(companyId) as any
  if (!row) return null
  return {
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port || 587,
    smtpUser: row.smtp_user || '',
    smtpPass: row.smtp_pass || '',
    fromEmail: row.from_email || '',
    fromName: row.from_name || '',
  }
}

export function getTransporter(cfg: EmailConfig) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: cfg.smtpUser && cfg.smtpPass ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
  })
}

export async function sendEmail(companyId: string, to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getEmailConfig(companyId)
  if (!cfg) return { ok: false, error: 'No email config for company' }
  try {
    const transporter = getTransporter(cfg)
    await transporter.sendMail({
      from: `"${cfg.fromName || 'StrikeScope'}" <${cfg.fromEmail}>`,
      to,
      subject,
      html,
    })
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export function buildSetupLink(baseUrl: string, token: string): string {
  return `${baseUrl}/customer/setup?token=${token}`
}

export function buildSetupEmailHtml(link: string, projectName: string): string {
  return `
    <h2>Welcome to StrikeScope</h2>
    <p>A project account has been created for you: <strong>${projectName}</strong></p>
    <p>Click the link below to set up your password and access your project portal:</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#F57C00;color:#fff;text-decoration:none;border-radius:4px">Set Up My Account</a></p>
    <p>This link expires in 7 days.</p>
    <p>If you did not expect this email, please ignore it.</p>
  `
}
