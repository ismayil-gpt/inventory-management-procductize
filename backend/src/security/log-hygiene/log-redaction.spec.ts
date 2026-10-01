import pino from 'pino';
import { Writable } from 'node:stream';
import { pinoHttpOptions, REDACTED, scrubEmails } from './log-redaction';

// DESC control 15 evidence: whatever reaches the logger, no email, password,
// token or IP address comes out the other end.
function captureLogger() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const { redact, hooks } = pinoHttpOptions as { redact: pino.LoggerOptions['redact']; hooks: pino.LoggerOptions['hooks'] };
  return { logger: pino({ redact, hooks }, sink), output: () => lines.join('') };
}

describe('log redaction (DESC control 15)', () => {
  it('redacts credentials, emails and IP addresses in logged objects, top level and nested', () => {
    const { logger, output } = captureLogger();
    logger.info({
      email: 'aisha.rahman@demo.example',
      password: 'Admin@Mizan2026',
      refreshToken: 'eyJ.secret.token',
      ipAddress: '10.20.4.31',
      user: { email: 'omar@demo.example', passwordHash: '$argon2id$abc', userId: 'cmuser123' },
    }, 'user updated');
    const text = output();
    expect(text).not.toMatch(/demo\.example/);
    expect(text).not.toContain('Admin@Mizan2026');
    expect(text).not.toContain('eyJ.secret.token');
    expect(text).not.toContain('10.20.4.31');
    expect(text).not.toContain('$argon2id$abc');
    expect(text).toContain(REDACTED);
    // The user ID is the one identity the log may keep.
    expect(text).toContain('cmuser123');
  });

  it('masks email addresses inside free-text messages', () => {
    const { logger, output } = captureLogger();
    logger.error('Failed to send email "PO-2026-0007": 550 Recipient address rejected: orders@supplier.example');
    expect(output()).not.toContain('orders@supplier.example');
    expect(output()).toContain('PO-2026-0007');
  });

  it('drops the query string and keeps only method and path for requests', () => {
    const serialize = (pinoHttpOptions.serializers as { req: (r: unknown) => Record<string, unknown> }).req;
    const shaped = serialize({ id: 7, method: 'GET', originalUrl: '/api/v1/products?search=aisha@demo.example', headers: { authorization: 'Bearer x' } });
    expect(shaped).toEqual({ id: 7, method: 'GET', path: '/api/v1/products' });
  });

  it('scrubEmails leaves text without addresses unchanged', () => {
    expect(scrubEmails('Connected to PostgreSQL.')).toBe('Connected to PostgreSQL.');
  });
});
