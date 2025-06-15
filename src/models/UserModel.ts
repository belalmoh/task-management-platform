// src/models/UserModel.ts
import { db } from '../database/connection';

export interface User {
	id: number;
	email: string;
	password_hash: string;
	first_name: string;
	last_name: string;
	avatar_url?: string;
	role: string;
	is_active: boolean;
	last_login?: Date;
	created_at: Date;
	updated_at: Date;
}

export class UserModel {
	static async create(userData: any): Promise<User> {
		const [user] = await db('users')
			.insert(userData)
			.returning('*');

		return user;
	}

	static async findByEmail(email: string): Promise<User | null> {
		const user = await db('users')
			.where({ email, is_active: true })
			.first();

		return user || null;
	}

	static async findById(id: number): Promise<User | null> {
		const user = await db('users')
			.where({ id, is_active: true })
			.first();

		return user || null;
	}

	static async findAll(): Promise<{ users: User[]; total: number }> {
		const users = await db('users')
			.where({ is_active: true })
			.select('*')
			.orderBy('created_at', 'desc')
			.limit(10);

		return { users, total: users.length };
	}

	static async emailExists(email: string): Promise<boolean> {
		const user = await db('users').where({ email }).first();
		return !!user;
	}
}