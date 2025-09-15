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

async function addChore(chore) {
    const response = await fetch('/api/chores', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(chore),
    });
    if (!response.ok) {
        throw new Error('Failed to add chore');
    }
    return response.json();
}

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

async function deleteChore(choreId) {
    const response = await fetch(`/api/chores/${choreId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete chore');
    }
    return response.json();
}

async function saveFCMToken(userId, token) {
    const response = await fetch('/api/fcm-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, token }),
    });
    if (!response.ok) {
        throw new Error('Failed to save FCM token');
    }
    return response.json();
}

export { getChores, addChore, updateChore, deleteChore, saveFCMToken };