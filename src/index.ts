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

// app.use((req, res, next) => {
//     const originalSend = res.send;
//     const originalJson = res.json;
//     let responseSent = false;

//     res.send = function (body) {
//         if (responseSent) {
//             console.error('🚨 DUPLICATE RESPONSE DETECTED!', {
//                 url: req.originalUrl,
//                 method: req.method,
//                 body: body
//             });
//             return this;
//         }
//         responseSent = true;
//         return originalSend.call(this, body);
//     };

//     res.json = function (body) {
//         if (responseSent) {
//             console.error('🚨 DUPLICATE JSON RESPONSE DETECTED!', {
//                 url: req.originalUrl,
//                 method: req.method,
//                 body: body
//             });
//             return this;
//         }
//         responseSent = true;
//         return originalJson.call(this, body);
//     };

//     next();
// });

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