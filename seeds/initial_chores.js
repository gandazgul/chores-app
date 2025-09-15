import { v4 as uuidv4 } from 'uuid';

export async function seed(knex) {
    // Deletes ALL existing entries
    await knex('chores').del();

    // Inserts seed entries
    await knex('chores').insert([
        {
            id: uuidv4(),
            user_id: 'r0wk2VvPQFhW7bpLpq3MxMhjodD2', // Replace with a valid user ID from your users table
            title: 'Wash the dishes',
            description: 'Wash all the dishes in the sink.',
            priority: 1,
            done: false,
        },
        {
            id: uuidv4(),
            user_id: 'r0wk2VvPQFhW7bpLpq3MxMhjodD2', // Replace with a valid user ID from your users table
            title: 'Take out the trash',
            description: 'Take out the trash and recycling.',
            priority: 2,
            done: true,
        },
        {
            id: uuidv4(),
            user_id: 'r0wk2VvPQFhW7bpLpq3MxMhjodD2', // Replace with a valid user ID from your users table
            title: 'Clean the bathroom',
            description: 'Clean the toilet, sink, and shower.',
            priority: 3,
            done: false,
        },
    ]);
}