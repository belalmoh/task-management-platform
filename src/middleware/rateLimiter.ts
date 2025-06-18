import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { redis } from '../database/redis';

const attempts = new Map<string, { count: number, timestamp: number }>();

export const authRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ip = req.ip;
        const windowSeconds = 15 * 60; // 15 minutes
        const maxAttempts = 15;
        const key = `auth_rate_limit:${ip}`;

        // Use Redis rate limiting
        const result = await redis.incrementRateLimit(key, windowSeconds);

        // Set rate limit headers
        res.set({
            'X-RateLimit-Limit': maxAttempts.toString(),
            'X-RateLimit-Remaining': Math.max(0, maxAttempts - result.count).toString(),
            'X-RateLimit-Reset': new Date(Date.now() + (result.ttl * 1000)).toISOString(),
        });

        // Check if limit exceeded
        if (result.count > maxAttempts) {
            const timeLeft = Math.ceil(result.ttl / 60); // Convert to minutes
            throw new AppError(`Too many authentication attempts. Try again in ${timeLeft} minutes`, 429);
        }

        // Important: Only call next() if we haven't thrown an error
        next();
    } catch (error) {
        // Important: Pass error to next() instead of throwing
        next(error);
    }
};

export const basicRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ip = req.ip;
        const windowSeconds = 15 * 60; // 15 minutes
        const maxAttempts = 100;
        const key = `api_rate_limit:${ip}`;

        const result = await redis.incrementRateLimit(key, windowSeconds);

        res.set({
            'X-RateLimit-Limit': maxAttempts.toString(),
            'X-RateLimit-Remaining': Math.max(0, maxAttempts - result.count).toString(),
            'X-RateLimit-Reset': new Date(Date.now() + (result.ttl * 1000)).toISOString(),
        });

        if (result.count > maxAttempts) {
            const timeLeft = Math.ceil(result.ttl / 60);
            throw new AppError(`Too many requests. Try again in ${timeLeft} minutes`, 429);
        }

        next();
    } catch (error) {
        next(error);
    }
};
