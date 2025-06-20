import { Knex } from 'knex';

export const up = async (knex: Knex) => {
    await knex.schema.createTable('tasks', (table) => {
        table.increments('id').primary();
        
        table.string('title').notNullable();
        table.text('description').nullable();
        table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.integer('assignee_id').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.integer('creator_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.enum('status', ['todo', 'in_progress', 'review', 'done']).notNullable().defaultTo('pending');
        table.enum('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium');
        table.timestamp('due_date').nullable();
        table.integer('estimated_hours').nullable();
        table.integer('actual_hours').nullable();
        table.json('tags').nullable();
        
        table.timestamps(true, true);

        table.index('project_id');
        table.index('assignee_id');
        table.index('creator_id');
        table.index('status');
        table.index('priority');
        table.index('due_date');
    });

    console.log('✅ Tasks table created successfully');
};

export const down = async (knex: Knex) => {
    await knex.schema.dropTable('tasks');
    console.log('✅ Tasks table dropped successfully');
};