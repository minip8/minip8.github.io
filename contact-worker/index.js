import { EmailMessage } from 'cloudflare:email';

const LIMITS = { name: 100, email: 200, message: 5000 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, cors);
    }
    if (!cors['Access-Control-Allow-Origin']) {
      return json({ ok: false, error: 'Forbidden' }, 403, cors);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'Invalid form data' }, 400, cors);
    }

    // Honeypot: the real form hides this field; bots tend to fill it in.
    // Pretend success so they don't learn anything.
    if (String(form.get('website') || '').trim()) {
      return json({ ok: true }, 200, cors);
    }

    // Header-bound values lose CR/LF so they can't inject extra headers.
    const name = oneLine(form.get('name')).slice(0, LIMITS.name);
    const email = oneLine(form.get('email')).slice(0, LIMITS.email);
    const message = String(form.get('message') || '').trim().slice(0, LIMITS.message);

    if (!name || !message || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      return json({ ok: false, error: 'Please fill in your name, a valid email and a message.' }, 400, cors);
    }

    const raw = buildMime({
      from: env.FROM_ADDRESS,
      to: env.TO_ADDRESS,
      replyName: name,
      replyEmail: email,
      subject: `minip8.com: message from ${name}`,
      body: `${message}\n\n--\n${name} <${email}>\nSent from the contact form on minip8.com`,
    });

    try {
      await env.EMAIL.send(new EmailMessage(env.FROM_ADDRESS, env.TO_ADDRESS, raw));
    } catch (err) {
      console.error('send failed', err);
      return json({ ok: false, error: 'Could not send right now. Please try again later.' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

function oneLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function b64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// RFC 2047 encoded-word, so names/subjects with non-ASCII survive.
function encodeWord(text) {
  return /^[\x20-\x7e]*$/.test(text) && !/[=?"]/.test(text) ? text : `=?UTF-8?B?${b64(text)}?=`;
}

function buildMime({ from, to, replyName, replyEmail, subject, body }) {
  const domain = from.split('@')[1];
  const encodedBody = b64(body).replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: "minip8.com contact form" <${from}>`,
    `To: <${to}>`,
    `Reply-To: ${encodeWord(replyName)} <${replyEmail}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n');
}
