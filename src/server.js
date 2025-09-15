import express from 'express';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import ViteExpress from 'vite-express';
import { v4 as uuidv4 } from 'uuid';
import db from './utils/db.js';

const app = express();
app.use(express.json());
const options = {
    info: {
        version: process.env.npm_package_version,
        title: 'Chores App API',
        description: 'API for managing household chores',
    },
    security: {
        BearerAuth: {
            type: 'http',
            scheme: 'bearer',
        },
    },
    baseDir: new URL('.', import.meta.url).pathname,
    // Glob pattern to find your jsdoc files (can be adjusted)
    filesPattern: '**/server.js',
    // Open API JSON Docs endpoint.
    apiDocsPath: '/api/docs.json',
    // URL where SwaggerUI will be rendered
    swaggerUIPath: '/api/docs',
    // Expose OpenAPI UI
    exposeSwaggerUI: true,
    // Expose Open API JSON Docs documentation in JSON format
    exposeApiDocs: true,
    // Set non-required fields as nullable by default
    notRequiredAsNullable: false,
    // You can customize your UI options.
    // you can extend swagger-ui-express config. You can checkout an example of this
    // in the `example/configuration/swagger-ui-options.js` in this repo.
    swaggerUiOptions: {},
};

expressJSDocSwagger(app)(options);

/**
 * @preserve
 * A recurrence object for a chore
 * @typedef {object} Recurrence
 * @property {string} type.required - The type of recurrence (daily, weekly, monthly)
 * @property {number} interval - The interval of the recurrence
 * @property {array<string>} daysOfWeek - The days of the week for weekly recurrence
 * @property {number} dayOfMonth - The day of the month for monthly recurrence
 */

/**
 * @preserve
 * A chore object
 * @typedef {object} Chore
 * @property {string} id.required - The unique identifier for the chore
 * @property {string} title.required - The title of the chore
 * @property {string} description - A detailed description of the chore
 * @property {string} due_date - The due date of the chore
 * @property {boolean} done - Indicates if the chore is completed
 * @property {Recurrence} recurrence - The recurrence rule for the chore
 * @property {string} user_id.required - The user to whom the chore is assigned
 */

/**
 * @preserve
 * An FCM token object
 * @typedef {object} FCMToken
 * @property {string} userId.required - The ID of the user
 * @property {string} token.required - The FCM token
 */

/**
 * GET /api/chores
 * @preserve
 * @summary Fetches chores for a user
 * @tags Chores
 * @param {string} userId.query.required - The ID of the user to fetch chores for.
 * @return {array<Chore>} 200 - A list of chores
 * @return {object} 500 - Failed to fetch chores
 */
app.get('/api/chores', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ message: 'userId query parameter is required' });
    }
    try {
        const chores = await db('chores').where('user_id', userId).select('*');
        console.log('GET /api/chores - raw chores from DB:', chores);

        const processedChores = chores.map(chore => {
            const processed = { ...chore, done: !!chore.done };

            // Parse recurrence field if it exists
            if (processed.recurrence && typeof processed.recurrence === 'string') {
                try {
                    processed.recurrence = JSON.parse(processed.recurrence);
                } catch (parseErr) {
                    console.error('Failed to parse recurrence JSON for chore', chore.id, ':', parseErr);
                }
            }

            return processed;
        });

        console.log('GET /api/chores - processed chores:', processedChores);
        res.json(processedChores);
    } catch (err) {
        console.error('GET /api/chores error:', err);
        res.status(500).json({ message: 'Failed to fetch chores' });
    }
});

/**
 * POST /api/chores
 * @preserve
 * @summary Creates a new chore
 * @tags Chores
 * @param {Chore} request.body.required - The chore to create
 * @return {Chore} 201 - The created chore
 * @return {object} 400 - Invalid input data
 * @return {object} 422 - Validation error
 * @return {object} 500 - Failed to add chore
 */
app.post('/api/chores', async (req, res) => {
    const { title, user_id } = req.body;
    if (!title || !user_id) {
        return res.status(422).json({ message: 'Missing required fields: title and user_id' });
    }

    try {
        console.log('POST /api/chores - request body:', req.body);
        const id = uuidv4();
        const newChoreData = { ...req.body, id };
        console.log('POST /api/chores - data to insert:', newChoreData);

        // Handle recurrence field - ensure it's properly serialized
        if (newChoreData.recurrence && typeof newChoreData.recurrence === 'object') {
            newChoreData.recurrence = JSON.stringify(newChoreData.recurrence);
        }

        await db('chores').insert(newChoreData);
        const newChore = await db('chores').where('id', id).first();
        console.log('POST /api/chores - retrieved chore from DB:', newChore);

        // Parse recurrence field if it exists
        if (newChore && newChore.recurrence && typeof newChore.recurrence === 'string') {
            try {
                newChore.recurrence = JSON.parse(newChore.recurrence);
            } catch (parseErr) {
                console.error('Failed to parse recurrence JSON:', parseErr);
            }
        }

        console.log('POST /api/chores - final response:', { ...newChore, done: !!newChore.done });
        res.status(201).json({ ...newChore, done: !!newChore.done });
    } catch (err) {
        console.error('POST /api/chores error:', err);
        res.status(500).json({ message: 'Failed to add chore' });
    }
});

/**
 * PUT /api/chores/{id}
 * @preserve
 * @summary Updates an existing chore
 * @tags Chores
 * @param {string} id.path.required - The ID of the chore to update
 * @param {Chore} request.body.required - The updated chore data
 * @return {Chore} 200 - The updated chore
 * @return {object} 404 - Chore not found
 * @return {object} 500 - Failed to update chore
 */
app.put('/api/chores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const numUpdated = await db('chores').where('id', id).update(req.body);
        if (numUpdated > 0) {
            const updatedChore = await db('chores').where('id', id).first();
            res.json(updatedChore);
        } else {
            res.status(404).json({ message: 'Chore not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to update chore' });
    }
});

/**
 * DELETE /api/chores/{id}
 * @preserve
 * @summary Deletes a chore
 * @tags Chores
 * @param {string} id.path.required - The ID of the chore to delete
 * @return {object} 200 - Chore deleted successfully
 * @return {object} 404 - Chore not found
 * @return {object} 500 - Failed to delete chore
 */
app.delete('/api/chores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const numDeleted = await db('chores').where('id', id).del();
        if (numDeleted > 0) {
            res.json({ message: 'Chore deleted successfully' });
        } else {
            res.status(404).json({ message: 'Chore not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete chore' });
    }
});

/**
 * POST /api/fcm-tokens
 * @preserve
 * @summary Saves an FCM token for a user
 * @tags FCM Tokens
 * @param {FCMToken} request.body.required - The FCM token to save
 * @return {object} 201 - FCM token saved successfully
 * @return {object} 422 - Validation error
 * @return {object} 500 - Failed to save FCM token
 */
app.post('/api/fcm-tokens', async (req, res) => {
    const { userId, token } = req.body;
    if (!userId || !token) {
        return res.status(422).json({ message: 'Missing required fields: userId and token' });
    }
    try {
        await db('user_fcm_tokens')
            .insert({ user_id: userId, fcm_token: token })
            .onConflict('fcm_token')
            .merge();
        res.status(201).json({ message: 'FCM token saved successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to save FCM token' });
    }
});

const port = parseInt(process.env.PORT || '3000', 10);
ViteExpress.listen(app, port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
