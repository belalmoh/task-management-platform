import { Knex } from 'knex';

export const up = async (knex: Knex) => {
    await knex.schema.createTable('projects', (table) => {
        table.increments('id').primary();
        
        table.string('name').notNullable();
        table.string('description').nullable();
        table.integer('owner_id').notNullable();
        table.enum('status', ['active', 'inactive', 'completed']).notNullable().defaultTo('active');
        table.json('settings').nullable();
        
        
        table.timestamps(true, true);

        table.index('owner_id');
        table.index('status');
        table.index('created_at');
    });

    console.log('✅ Projects table created successfully');
};

export const down = async (knex: Knex) => {
    await knex.schema.dropTable('projects');
    console.log('✅ Projects table dropped successfully');
};