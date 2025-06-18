import { Router } from 'express';
import { validate, schemas } from '../middleware/validation';
import { authRateLimiter } from '../middleware/rateLimiter';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { UserModel } from '../models/UserModel';
import { JWTService } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { redis } from '../database/redis';

const router = Router();

router.post('/register', authRateLimiter, validate(schemas.userRegistration), catchAsync(async (req, res) => {
    const { email, password, first_name, last_name } = req.body;

    const existingUser = await UserModel.findByEmail(email);

    if(existingUser) {
        throw new AppError('User with this email already exists', 400);
    }

    const user = await UserModel.create({
        email,
        password,
        first_name,
        last_name
    });

    const tokenPair = await JWTService.generateTokenPair(user);

    const sanitizedUser = await UserModel.sanitizeUser(user);

    res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
            user: sanitizedUser,
            ...tokenPair
        }
    });
}));

router.post('/login', authRateLimiter,validate(schemas.userLogin), catchAsync(async (req, res) => {
    const { email, password } = req.body;

    const user = await UserModel.authenticate(email, password);

    if(!user) {
        throw new AppError('Invalid credentials', 401);
    }

    const tokenPair = await JWTService.generateTokenPair(user);

    const sanitizedUser = await UserModel.sanitizeUser(user);

    res.json({
        status: 'success',
        message: 'Login successful',
        data: {
            user: sanitizedUser,
            ...tokenPair
        }
    });
}));

router.post('/refresh', authRateLimiter, catchAsync(async (req, res) => {
    const { refreshToken } = req.body;

    if(!refreshToken) {
        throw new AppError('Refresh token is required', 400);
    }

    try {
        const decoded = JWTService.verifyRefreshToken(refreshToken);
        const sessionData = await redis.getSession(decoded.session_id);
        if(!sessionData) {
            throw new AppError('Session is invalid or expired', 401);
        }

        const user = await UserModel.findById(decoded.user_id);

        if(!user) {
            throw new AppError('User not found', 401);
        }

        const tokenPair = await JWTService.generateTokenPair(user);

        await JWTService.invalidateSession(decoded.session_id, decoded.user_id);

        const sanitizedUser = await UserModel.sanitizeUser(user);

        res.json({
            status: 'success',
            message: 'Token refreshed successfully',
            data: {
                user: sanitizedUser,
                ...tokenPair
            }
        });
    } catch (error) {
        throw new AppError('Invalid refresh token', 401);
    }
}));

router.post('/verify', catchAsync(async (req, res) => {
    const { token } = req.body;

    if(!token) {
        throw new AppError('Token is required', 400);
    }

    try {
        const decoded = JWTService.verifyAccessToken(token);
        const user = await UserModel.findById(decoded.user_id);

        if(!user) {
            throw new AppError('User not found', 401);
        }

        const sanitizedUser = await UserModel.sanitizeUser(user);
        res.json({
            status: 'success',
            message: 'Token is valid',
            data: {
                user: sanitizedUser,
                token_info: {
                    user_id: decoded.user_id,
                    email: decoded.email,
                    role: decoded.role,
                    issued_at: new Date(decoded.iat * 1000).toISOString(),
                    expires_at: new Date(decoded.exp * 1000).toISOString()
                }
            }
        });
    } catch (error) {
        if(error instanceof Error) {
            throw new AppError(error.message, 401);
        }

        throw new AppError('Invalid token', 401);
    }
}));

router.post('/logout', catchAsync(async (req, res) => {
    
    const token = JWTService.extractTokenFromHeader(req.headers.authorization);

    if(token) {
        try {
            const decoded = JWTService.verifyAccessToken(token);
            await JWTService.blacklistToken(token);
            await JWTService.invalidateSession(decoded.session_id, decoded.user_id);
        } catch (error) {
            throw new AppError('Logout token verification failed', 401);
        }
    }

    res.json({
        status: 'success',
        message: 'Logged out successfully'
    });
}));

router.post('/logout-all', authenticate, catchAsync(async (req, res) => {
    const userId = req.user?.id;

    await JWTService.invalidateAllUserSessions(userId);

    res.json({
        status: 'success',
        message: 'Logged out from all devices successfully'
    });
}));

export default router;