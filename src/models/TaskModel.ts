import { db } from '../database/connection';

export interface ITask {
    id: number;
    title: string;
    description?: string;
    project_id: number;
    assignee_id?: number;
    creator_id: number;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: Date;
    estimated_hours?: number;
    actual_hours?: number;
    tags?: string[];
    created_at: Date;
    updated_at: Date;
}

export class Task {
    static async create(taskData: Partial<ITask>): Promise<ITask> {
        const { title, description, project_id, assignee_id, creator_id, status, priority, due_date, estimated_hours, actual_hours, tags } = taskData;

        const [task] = await db('tasks')
            .insert({ title, description, project_id, assignee_id, creator_id, status, priority, due_date, estimated_hours, actual_hours, tags })
            .returning('*');

        return task;
    }

    static async findById(id: number): Promise<ITask | null> {
        const task = await db('tasks')
            .where({ id })
            .first();

        return task || null;
    }

    static async findByProjectId(project_id: number): Promise<ITask[]> {
        const tasks = await db('tasks')
            .where({ project_id })
            .select('*');

        return tasks;
    }

    static async findByAssigneeId(assignee_id: number): Promise<ITask[]> {
        const tasks = await db('tasks')
            .where({ assignee_id })
            .select('*');

        return tasks;
    }

    static async update(id: number, updateData: Partial<Task>): Promise<ITask | null> {
        const [task] = await db('tasks')
            .where({ id })
            .update({
                ...updateData,
                updated_at: new Date()
            })
            .returning('*');

        return task || null;
    }

    static async delete(id: number): Promise<boolean> {
        const result = await db('tasks').where({ id }).del();
        
        return result > 0;
    }
}