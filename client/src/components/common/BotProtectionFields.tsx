import React from 'react';
import HoneypotField from './HoneypotField';
import TurnstileWidget from './TurnstileWidget';
import type { BotProtection } from '../../hooks/useBotProtection';

interface BotProtectionFieldsProps {
    bot: BotProtection;
    action?: string;
    className?: string;
    /** Set false for signed-in users: the API only demands Turnstile from guests. */
    captcha?: boolean;
}

/** Honeypot + Turnstile widget wired to a `useBotProtection()` instance. */
const BotProtectionFields: React.FC<BotProtectionFieldsProps> = ({ bot, action, className, captcha = true }) => (
    <>
        <HoneypotField value={bot.honeypot} onChange={bot.setHoneypot} />
        {captcha && (
            <TurnstileWidget onToken={bot.setTurnstileToken} resetSignal={bot.resetSignal} action={action} className={className} />
        )}
    </>
);

export default BotProtectionFields;
