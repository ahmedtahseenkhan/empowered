import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Without JWT_SECRET (blocked in production by index.ts) use a per-process random secret,
// so a development server never accepts tokens forged with a value from the source code.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const JWT_ISSUER = 'empoweredlearnings-api';
const JWT_AUDIENCE = 'empoweredlearnings-app';
const BCRYPT_COST = 12;

/** Access token lifetime; also the idle timeout because active sessions are renewed. */
export const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;
/** A session can be renewed up to this long after the user signed in, then they must log in again. */
export const SESSION_ABSOLUTE_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Renew the cookie once a token is older than this. */
export const TOKEN_RENEW_AFTER_SECONDS = 60 * 60;

export interface AccessTokenPayload {
    id: string;
    role: string;
    /** User.token_version at issue time */
    tv: number;
    /** When the user originally signed in (unix seconds) */
    auth_time: number;
    /** Session id: stays the same across renewals, revoked on logout */
    sid: string;
    iat: number;
    exp: number;
}

export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(BCRYPT_COST);
    return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

// Compared against when no account matches, so a missing account takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-password', BCRYPT_COST);
export const compareDummyPassword = async (password: string): Promise<void> => {
    await bcrypt.compare(password, DUMMY_HASH);
};

export const generateToken = (
    userId: string,
    role: string,
    tokenVersion: number,
    session?: { authTime: number; sid: string },
): string => {
    const authTime = session?.authTime ?? Math.floor(Date.now() / 1000);
    const sid = session?.sid ?? crypto.randomBytes(16).toString('hex');
    return jwt.sign({ id: userId, role, tv: tokenVersion, auth_time: authTime, sid, typ: 'access' }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        subject: userId,
    });
};

/** Returns the payload of a valid access token, or null. Algorithm, issuer and audience are pinned. */
export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }) as jwt.JwtPayload;
        if (decoded.typ !== 'access' || typeof decoded.id !== 'string' || typeof decoded.tv !== 'number' || typeof decoded.sid !== 'string') return null;
        return decoded as unknown as AccessTokenPayload;
    } catch {
        return null;
    }
};

/** Random 6-digit code for email verification and password reset. */
export const generateNumericCode = (): string => crypto.randomInt(0, 1000000).toString().padStart(6, '0');
