import { createServer, Server, Socket } from 'node:net';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// End-to-end check of supplier email (the only outbound traffic, §1) against a
// minimal in-process SMTP server: the message, its recipient and its PDF
// attachment must actually go out over SMTP. Guards dependency upgrades of
// nodemailer (DESC control 16 remediation).
function startFakeSmtp(): Promise<{ server: Server; port: number; received: () => string; recipients: string[] }> {
  let data = '';
  const recipients: string[] = [];
  const server = createServer((socket: Socket) => {
    let inData = false;
    socket.write('220 fake-smtp ready\r\n');
    socket.on('data', (chunk) => {
      for (const line of chunk.toString().split('\r\n')) {
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 queued\r\n');
          } else {
            data += `${line}\n`;
          }
          continue;
        }
        if (!line) continue;
        const command = line.slice(0, 4).toUpperCase();
        if (command === 'EHLO' || command === 'HELO') socket.write('250-fake-smtp\r\n250 OK\r\n');
        else if (command === 'MAIL') socket.write('250 OK\r\n');
        else if (command === 'RCPT') {
          recipients.push(line);
          socket.write('250 OK\r\n');
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 go ahead\r\n');
        } else if (command === 'QUIT') {
          socket.end('221 bye\r\n');
        } else socket.write('250 OK\r\n');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port, received: () => data, recipients });
    });
  });
}

describe('EmailService', () => {
  it('sends the purchase order with its PDF attachment over SMTP', async () => {
    const smtp = await startFakeSmtp();
    try {
      const service = new EmailService(new ConfigService({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_FROM: 'Mizan <inventory@example.com>' }));
      const result = await service.send(
        'orders@supplier.example',
        'Purchase order PO-2026-0099',
        'Please find the purchase order attached.',
        [{ filename: 'PO-2026-0099.pdf', content: Buffer.from('%PDF-1.3 test') }],
      );
      expect(result).toEqual({ sent: true });
      expect(smtp.recipients.join(' ')).toContain('orders@supplier.example');
      expect(smtp.received()).toContain('Subject: Purchase order PO-2026-0099');
      expect(smtp.received()).toContain('PO-2026-0099.pdf');
    } finally {
      smtp.server.close();
    }
  });

  it('reports not sent, without throwing, when SMTP is not configured', async () => {
    const service = new EmailService(new ConfigService({}));
    await expect(service.send('orders@supplier.example', 'Subject', 'Body')).resolves.toEqual({ sent: false, reason: 'SMTP not configured' });
  });
});
