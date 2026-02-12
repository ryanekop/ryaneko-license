// Resend email client for sending license emails

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.LICENSE_FROM_EMAIL || 'license@ryanekoapp.web.id';
const FROM_NAME = process.env.LICENSE_FROM_NAME || 'Ryan Eko App';

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!RESEND_API_KEY) {
        console.warn('[Resend] API key not configured, skipping email');
        return { success: false, error: 'RESEND_API_KEY not set' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: [to],
                subject,
                html,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[Resend] API error:', result);
            return { success: false, error: result.message || 'Resend API error' };
        }

        console.log(`[Resend] ✅ Email sent to ${to}, id: ${result.id}`);
        return { success: true, id: result.id };

    } catch (err: any) {
        console.error('[Resend] Send error:', err);
        return { success: false, error: err.message };
    }
}
