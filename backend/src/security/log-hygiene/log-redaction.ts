import type { Options } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * DESC control 15 — no personal data in logs (CLAUDE.md §11.1): user IDs only,
 * never emails, passwords, tokens or IP addresses. The audit log (control 9)
 * is the designated, access-controlled place that records who did what and
 * from where; the application log is not.
 *
 * Two layers: request/response serializers keep only an allow-list of fields,
 * and `redact` scrubs any listed path that still reaches the logger, including
 * objects passed to logger calls by hand.
 */
export const REDACTED = '[redacted]';

export const REDACTED_PATHS = [
  'password',
  'passwordHash',
  'mfaSecret',
  'accessToken',
  'refreshToken',
  'email',
  'to',
  'ipAddress',
  '*.password',
  '*.passwordHash',
  '*.mfaSecret',
  '*.accessToken',
  '*.refreshToken',
  '*.email',
  '*.ipAddress',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

// Free-text messages can still carry an address (an SMTP error quoting the
// recipient, say), so anything shaped like an email is masked in log strings.
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const scrubEmails = (text: string): string => text.replace(EMAIL_PATTERN, REDACTED);

type RequestWithUser = IncomingMessage & { id?: unknown; user?: { userId?: string }; originalUrl?: string };

export const pinoHttpOptions: Options = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: REDACTED_PATHS, censor: REDACTED },
  serializers: {
    // Method, path and status are enough to trace a problem; the query string
    // is dropped because searches can contain names or emails.
    req: (req: RequestWithUser) => ({
      id: req.id,
      method: req.method,
      path: (req.originalUrl ?? req.url ?? '').split('?')[0],
    }),
    res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
  },
  hooks: {
    logMethod(args, method) {
      const cleaned = args.map((arg) => (typeof arg === 'string' ? scrubEmails(arg) : arg)) as typeof args;
      method.apply(this, cleaned);
    },
  },
  // The signed-in user's ID is the one identity the log may carry.
  customProps: (req) => {
    const userId = (req as RequestWithUser).user?.userId;
    return userId ? { userId } : {};
  },
  // Health checks would drown everything else.
  autoLogging: { ignore: (req) => (req.url ?? '').includes('/health') },
};
