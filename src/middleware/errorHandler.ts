import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    public validationErrors: any;
  
    constructor(message: string, validationErrors: any) {
        super(message, 400);
        this.validationErrors = validationErrors;
    }
}

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let error = { ...err };
    error.message = err.message;

    // console.error("Error occurred:", {
    //     message: err.message,
    //     stack: err.stack,
    //     url: req.originalUrl,
    //     method: req.method,
    // });

    let message = "Internal Server Error";
    let statusCode = 500;
    let validationErrors: any[] = [];

    if (err instanceof AppError) {
        message = err.message;
        statusCode = err.statusCode;
    }

    if (err instanceof ValidationError) {
        message = err.message;
        statusCode = err.statusCode;
        validationErrors = err.validationErrors;
    }

    res.status(statusCode).json({
        status: "error",
        message: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        ...(validationErrors.length > 0 && { validationErrors })
    });
};

export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    }
}