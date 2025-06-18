import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/UserModel';

export interface JWTPayload {
    user_id: number;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

const jwtConfig = {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '7d',
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']) || '30d'
}

export class JWTService {
    static generateAccessToken(user: User): string {
        const payload = {
            user_id: user.id,
            email: user.email,
            role: user.role,
        };

        return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    }

    static generateRefreshToken(user: User): string {
        const payload = {
            user_id: user.id
        };

        return jwt.sign(payload, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
    }

    static generateTokenPair(user: User): TokenPair {
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);

        const expiresIn = 7 * 24 * 60 * 60;

        return {
            accessToken,
            refreshToken,
            expiresIn
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

    static extractTokenFromHeader(authHeader: string): string | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        return authHeader.split(' ')[1];
    }
}