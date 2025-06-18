import express, { Router } from "express";
import dotenv from "dotenv";
import { errorHandler, AppError, catchAsync } from './middleware/errorHandler';
import { schemas, validate } from "./middleware/validation";
import { db } from './database/connection';
import { redis } from './database/redis';

import { UserModel } from './models/UserModel';
import { JWTService } from "./utils/jwt";
import { authenticate } from "./middleware/auth";
import authRoutes from './routes/auth';

const app = express();

dotenv.config();

const PORT = process.env.PORT || 3000;
const API_VERSION = 'v1';
const apiRouter = Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.json({
        message: 'Task Management API is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', catchAsync(async (req, res, next) => {
    try {
        await db.raw('SELECT 1');
        const redisHealthy = await redis.ping();
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
                database: {
                    status: 'connected',
                },
                redis: {
                    status: redisHealthy ? 'connected' : 'disconnected'
                }
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
              database: 'disconnected',
              redis: 'disconnected'
            }
        });
    }
}));

apiRouter.use(`/auth`, authRoutes);
apiRouter.get(`/me`, authenticate, (req, res) => {
    res.json({
        message: 'User retrieved successfully',
        user: req.user
    });
});

app.use(`/api/${API_VERSION}`, apiRouter);

// ------------------------------------------------------------

app.get('/test-users', catchAsync(async (req, res) => {
    // Get all users
    const result = await UserModel.findAll();
    
    res.json({
        message: 'Users retrieved successfully',
        data: result,
        total_users: result.total
    });
}));

app.post('/test-create-user', catchAsync(async (req, res) => {
    const {email, first_name, last_name, password} = req.body;

    if (!email || !first_name || !last_name || !password) {
        throw new AppError('Email, first_name, last_name, and password are required', 400);
    }

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
        throw new AppError('User with this email already exists', 409);
    }

    const user = await UserModel.create({email, first_name, last_name, password});

    const sanitizedUser = await UserModel.sanitizeUser(user);

    res.json({
        message: 'User created successfully',
        data: sanitizedUser
    });
}));

app.post('/test-login', catchAsync(async (req, res) => {
    const {email, password} = req.body;

    if (!email || !password) {
        throw new AppError('Email and password are required', 400);
    }

    const user = await UserModel.authenticate(email, password);
    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    const tokenPair = JWTService.generateTokenPair(user);

    const sanitizedUser = await UserModel.sanitizeUser(user);

    res.json({
        message: 'Login successful',
        data: sanitizedUser,
        ...tokenPair
    });
}));

app.get('/test-protected', authenticate, (req, res) => {
    res.json({
        message: 'This is a protected route',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

app.post('/test-verify-token', catchAsync(async (req, res) => {
    const {token} = req.body;

    if(!token) {
        throw new AppError('Token is required', 400);
    }

    try {
        const decoded = JWTService.verifyAccessToken(token);
        res.json({
            message: 'Token verified successfully',
            data: {
                user_id: decoded.user_id,
                email: decoded.email,
                role: decoded.role,
                expires_at: new Date(decoded.exp * 1000).toISOString()
            },
        });
    } catch (error) {
        throw new AppError('Invalid token', 401);
    }
}));
// ------------------------------------------------------------

app.get('*', (req, res, next) => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
});