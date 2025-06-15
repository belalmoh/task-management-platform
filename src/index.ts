import express from "express";
import dotenv from "dotenv";
import { errorHandler, AppError, catchAsync } from './middleware/errorHandler';
import { schemas, validate } from "./middleware/validation";
import { db } from './database/connection';

import { UserModel } from './models/UserModel';

const app = express();

dotenv.config();

const PORT = process.env.PORT || 3000;

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
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
                database: {
                    status: 'connected',
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
              database: 'disconnected'
            }
        });
    }
}));

// ------------------------------------------------------------

app.post('/test-register', validate(schemas.userRegistration), (req, res) => {
    res.json({
        message: 'Validation successful',
        user: req.body
    });
});

app.post('/test-login', validate(schemas.userLogin), (req, res) => {
    res.json({
        message: 'Validation successful',
        user: req.body
    });
});

app.get('/test-users', catchAsync(async (req, res) => {
    // Get all users
    const result = await UserModel.findAll();
    
    res.json({
        message: 'Users retrieved successfully',
        data: result,
        total_users: result.total
    });
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