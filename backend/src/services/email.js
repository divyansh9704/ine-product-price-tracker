// backend/src/services/email.js
// Optional Bonus Feature: Dispatches email alerts via SendGrid API using native fetch.
// Requires SENDGRID_API_KEY and ALERT_EMAIL_TO in environment variables.

import config from '../config.js';

export async function sendEmailAlert(alert) {
  const { apiKey, to } = config.email;

  if (!apiKey || !to) {
    return { skipped: true, reason: 'SendGrid credentials not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'alerts@pricetracker.dev', name: 'Product Price Tracker' },
        subject: `[Price Tracker Alert] ${alert.type.replace('_', ' ').toUpperCase()}`,
        content: [
          {
            type: 'text/html',
            value: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
                <h2 style="color: #1e293b; margin-top: 0;">Product Price Tracker Alert</h2>
                <p style="font-size: 14px; color: #475569;">
                  <strong>Alert Type:</strong> <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${alert.type}</span>
                </p>
                <p style="font-size: 15px; color: #0f172a; background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                  ${alert.message}
                </p>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
                  Generated at: ${new Date().toUTCString()}<br/>
                  Target Store: https://demo.inelabteamdev.com
                </p>
              </div>
            `
          }
        ]
      })
    });

    return { ok: response.ok, status: response.status };
  } catch (err) {
    console.warn(`[SendGrid] Optional email alert skipped: ${err.message}`);
    return { ok: false, error: err.message };
  }
}
