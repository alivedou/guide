/**
 * 邮件派发。不依赖 Node/Worker 运行时模块；密钥由调用方传入。
 *
 * @param {string} recipient
 * @param {string} subject
 * @param {string} content
 * @param {{
 *   fetch?: typeof fetch,
 *   resendApiKey?: string,
 *   emailFrom?: string,
 *   mockIfMissing?: boolean
 * }} [opts]
 */
export async function sendEmailHelper(recipient, subject, content, opts = {}) {
  const fetchFn = opts.fetch || globalThis.fetch;
  const apiKey = opts.resendApiKey;
  const from = opts.emailFrom || 'CloudNav Alerts <alerts@cloudnav.tech>';

  if (apiKey) {
    try {
      await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: recipient,
          subject,
          text: content
        })
      });
    } catch (e) {
      console.error('[Email] Resend send failed:', e);
    }
    return;
  }

  if (opts.mockIfMissing) {
    console.log(
      `[Email Mock] Target: ${recipient} | Subject: ${subject} | Content length: ${content.length}`
    );
  }
}
