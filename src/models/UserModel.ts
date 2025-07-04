import { db } from '../database/connection';
import { hashPassword, verifyPassword } from '../utils';

export interface IUser {
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

export class User {
	static async create(userData: any): Promise<IUser> {
		const {email, first_name, last_name, password} = userData;
		
		const hashedPassword = await hashPassword(password);
		const [user] = await db('users')
			.insert({email, first_name, last_name, password_hash: hashedPassword})
			.returning('*');

		return user;
	}

	static async findByEmail(email: string): Promise<IUser | null> {
		const user = await db('users')
			.where({ email, is_active: true })
			.first();

		return user || null;
	}

	static async authenticate(email: string, password: string): Promise<IUser | null> {
		const user = await this.findByEmail(email);
		if (!user) return null;
		const isValid = await verifyPassword(password, user.password_hash);
		return isValid ? user : null;
	}

	static async findById(id: number): Promise<IUser | null> {
		const user = await db('users')
			.where({ id, is_active: true })
			.first();

		return user || null;
	}

	static async findAll(): Promise<{ users: IUser[]; total: number }> {
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

	static async sanitizeUser(user: IUser): Promise<Omit<IUser, 'password_hash'>> {
		const { password_hash, ...userWithoutPassword } = user;
		return userWithoutPassword;
	}
}