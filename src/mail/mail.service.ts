import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config/configuration";

@Injectable()
export class MailService {
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const mail = this.config.get("mail", { infer: true });
    this.transporter = mail.host
      ? nodemailer.createTransport({
          host: mail.host,
          port: mail.port,
          secure: mail.secure,
          auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
        })
      : null;
  }

  assertConfigured(): void {
    if (!this.transporter) throw new ServiceUnavailableException("Email service is not configured");
  }

  async sendPasswordResetCode(to: string, displayName: string, code: string, expiresInMinutes: number): Promise<void> {
    this.assertConfigured();
    const safeName = this.escapeHtml(displayName);
    await this.transporter!.sendMail({
      from: this.config.get("mail.from", { infer: true }),
      to,
      subject: "Your MeliAuth password reset code",
      text: [
        `Hello ${displayName},`,
        "",
        `Your password reset code is: ${code}`,
        `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
        "",
        "If you did not request a password reset, you can ignore this email.",
      ].join("\n"),
      html: `<p>Hello ${safeName},</p>
<p>We received a request to reset your MeliAuth password.</p>
<p>Your password reset code is:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
<p>This code expires in ${expiresInMinutes} minutes and can only be used once.</p>
<p>If you did not request a password reset, you can ignore this email.</p>`,
    });
  }

  async sendEmailVerificationCode(to: string, displayName: string, code: string, expiresInMinutes: number): Promise<void> {
    this.assertConfigured();
    const safeName = this.escapeHtml(displayName);
    await this.transporter!.sendMail({
      from: this.config.get("mail.from", { infer: true }),
      to,
      subject: "Verify your MeliAuth email",
      text: [
        `Hello ${displayName},`,
        "",
        `Your email verification code is: ${code}`,
        `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
      html: `<p>Hello ${safeName},</p>
<p>Use this code to verify your MeliAuth email address:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
<p>This code expires in ${expiresInMinutes} minutes and can only be used once.</p>
<p>If you did not request this code, you can ignore this email.</p>`,
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]!);
  }
}
