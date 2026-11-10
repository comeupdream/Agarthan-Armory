/* =============================================================================
 * mail.mjs — email alerts for the store (ported from the XAT console's mailer).
 *
 * A requisition or a message from the site emails the store, so nobody has to
 * keep the console open. Delivery goes through Resend's HTTPS API (plain
 * fetch, no SDK):
 *   RESEND_API_KEY   the provider key (Render env, never the repo)
 *   ALERT_EMAIL      where alerts go (the store's inbox)
 *   MAIL_FROM        the sender, once the domain is verified with Resend
 *                    ("Agarthan Armory <alerts@agarthanarmory.com>");
 *                    Resend's onboarding address works before that
 * Without a key the message is written to the server log instead, so every
 * flow still works and one env var turns delivery on. Never throws.
 * ===========================================================================*/
const FROM_FALLBACK = 'Agarthan Armory <onboarding@resend.dev>';
const isAddr = (v) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(v || '').trim());

export function mailStatus() {
  const to = String(process.env.ALERT_EMAIL || '').trim();
  return { configured: !!process.env.RESEND_API_KEY, to: isAddr(to) ? to : '', from: process.env.MAIL_FROM || FROM_FALLBACK };
}

export async function send({ to, subject, text, replyTo }) {
  if (!isAddr(to) || !subject) return { delivered: false, error: 'no address to send to' };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || FROM_FALLBACK;
  if (!key) {
    console.log(`[mail] (no RESEND_API_KEY — logged, not sent)\n  TO: ${to}\n  SUBJECT: ${subject}\n${String(text || '').split('\n').map((l) => '  | ' + l).join('\n')}`);
    return { delivered: false, logged: true };
  }
  try {
    const r = await fetch(`${(process.env.RESEND_API || 'https://api.resend.com').replace(/\/$/, '')}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, ...(isAddr(replyTo) ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('[mail] provider refused:', r.status, j.message || ''); return { delivered: false, error: j.message || `HTTP ${r.status}` }; }
    return { delivered: true, id: j.id };
  } catch (e) { console.error('[mail] send failed:', e.message); return { delivered: false, error: e.message }; }
}

/** the new-message alert: who, how to reach them, what they want */
export function inboxAlert(rec, siteUrl) {
  const kind = rec.kind === 'requisition' ? 'Requisition (hold request)' : rec.kind === 'transfer' ? 'FFL transfer' : 'Message';
  const lines = [
    `${kind} from ${rec.name}`, `Contact: ${rec.contact}`, rec.topic ? `Topic: ${rec.topic}` : '',
    rec.items.length ? `\nItems:\n${rec.items.map((x) => `  - ${x}`).join('\n')}` : '',
    rec.message ? `\n${rec.message}` : '',
    `\nReceived ${new Date(rec.at).toLocaleString('en-US', { timeZone: 'America/New_York' })} (Eastern)`,
    siteUrl ? `Open the inbox: ${siteUrl}/ops#inbox` : '',
  ].filter(Boolean);
  return { subject: `${kind} — ${rec.name}`, text: lines.join('\n'), replyTo: isAddr(rec.contact) ? rec.contact : '' };
}
