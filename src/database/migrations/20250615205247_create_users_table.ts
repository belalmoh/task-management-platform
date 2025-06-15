import { Knex } from 'knex';

export const up = async (knex: Knex): Promise<void> => {
    await knex.schema.createTable('users', (table) => {
        table.increments('id').primary();
        
        table.string('email').notNullable().unique();
        table.string('password_hash').notNullable();

        table.string('first_name').notNullable();
        table.string('last_name').notNullable();
        table.string('avatar_url').nullable();

        table.enum('role', ['admin', 'manager', 'member']).notNullable().defaultTo('member');
        table.boolean('is_active').notNullable().defaultTo(true);
        
        table.string('last_login').nullable();
        table.timestamps(true, true);

        table.index('email');
        table.index('role');
        table.index('is_active');
    });

    console.log('✅ Users table created successfully');
};

export const down = async (knex: Knex): Promise<void> => {
    await knex.schema.dropTable('users');
    console.log('✅ Users table dropped successfully');
};