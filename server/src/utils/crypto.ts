import crypto from 'crypto';

const ENCRYPTION_KEY_RAW = process.env.TOKEN_ENCRYPTION_KEY;

const getKey = () => {
    if (!ENCRYPTION_KEY_RAW) {
        throw new Error('TOKEN_ENCRYPTION_KEY is not set');
    }
    // Derive a 32-byte key from the configured secret.
    return crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();
};

export const encryptString = (plaintext: string): string => {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintext, 'utf8')),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Format: base64(iv).base64(tag).base64(ciphertext)
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
};

export const decryptString = (encoded: string): string => {
    const key = getKey();
    const [ivB64, tagB64, dataB64] = encoded.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
};

const FIELD_PREFIX = 'enc:v1:';

/** Encrypt a sensitive column value (bank / payout details) for storage; null stays null. */
export const encryptField = (value: string | null): string | null =>
    value === null ? null : `${FIELD_PREFIX}${encryptString(value)}`;

/**
 * Decrypt a value written by encryptField. Values stored before encryption existed are returned
 * as-is; a value that can't be decrypted (wrong key, corrupted) is logged and treated as missing
 * so one bad row doesn't break whole lists.
 */
export const decryptField = (value: string | null): string | null => {
    if (value === null || !value.startsWith(FIELD_PREFIX)) return value;
    try {
        return decryptString(value.slice(FIELD_PREFIX.length));
    } catch (err) {
        console.error('[crypto] Could not decrypt a stored field:', (err as Error).message);
        return null;
    }
};
