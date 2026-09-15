import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

/**
 * On-premise SMTP dispatch — the ONLY permitted outbound traffic at runtime
 * (CLAUDE.md §1, §16). When SMTP is not configured (e.g. on the dev laptop) the
 * send is a no-op that reports `sent: false` so callers degrade gracefully.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');

  constructor(private readonly config: ConfigService) {}

  private transporter(): nodemailer.Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;
    return nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure: false,
      auth: this.config.get<string>('SMTP_USER')
        ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASSWORD') }
        : undefined,
    });
  }

  async send(to: string, subject: string, text: string, attachments: EmailAttachment[] = []): Promise<SendResult> {
    const transporter = this.transporter();
    if (!transporter) {
      this.logger.warn(`SMTP not configured — email to ${to} ("${subject}") was not sent.`);
      return { sent: false, reason: 'SMTP not configured' };
    }
    try {
      await transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'Mizan <inventory@example.com>'),
        to,
        subject,
        text,
        attachments,
      });
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
      return { sent: false, reason: (error as Error).message };
    }
  }
}
