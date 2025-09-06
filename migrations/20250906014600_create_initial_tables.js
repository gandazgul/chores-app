/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('users', function (table) {
            table.string('id').primary();
            table.string('email').notNullable().unique();
            table.timestamps(true, true);
        })
        .createTable('chores', function (table) {
            table.uuid('id').primary();
            table.string('user_id').references('id').inTable('users').notNullable();
            table.string('title').notNullable();
            table.text('description');
            table.integer('priority');
            table.boolean('done').defaultTo(false);
            table.timestamp('due_date');
            table.boolean('remind_until_done').defaultTo(false);
            table.jsonb('recurrence');
            table.timestamps(true, true);
        })
        .createTable('user_fcm_tokens', function (table) {
            table.increments('id').primary();
            table.string('user_id').references('id').inTable('users').notNullable();
            table.string('fcm_token').notNullable().unique();
            table.timestamps(true, true);
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTable('user_fcm_tokens')
        .dropTable('chores')
        .dropTable('users');
}