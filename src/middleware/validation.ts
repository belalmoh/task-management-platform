import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ValidationError } from "./errorHandler";

export const validate = (schema: Joi.Schema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all errors instead of stopping at the first one
            stripUnknown: true, // Remove unknown properties from the validated data
        });

        if (error) {
            const validationErrors = error.details.map((detail: any) => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value,
            }));

            const validationError = new ValidationError('Validation failed', validationErrors);
            return next(validationError);
        }

        req.body = value;
        next();
    };
}

export const schemas = {
    userRegistration: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
        password: Joi.string()
            .min(8)
            .max(128)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.max': 'Password must be less than 128 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                'any.required': 'Password is required'
            }),
        first_name: Joi.string().min(2).max(50).required().messages({
            'string.min': 'First name must be at least 2 characters long',
            'string.max': 'First name must be less than 50 characters',
            'any.required': 'First name is required'
        }),
        last_name: Joi.string().min(2).max(50).required().messages({
            'string.min': 'Last name must be at least 2 characters long',
            'string.max': 'Last name must be less than 50 characters',
            'any.required': 'Last name is required'
        })
    }),

    userLogin: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    })
}