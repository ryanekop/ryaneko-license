const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export type NotificationType = 'purchase' | 'activation' | 'alert' | 'info';

const EMOJI_MAP: Record<NotificationType, string> = {
    purchase: '💰',
    activation: '✅',
    alert: '🚨',
    info: 'ℹ️',
};

export function escapeTelegramHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function sendTelegramNotification(
    type: NotificationType,
    message: string
): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials not configured');
        return false;
    }

    const emoji = EMOJI_MAP[type] || 'ℹ️';
    const fullMessage = `${emoji} ${message}`;

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: fullMessage,
                    parse_mode: 'HTML',
                }),
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Telegram API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorBody,
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to send Telegram notification:', error);
        return false;
    }
}

// Shorthand functions
export const notifyPurchase = (msg: string) => sendTelegramNotification('purchase', msg);
export const notifyActivation = (msg: string) => sendTelegramNotification('activation', msg);
export const notifyAlert = (msg: string) => sendTelegramNotification('alert', msg);
export const notifyInfo = (msg: string) => sendTelegramNotification('info', msg);
