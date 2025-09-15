import express from 'express';
import ViteExpress from 'vite-express';
import { v4 as uuidv4 } from 'uuid';
import db from './utils/db.js';

const app = express();
app.use(express.json());

app.get('/api/chores', async (req, res) => {
    const { userId } = req.query;
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

app.post('/api/chores', async (req, res) => {
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
        res.json({ ...newChore, done: !!newChore.done });
    } catch (err) {
        console.error('POST /api/chores error:', err);
        res.status(500).json({ message: 'Failed to add chore' });
    }
});

app.put('/api/chores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [updatedChore] = await db('chores').where('id', id).update(req.body).returning('*');
        if (updatedChore) {
            res.json(updatedChore);
        } else {
            res.status(404).json({ message: 'Chore not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to update chore' });
    }
});

app.delete('/api/chores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db('chores').where('id', id).del();
        res.json({ message: 'Chore deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete chore' });
    }
});

app.post('/api/fcm-token', async (req, res) => {
    const { userId, token } = req.body;
    try {
        await db('user_fcm_tokens')
            .insert({ user_id: userId, fcm_token: token })
            .onConflict('fcm_token')
            .merge();
        res.json({ message: 'FCM token saved successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to save FCM token' });
    }
});

// Test cleanup endpoint - only available when VITE_SKIP_AUTH is true
app.delete('/api/chores/test-cleanup', async (req, res) => {
    if (process.env.VITE_SKIP_AUTH !== 'true') {
        return res.status(403).json({ message: 'Test cleanup only available in test mode' });
    }

    const { userId } = req.body;
    try {
        await db('chores').where('user_id', userId).del();
        res.json({ message: 'Test data cleaned up successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to clean up test data' });
    }
});

const port = parseInt(process.env.PORT || '3000', 10);
ViteExpress.listen(app, port, () => {
    console.log(`Server listening on port ${port}`);
});
