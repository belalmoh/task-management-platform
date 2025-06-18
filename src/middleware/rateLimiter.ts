import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

const attempts = new Map<string, {count: number, timestamp: number}>();

export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    const resetTime = now + windowMs;

    if(!attempts.has(ip as string)) {
        attempts.set(ip as string, {count: 1, timestamp: now});
        next();
    }

    const userAttempts = attempts.get(ip as string)!;

    if(now > userAttempts.timestamp + windowMs) {
        attempts.set(ip as string, {count: 1, timestamp: now});
        next();
    }

    if(userAttempts.count >= maxAttempts) {
        const timeRemaining = Math.ceil((userAttempts.timestamp + windowMs - now) / 1000);
        throw new AppError(`Too many attempts, please try again in ${timeRemaining} seconds`, 429);
    }

    userAttempts.count++;
    next();
}

export const basicRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    next();
}