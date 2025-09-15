/**
 * Fetches all chores for a given user.
 * @param {string} userId - The ID of the user to fetch chores for.
 * @returns {Promise<Array>} A promise that resolves to an array of chores.
 */
async function getChores(userId) {
    if (!userId) {
        console.log("No user ID, skipping chores fetch");
        return [];
    }
    const response = await fetch(`/api/chores?userId=${userId}&t=${new Date().getTime()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch chores');
    }
    const chores = await response.json();
    console.log('Chores from API:', chores);
    return chores;
}

/**
 * Adds a new chore to the database.
 * @param {object} chore - The chore object to add.
 * @returns {Promise<object>} A promise that resolves to the newly added chore.
 */
async function addChore(chore) {
    const response = await fetch('/api/chores', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(chore),
    });
    if (!response.ok && response.status !== 201) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add chore');
    }
    return response.json();
}

/**
 * Updates an existing chore.
 * @param {string} choreId - The ID of the chore to update.
 * @param {object} updates - An object containing the chore fields to update.
 * @returns {Promise<object>} A promise that resolves to the updated chore.
 */
async function updateChore(choreId, updates) {
    const response = await fetch(`/api/chores/${choreId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
    });
    if (!response.ok) {
        throw new Error('Failed to update chore');
    }
    return response.json();
}

/**
 * Deletes a chore from the database.
 * @param {string} choreId - The ID of the chore to delete.
 * @returns {Promise<object>} A promise that resolves to a confirmation message.
 */
async function deleteChore(choreId) {
    const response = await fetch(`/api/chores/${choreId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete chore');
    }
    return response.json();
}

/**
 * Saves the FCM token for a user to the database.
 * @param {string} userId - The ID of the user.
 * @param {string} token - The FCM token to save.
 * @returns {Promise<object>} A promise that resolves to a confirmation message.
 */
async function saveFCMToken(userId, token) {
    const response = await fetch('/api/fcm-tokens', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, token }),
    });
    if (!response.ok && response.status !== 201) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save FCM token');
    }
    return response.json();
}

export { getChores, addChore, updateChore, deleteChore, saveFCMToken };