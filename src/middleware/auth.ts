import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../utils/jwt';
import { UserModel, User } from '../models/UserModel';
import { AppError, catchAsync } from './errorHandler';

declare global {
    namespace Express {
        interface Request {
            user?: Omit<User, 'password_hash'>;
        }
    }
}

export const authenticate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = JWTService.extractTokenFromHeader(req.headers.authorization);
    if (!token) {
        throw new AppError('Authentication token is required', 401);
    }

    try {
        const decoded = JWTService.verifyAccessToken(token);
        const user = await UserModel.findById(decoded.user_id);
        if(!user) {
            throw new AppError('User not found or inactive', 401);
        }

        req.user = await UserModel.sanitizeUser(user);
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
            const decoded = JWTService.verifyAccessToken(token);
            const user = await UserModel.findById(decoded.user_id);
            if(user) {
                req.user = await UserModel.sanitizeUser(user);
            }
        } catch (error) {
            throw new AppError('Optional Authentication failed', 401);
        }
    }
    next();
});