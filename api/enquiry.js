/**
 * Sends an enquiry from the contact form as an email, via Brevo.
 *
 * The site itself is static. This is the one server-side piece: a Vercel
 * function so the visitor never has to leave the page or open their mail app.
 *
 * Required environment variables (set in Vercel, never committed):
 *   BREVO_API_KEY       transactional API key from Brevo
 *   ENQUIRY_TO_EMAIL    where enquiries are delivered
 * Optional:
 *   BREVO_SENDER_EMAIL  the "from" address — must be a verified sender in
 *                       Brevo, defaults to ENQUIRY_TO_EMAIL
 *   BREVO_SENDER_NAME   defaults to "Portfolio enquiry"
 *
 * The visitor's address goes in replyTo, not from: sending as them would fail
 * SPF/DKIM for their domain and land in spam. Hitting reply still reaches them.
 *
 * CommonJS on purpose — the root package.json is not an ES module, so a .js
 * function using `export default` would fail to load on Vercel.
 */

const MAX = { name: 120, email: 200, service: 80, budget: 80, brief: 4000 };

const clean = (value, limit) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : '';

// Deliberately loose. Real validation is whether the reply arrives.
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const to = process.env.ENQUIRY_TO_EMAIL;

  if (!apiKey || !to) {
    const missing = [!apiKey && 'BREVO_API_KEY', !to && 'ENQUIRY_TO_EMAIL'].filter(Boolean);
    console.error(`[enquiry] Not configured — missing ${missing.join(' and ')}.`);
    return response.status(500).json({
      error: 'not-configured',
      // Naming the variable turns "it failed" into something fixable without
      // digging through function logs. No secret is revealed by the name.
      detail: `Set ${missing.join(' and ')} in Vercel → Settings → Environment Variables.`,
    });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return response.status(400).json({ error: 'Malformed request.' });
    }
  }
  body = body || {};

  // Bots fill in every field they find; people never see this one.
  if (clean(body.company, 100)) {
    return response.status(200).json({ ok: true });
  }

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const service = clean(body.service, MAX.service);
  const budget = clean(body.budget, MAX.budget);
  const brief = clean(body.brief, MAX.brief);

  if (!name) return response.status(400).json({ error: 'name' });
  if (!looksLikeEmail(email)) return response.status(400).json({ error: 'email' });
  if (brief.length < 10) return response.status(400).json({ error: 'brief' });

  const lines = [
    ['Name', name],
    ['Email', email],
    ['Service', service],
    ['Budget', budget],
  ];

  const text =
    lines.map(([label, value]) => `${label}: ${value || '—'}`).join('\n') + `\n\n${brief}`;

  const html =
    `<table style="font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${lines
      .map(
        ([label, value]) =>
          `<tr><td style="padding:2px 12px 2px 0;color:#6e6e73">${label}</td>` +
          `<td style="padding:2px 0"><strong>${escapeHtml(value || '—')}</strong></td></tr>`
      )
      .join('')}</table>` +
    `<p style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:pre-wrap">${escapeHtml(
      brief
    )}</p>`;

  try {
    const brevo = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || to,
          name: process.env.BREVO_SENDER_NAME || 'Portfolio enquiry',
        },
        to: [{ email: to }],
        replyTo: { email, name },
        subject: `${service || 'New'} enquiry — ${name}`,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!brevo.ok) {
      const raw = await brevo.text();
      console.error(`[enquiry] Brevo responded ${brevo.status}: ${raw}`);

      // A 4xx from Brevo is almost always configuration — an unverified sender
      // or a bad key — so pass the message through. 5xx is their outage and
      // tells the visitor nothing useful.
      let detail;
      if (brevo.status >= 400 && brevo.status < 500) {
        try {
          detail = JSON.parse(raw).message;
        } catch {
          detail = raw.slice(0, 200);
        }
      }
      return response.status(502).json({ error: 'send-failed', ...(detail ? { detail } : {}) });
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error(`[enquiry] ${error.message}`);
    return response.status(502).json({ error: 'send-failed' });
  }
};
