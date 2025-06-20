import jwt, { SignOptions } from 'jsonwebtoken';
import { IUser } from '../models/UserModel';
import { redis } from '../database/redis';
import { randomBytes } from 'crypto';

export interface JWTPayload {
    user_id: number;
    email: string;
    role: string;
    session_id: string;
    iat: number;
    exp: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    session_id: string;
}

const jwtConfig = {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '7d',
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']) || '30d'
}

export class JWTService {

    static generateSessionId(): string {
        return randomBytes(32).toString('hex');
    }

    static generateAccessToken(user: IUser, sessionId: string): string {
        const payload = {
            user_id: user.id,
            email: user.email,
            role: user.role,
            session_id: sessionId,
        };

        return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    }

    static generateRefreshToken(user: IUser, sessionId: string): string {
        const payload = {
            user_id: user.id,
            session_id: sessionId,
        };

        return jwt.sign(payload, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
    }

    static async generateTokenPair(user: IUser): Promise<TokenPair> {
        const sessionId = this.generateSessionId();
        const accessToken = this.generateAccessToken(user, sessionId);
        const refreshToken = this.generateRefreshToken(user, sessionId);

        const sessionData = {
            user_id: user.id,
            email: user.email,
            role: user.role,
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString(),
        }

        const sessionTTL = 30 * 24 * 60 * 60;
        await redis.setSession(sessionId, sessionData, sessionTTL);
        await redis.addUserSession(String(user.id), sessionId, sessionTTL);

        const expiresIn = 7 * 24 * 60 * 60;

        return {
            accessToken,
            refreshToken,
            expiresIn,
            session_id: sessionId,
        }
    }

    static verifyAccessToken(token: string): JWTPayload | null {
        try {
            const decoded = jwt.verify(token, jwtConfig.secret) as JWTPayload;
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            
            throw new Error('Token verification failed');
        }
    }

    static verifyRefreshToken(token: string): JWTPayload | null {
        try {
            const decoded = jwt.verify(token, jwtConfig.refreshSecret) as JWTPayload;
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            
            throw new Error('Token verification failed');
        }
    }

    static async isTokenBlacklisted(token: string): Promise<boolean> {
        return await redis.isTokenBlacklisted(token);
    }

    static async blacklistToken(token: string, expiresIn?: number): Promise<boolean> {
        let ttl = expiresIn;

        if(!ttl) {
            try {
                const decoded = this.verifyRefreshToken(token);
                ttl = decoded.exp - Date.now() / 1000;
            } catch (error) {
                ttl = 24 * 60 * 60;
            }
        }

        return await redis.blacklistToken(token, ttl);
    }

    static async invalidateSession(sessionId: string, userId: number): Promise<boolean> {
        try {
            await redis.deleteSession(sessionId);
            await redis.removeUserSession(String(userId), sessionId);
            return true;
        } catch (error) {
            console.error('❌ Redis invalidateSession error:', error);
            return false;
        }
    }

    static async invalidateAllUserSessions(userId: number): Promise<boolean> {
        try {
            const sessions = await redis.getUserSessions(String(userId));
            for (const sessionId of sessions) {
                await this.invalidateSession(sessionId, userId);
            }
            await redis.clearAllUserSessions(String(userId));
            return true;
        } catch (error) {
            console.error('❌ Redis invalidateAllUserSessions error:', error);
            return false;
        }
    }

    static extractTokenFromHeader(authHeader: string): string | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        return authHeader.split(' ')[1];
    }

    static async updateSessionActivity(sessionId: string): Promise<void> {
        try {
            const sessionData = await redis.getSession(sessionId);
            if (sessionData) {
                sessionData.last_activity = new Date().toISOString();
                await redis.setSession(sessionId, sessionData, 30 * 24 * 60 * 60); // Refresh TTL
            }
        } catch (error) {
            console.error('❌ Redis updateSessionActivity error:', error);
        }
    }
}