import { db } from '../database/connection';

export interface IProject {
    id: number;
    name: string;
    description?: string;
    owner_id: number;
    status: 'active' | 'inactive' | 'completed';
    settings?: any;
    created_at: Date;
    updated_at: Date;
}

export class Project {
    static async create(projectData: Partial<IProject>): Promise<IProject> {
        const { name, description, owner_id, settings } = projectData;

        const [project] = await db('projects')
            .insert({ name, description, owner_id, settings })
            .returning('*');

        return project;
    }

    static async findById(id: number): Promise<IProject | null> {
        const project = await db('projects')
            .where({ id })
            .first();

        return project || null;
    }

    static async findByOwnerId(owner_id: number): Promise<IProject[]> {
        const projects = await db('projects')
            .where({ owner_id })
            .select('*');

        return projects;
    }

    static async findAll(): Promise<IProject[]> {
        const projects = await db('projects')
            .select('*');

        return projects;
    }
}