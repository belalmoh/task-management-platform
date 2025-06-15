// src/models/UserModel.ts
import { db } from '../database/connection';

export interface User {
	id: number;
	email: string;
	password_hash: string;
	first_name: string;
	last_name: string;
	avatar_url?: string;
	role: 'admin' | 'manager' | 'member';
	is_active: boolean;
	last_login?: Date;
	created_at: Date;
	updated_at: Date;
}

export class UserModel {
	// Add explicit type annotations
	static async create(userData: {
		email: string;
		password_hash: string;
		first_name: string;
		last_name: string;
		role?: 'admin' | 'manager' | 'member';
	}): Promise<User> {
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

	static async findAll(options: {
		page?: number;
		limit?: number;
		role?: string;
	} = {}): Promise<{ users: User[]; total: number }> {
		const { page = 1, limit = 10, role } = options;
		const offset = (page - 1) * limit;

		let query = db('users').where({ is_active: true });

		if (role) {
			query = query.where({ role });
		}

		// Get total count
		const totalResult = await query.clone().count('id as count').first();
		const total = parseInt(totalResult?.count as string) || 0;

		// Get paginated results
		const users = await query
			.select('*')
			.orderBy('created_at', 'desc')
			.limit(limit)
			.offset(offset);

		return { users, total };
	}

	static async emailExists(email: string, excludeId?: number): Promise<boolean> {
		let query = db('users').where({ email });

		if (excludeId) {
			query = query.whereNot({ id: excludeId });
		}

		const user = await query.first();
		return !!user;
	}
}