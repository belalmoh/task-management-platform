import express, { Router } from "express";
import dotenv from "dotenv";
import { errorHandler, AppError, catchAsync } from './middleware/errorHandler';
import { db } from './database/connection';
import { redis } from './database/redis';

import { authenticate } from "./middleware/auth";
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import './websocket/server';
import { Project } from "./models/ProjectModel";

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
apiRouter.use(`/tasks`, taskRoutes);

apiRouter.post('/test-project', authenticate, catchAsync(async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        throw new AppError('Project name is required', 400);
    }

    const project = await Project.create({
        name,
        description,
        owner_id: req.user!.id  // Uses the authenticated user's ID
    });

    res.status(201).json({
        status: 'success',
        message: 'Project created successfully',
        data: project
    });
}));

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
    // console.log(`📚 API Docs: http://localhost:${PORT}/api/${API_VERSION}`);
    console.log(`🔌 WebSocket: ws://localhost:3001/ws`);
});