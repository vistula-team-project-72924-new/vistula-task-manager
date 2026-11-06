let config = {};
let editingTaskId = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadConfig();
        setupEventListeners();
        await fetchTasks();
    } catch (error) {
        showStatus(error.message, 'error');
    }
});

async function loadConfig() {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('Failed to load configuration file (config.json)');
    config = await response.json();
}

function getHeaders(isPostOrPut = false) {
    const headers = {
        'apikey': config.supabasePublishableKey,
        'Authorization': `Bearer ${config.supabasePublishableKey}`,
        'Content-Type': 'application/json'
    };
    if (isPostOrPut) {
        headers['Prefer'] = 'return=representation';
    }
    return headers;
}

function showStatus(message, type = 'success') {
    const statusMsg = document.getElementById('status-message');
    if (!statusMsg) return;
    statusMsg.textContent = message;
    statusMsg.className = type;
    setTimeout(() => {
        statusMsg.textContent = '';
        statusMsg.className = '';
    }, 4000);
}

function setupEventListeners() {
    const form = document.getElementById('task-form');
    form.addEventListener('submit', handleFormSubmit);
}

async function fetchTasks() {
    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?select=*`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch tasks from database');
        
        const tasks = await response.json();
        renderTasks(tasks);
    } catch (error) {
        showStatus(error.message, 'error');
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        taskList.innerHTML = '<p>No tasks found.</p>';
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.setAttribute('data-id', task.id);

        item.innerHTML = `
            <h3 class="task-title">${escapeHTML(task.title)}</h3>
            <p class="task-description">${escapeHTML(task.description || '')}</p>
            <span class="task-status">Status: ${task.completed ? 'Completed' : 'Incomplete'}</span>
            <div class="task-actions">
                <button class="toggle-task" data-id="${task.id}" data-completed="${task.completed}">
                    ${task.completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
                <button class="edit-task" data-id="${task.id}" data-title="${escapeHTML(task.title)}" data-description="${escapeHTML(task.description || '')}">Edit</button>
                <button class="delete-task" data-id="${task.id}">Delete</button>
            </div>
        `;
        taskList.appendChild(item);
    });

    attachTaskActionListeners();
}

function attachTaskActionListeners() {
    const taskList = document.getElementById('task-list');
    
    taskList.onclick = async (e) => {
        const target = e.target;
        const id = target.getAttribute('data-id');

        if (!id) return;

        if (target.classList.contains('delete-task')) {
            await deleteTask(id);
        }

        if (target.classList.contains('toggle-task')) {
            const currentCompleted = target.getAttribute('data-completed') === 'true';
            await toggleTaskStatus(id, !currentCompleted);
        }

        if (target.classList.contains('edit-task')) {
            document.getElementById('task-title').value = target.getAttribute('data-title');
            document.getElementById('task-description').value = target.getAttribute('data-description');
            editingTaskId = id;
            document.getElementById('task-submit').textContent = 'Update Task';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();

    if (!title) return;

    try {
        if (editingTaskId === null) {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ title, description, completed: false })
            });
            if (!response.ok) throw new Error('Failed to create task');
            showStatus('Task created successfully!');
        } else {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?id=eq.${editingTaskId}`, {
                method: 'PATCH',
                headers: getHeaders(true),
                body: JSON.stringify({ title, description })
            });
            if (!response.ok) throw new Error('Failed to update task');
            showStatus('Task updated successfully!');
            
            editingTaskId = null;
            document.getElementById('task-submit').textContent = 'Add Task';
        }

        e.target.reset();
        await fetchTasks();
    } catch (error) {
        showStatus(error.message, 'error');
    }
}

async function toggleTaskStatus(id, newStatus) {
    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?id=eq.${id}`, {
            method: 'PATCH',
            headers: getHeaders(true),
            body: JSON.stringify({ completed: newStatus })
        });
        if (!response.ok) throw new Error('Failed to change task status');
        showStatus('Task status updated');
        await fetchTasks();
    } catch (error) {
        showStatus(error.message, 'error');
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete task');
        showStatus('Task deleted successfully');
        await fetchTasks();
    } catch (error) {
        showStatus(error.message, 'error');
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}