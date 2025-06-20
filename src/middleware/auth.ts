import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../utils/jwt';
import { User, IUser } from '../models/UserModel';
import { AppError, catchAsync } from './errorHandler';
import { redis } from '../database/redis';

declare global {
    namespace Express {
        interface Request {
            user?: Omit<IUser, 'password_hash'>;
            sessionId?: string;
        }
    }
}

export const authenticate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = JWTService.extractTokenFromHeader(req.headers.authorization);
    if (!token) {
        throw new AppError('Authentication token is required', 401);
    }

    const isBlacklisted = await JWTService.isTokenBlacklisted(token);
    if(isBlacklisted) {
        throw new AppError('Token has been revoked', 401);
    }

    try {
        const decoded = JWTService.verifyAccessToken(token);

        const sessionData = await redis.getSession(decoded.session_id);
        if(!sessionData) {
            throw new AppError('Session is invalid or expired', 401);
        }

        const user = await User.findById(decoded.user_id);
        if(!user) {
            throw new AppError('User not found or inactive', 401);
        }

        await JWTService.updateSessionActivity(decoded.session_id);


        req.user = await User.sanitizeUser(user);
        req.sessionId = decoded.session_id;

        next();
    } catch (error) {
        if (error instanceof AppError) {
            throw new AppError(error.message, 401);
        }

        throw new AppError('Authentication failed', 401);
    }
});

export const optionalAuthenticate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = JWTService.extractTokenFromHeader(req.headers.authorization);
    
    if(token) {
        try {
            const isBlacklisted = await JWTService.isTokenBlacklisted(token);
            if(!isBlacklisted) {
                const decoded = JWTService.verifyAccessToken(token);
                const sessionData = await redis.getSession(decoded.session_id);
                
                if(sessionData) {
                    const user = await User.findById(decoded.user_id);
                    if(user) {
                        req.user = await User.sanitizeUser(user);
                        req.sessionId = decoded.session_id;
                        await JWTService.updateSessionActivity(decoded.session_id);
                    }
                }
            }
        } catch (error) {
            throw new AppError('Optional Authentication failed', 401);
        }
    }
    next();
});