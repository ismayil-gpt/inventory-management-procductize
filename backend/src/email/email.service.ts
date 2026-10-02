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
    const port = Number(this.config.get('SMTP_PORT', 587));
    return nodemailer.createTransport({
      host,
      port,
      // DESC #1 — supplier email is the only outbound traffic, so it is never
      // sent in clear: port 465 is TLS from the first byte; any other port must
      // upgrade with STARTTLS, and the send fails if the relay cannot.
      // SMTP_REQUIRE_TLS=false exists only for a lab relay without TLS.
      secure: String(this.config.get('SMTP_SECURE', port === 465)) === 'true',
      requireTLS: String(this.config.get('SMTP_REQUIRE_TLS', 'true')) !== 'false',
      auth: this.config.get<string>('SMTP_USER')
        ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASSWORD') }
        : undefined,
    });
  }

  async send(to: string, subject: string, text: string, attachments: EmailAttachment[] = []): Promise<SendResult> {
    const transporter = this.transporter();
    if (!transporter) {
      // DESC #15: never log the recipient's address. The subject carries the PO number.
      this.logger.warn(`SMTP not configured — email "${subject}" was not sent.`);
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
      this.logger.error(`Failed to send email "${subject}": ${(error as Error).message}`);
      return { sent: false, reason: (error as Error).message };
    }
  }
}
