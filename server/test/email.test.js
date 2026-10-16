import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createEmail } from '../lib/email.js';

test('the email adapter sends a notification through a local SMTP server', { timeout: 10000 }, async (t) => {
  let message = '';
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP review-test\r\n');
    let buffered = '';
    let receivingData = false;
    socket.on('data', chunk => {
      buffered += chunk;
      while (buffered.includes('\r\n')) {
        const end = buffered.indexOf('\r\n');
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        if (receivingData) {
          if (line === '.') {
            receivingData = false;
            socket.write('250 message accepted\r\n');
          } else message += `${line}\n`;
        } else if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH ')) socket.write('235 authenticated\r\n');
        else if (line === 'DATA') { receivingData = true; socket.write('354 send message\r\n'); }
        else if (line === 'QUIT') socket.end('221 goodbye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const email = createEmail({ smtp: {
    host: '127.0.0.1', port: server.address().port,
    user: 'sender@example.test', pass: 'synthetic-smtp-password', from: 'sender@example.test',
  } });
  await email.sendEmailMessage('recipient@example.test', 'Renewal reminder', 'Synthetic notification delivery.');
  assert.match(message, /To: recipient@example.test/);
  assert.match(message, /Subject: Renewal reminder/);
  assert.match(message, /Synthetic notification delivery\./);
});

test('the email adapter still rejects delivery when SMTP is not configured', async () => {
  const email = createEmail({ smtp: {} });
  await assert.rejects(email.sendEmailMessage('recipient@example.test', 'Example', 'Synthetic'), /smtp_not_configured/);
});
