import { Router } from "express";
import { validate, schemas } from "../middleware/validation";
import { catchAsync, AppError } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth";
import { Task } from "../models/TaskModel";
import { Project } from "../models/ProjectModel";
import { webSocketManager } from "../websocket/server";
import Joi from "joi";

const router = Router();

const taskSchemas = {
    createTask: Joi.object({
        title: Joi.string().min(1).max(200).required(),
        description: Joi.string().max(2000).optional(),
        project_id: Joi.number().integer().positive().required(),
        assignee_id: Joi.number().integer().positive().optional(),
        status: Joi.string().valid('todo', 'in_progress', 'review', 'done').default('todo'),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
        due_date: Joi.date().iso().optional(),
        estimated_hours: Joi.number().positive().optional(),
        actual_hours: Joi.number().positive().optional(),
        tags: Joi.array().items(Joi.string().max(50)).optional()
    }),

    updateTask: Joi.object({
        title: Joi.string().min(1).max(200).optional(),
        description: Joi.string().max(2000).optional(),
        project_id: Joi.number().integer().positive().required(),
        assignee_id: Joi.number().integer().positive().allow(null).optional(),
        status: Joi.string().valid('todo', 'in_progress', 'review', 'done').optional(),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
        due_date: Joi.date().iso().allow(null).optional(),
        estimated_hours: Joi.number().positive().allow(null).optional(),
        actual_hours: Joi.number().positive().allow(null).optional(),
        tags: Joi.array().items(Joi.string().max(50)).optional()
    })
};

router.get('/', authenticate, catchAsync(async (req, res) => {
    const { project_id, status, assignee_id, priority } = req.query;

    let tasks;

    if(project_id) {
        tasks = await Task.findByProjectId(parseInt(project_id as string));
    } else if(assignee_id) {
        tasks = await Task.findByAssigneeId(parseInt(assignee_id as string));
    } else {
        tasks = await Task.findByAssigneeId(req.user!.id);
    }

    if(status) {
        tasks = tasks.filter((task) => task.status === status);
    }

    if(priority) {
        tasks = tasks.filter((task) => task.priority === priority);
    }

    res.json({
        status: 'success',
        data: {
            tasks,
            count: tasks.length
        }
    })
}));

router.get('/:id', authenticate, catchAsync(async (req, res) => {
    const taskId = parseInt(req.params.id);
    if(isNaN(taskId)) {
        throw new AppError('Task not found', 404);
    }

    const task = await Task.findById(taskId);
    if(!task) {
        throw new AppError('Task not found', 404);
    }

    res.json({
        status: 'success',
        data: {
            task
        }
    });
}));

router.post('/', authenticate, validate(taskSchemas.createTask), catchAsync(async (req, res) => {
    const { project_id, ...taskData } = req.body;

    const project = await Project.findById(project_id);
    if(!project) {
        throw new AppError('Project not found', 404);
    }

    const task = await Task.create({
        ...taskData,
        project_id,
        creator_id: req.user!.id
    });

    await webSocketManager.broadcastToProject(project_id, {
        type: 'task_created',
        payload: {
            task,
            created_by: req.user!.id
        },
        timestamp: new Date().toISOString()
    });

    console.log(`📝 Task created: ${task.title} in project ${project_id} by user ${req.user!.id}`);

    res.status(201).json({
        status: 'success',
        message: 'Task created successfully',
        data: {
            task
        }
    });
    
}));

router.put('/:id', authenticate, validate(taskSchemas.updateTask), catchAsync(async (req, res) => {
    const taskId = parseInt(req.params.id);
    if(isNaN(taskId)) {
        throw new AppError('Invalid task ID', 400);
    }

    const task = await Task.findById(taskId);
    if(!task) {
        throw new AppError('Task not found', 404);
    }

    const updatedTask = await Task.update(taskId, {
        ...req.body,
        updated_at: new Date()
    });

    if(!updatedTask) {
        throw new AppError('Failed to update task', 500);
    }

    const changes: Record<string, { old_value: any; new_value: any }> = {};
    for (const [key, newValue] of Object.entries(req.body)) {
        const oldValue = (task as any)[key];
        if (oldValue !== newValue) {
            changes[key] = { old_value: oldValue, new_value: newValue };
        }
    }

    await webSocketManager.broadcastToProject(task.project_id, {
        type: 'task_updated',
        payload: {
            task: updatedTask,
            changes,
            updated_by: req.user!.id
        },
        timestamp: new Date().toISOString()
    });

    console.log(`📝 Task updated: ${updatedTask.title} in project ${task.project_id} by user ${req.user!.id}`);

    res.json({
        status: 'success',
        message: 'Task updated successfully',
        data: {
            task: updatedTask,
            changes
        }
    });
}));

router.delete('/:id', authenticate, catchAsync(async (req, res) => {
    const taskId = parseInt(req.params.id);
    if(isNaN(taskId)) {
        throw new AppError('Invalid task ID', 400);
    }
    
    const task = await Task.findById(taskId);
    if(!task) {
        throw new AppError('Task not found', 404);
    }

    const deletedTask = await Task.delete(taskId);
    if(!deletedTask) {
        throw new AppError('Failed to delete task', 500);
    }

    await webSocketManager.broadcastToProject(task.project_id, {
        type: 'task_deleted',
        payload: {
            task_id: taskId,
            task_title: task.title,
            project_id: task.project_id,
            deleted_by: req.user!.id
        },
        timestamp: new Date().toISOString()
    });

    console.log(`📝 Task deleted: ${task.title} in project ${task.project_id} by user ${req.user!.id}`);

    res.json({
        status: 'success',
        message: 'Task deleted successfully',
    })
}));

export default router;