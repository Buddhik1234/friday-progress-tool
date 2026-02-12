// ============================================================
// PROGRESS TRACKER PRO - Enhanced Features
// ============================================================

// === Data Structure & State ===
let appData = { 
    phases: [],
    tags: [],
    archive: [],
    settings: {
        theme: 'dark',
        lastActivity: null
    }
};

let currentView = { type: 'home', phaseId: null, weekId: null, dayId: null, taskId: null };
let calendarDate = new Date();
let searchQuery = '';
let filterPriority = '';
let filterTag = '';

// Time tracking state
let activeTimer = null;
let timerInterval = null;
let timerStartTime = null;
let timerElapsed = 0;

// Pomodoro state
let pomodoroTimer = null;
let pomodoroInterval = null;
let pomodoroMinutes = 25;
let pomodoroSeconds = 0;
let pomodoroRunning = false;

// Tag modal state
let selectedTagColor = '#5CE38D';

// Charts
let timeChart = null;
let progressChart = null;

// === Initial Load ===
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    applyTheme();
    setupCalendarControls();
    setupEventListeners();
    setupKeyboardShortcuts();
    renderView();
    updateTagFilter();
    checkRecurringTasks();
});

// === Data Persistence ===
function loadData() {
    const saved = localStorage.getItem('fridayProgressToolPro');
    if (saved) {
        const parsed = JSON.parse(saved);
        appData = { ...appData, ...parsed };
    }
    
    // Data migration: ensure all tasks have new properties
    appData.phases.forEach(phase => {
        phase.weeks?.forEach(week => {
            week.days?.forEach(day => {
                day.tasks?.forEach(task => {
                    if (!task.priority) task.priority = 'medium';
                    if (!task.tags) task.tags = [];
                    if (!task.timeSpent) task.timeSpent = 0;
                    if (!task.dueDate) task.dueDate = '';
                    if (!task.recurring) task.recurring = '';
                    if (!task.lastCompleted) task.lastCompleted = '';
                    if (typeof task.notes === 'string') {
                        task.notes = task.notes ? [task.notes] : [];
                    }
                    if (!Array.isArray(task.notes)) task.notes = [];
                    if (!task.videos) task.videos = [];
                    if (task.videoUrl) {
                        task.videos.push(task.videoUrl);
                        delete task.videoUrl;
                    }
                });
            });
        });
    });
}

function saveData() {
    appData.settings.lastActivity = new Date().toISOString();
    localStorage.setItem('fridayProgressToolPro', JSON.stringify(appData));
    renderView();
}

function saveDataQuietly() {
    appData.settings.lastActivity = new Date().toISOString();
    localStorage.setItem('fridayProgressToolPro', JSON.stringify(appData));
}

// === Theme Management ===
function setTheme(themeName) {
    appData.settings.theme = themeName;
    document.body.setAttribute('data-theme', themeName);
    saveDataQuietly();
    
    // Update active state
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
    });
}

function applyTheme() {
    const theme = appData.settings.theme || 'dark';
    document.body.setAttribute('data-theme', theme);
    
    setTimeout(() => {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
        });
    }, 100);
}

// === Navigation & Rendering ===
function navigateTo(type, id = null) {
    // Hide special views
    document.getElementById('analytics-dashboard').style.display = 'none';
    document.getElementById('archive-view').style.display = 'none';
    
    if (type === 'analytics') {
        currentView = { type: 'analytics' };
        renderAnalytics();
        return;
    }
    
    if (type === 'archive') {
        currentView = { type: 'archive' };
        renderArchive();
        return;
    }
    
    if (type === 'home') {
        currentView = { type: 'home', phaseId: null, weekId: null, dayId: null, taskId: null };
    } else if (type === 'phase') {
        currentView.type = 'phase';
        currentView.phaseId = id;
        currentView.weekId = null;
        currentView.dayId = null;
        currentView.taskId = null;
    } else if (type === 'week') {
        currentView.type = 'week';
        currentView.weekId = id;
        currentView.dayId = null;
        currentView.taskId = null;
    } else if (type === 'day') {
        currentView.type = 'day';
        currentView.dayId = id;
        currentView.taskId = null;
    } else if (type === 'task') {
        currentView.type = 'task';
        currentView.taskId = id;
    }
    
    renderView();
}

function renderView() {
    const sidebarList = document.getElementById('sidebar-list');
    const sidebarTitle = document.getElementById('sidebar-title');
    const navHeader = document.getElementById('nav-header');
    const homeCalendar = document.getElementById('home-calendar-container');
    const listSection = document.getElementById('main-list-section');
    const taskDetailSection = document.getElementById('task-detail-section');
    const subtitle = document.getElementById('page-subtitle');
    const editBtn = document.getElementById('edit-subtitle-btn');

    sidebarList.innerHTML = '';
    
    // Default visibility reset
    homeCalendar.style.display = 'none';
    listSection.style.display = 'block';
    taskDetailSection.style.display = 'none';
    editBtn.style.display = 'inline-block';

    if (currentView.type === 'home') {
        sidebarTitle.innerText = 'Phases';
        navHeader.innerHTML = '';
        
        appData.phases.forEach(phase => {
            const el = createSidebarItem(phase.title, phase.id, () => navigateTo('phase', phase.id), 'phase');
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = 'Dashboard';
        subtitle.innerText = 'Overview';
        editBtn.style.display = 'none';
        listSection.style.display = 'none';
        homeCalendar.style.display = 'block';
        
        updateOverallProgress();
        renderCalendar();

    } else if (currentView.type === 'phase') {
        const phase = appData.phases.find(p => p.id === currentView.phaseId);
        if (!phase) return navigateTo('home');

        sidebarTitle.innerText = 'Weeks';
        navHeader.innerHTML = `<button class="back-btn" onclick="navigateTo('home')"><i class="fas fa-arrow-left"></i> Home</button>`;

        phase.weeks.forEach(week => {
            const el = createSidebarItem(week.title, week.id, () => navigateTo('week', week.id), 'week');
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = phase.title;
        subtitle.innerText = phase.subtitle || 'Phase Goals';
        document.getElementById('list-title').innerText = 'Goals';

        renderChecklist(phase.goals, 'goal');
        updateProgressBar(calculatePhaseProgress(phase));

    } else if (currentView.type === 'week') {
        const phase = appData.phases.find(p => p.id === currentView.phaseId);
        const week = phase.weeks.find(w => w.id === currentView.weekId);
        
        sidebarTitle.innerText = 'Days';
        navHeader.innerHTML = `<button class="back-btn" onclick="navigateTo('phase', '${phase.id}')"><i class="fas fa-arrow-left"></i> ${phase.title}</button>`;

        week.days.forEach(day => {
            const el = createSidebarItem(day.title, day.id, () => navigateTo('day', day.id), 'day');
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = week.title;
        subtitle.innerText = week.subtitle || 'Weekly Objectives';
        document.getElementById('list-title').innerText = 'Objectives';

        renderChecklist(week.objectives, 'objective');
        updateProgressBar(calculateWeekProgress(week));

    } else if (currentView.type === 'day') {
        const phase = appData.phases.find(p => p.id === currentView.phaseId);
        const week = phase.weeks.find(w => w.id === currentView.weekId);
        const day = week.days.find(d => d.id === currentView.dayId);

        sidebarTitle.innerText = 'Tasks';
        navHeader.innerHTML = `<button class="back-btn" onclick="navigateTo('week', '${week.id}')"><i class="fas fa-arrow-left"></i> ${week.title}</button>`;

        week.days.forEach(d => {
            const el = createSidebarItem(d.title, d.id, () => navigateTo('day', d.id), 'day');
            if (d.id === day.id) el.style.borderLeft = "4px solid var(--main-green)";
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = day.title;
        subtitle.innerText = day.assignedDate || 'Set Date';
        document.getElementById('list-title').innerText = 'Tasks';

        renderChecklist(day.tasks, 'task');
        updateProgressBar(calculateDayProgress(day));

    } else if (currentView.type === 'task') {
        const phase = appData.phases.find(p => p.id === currentView.phaseId);
        const week = phase.weeks.find(w => w.id === currentView.weekId);
        const day = week.days.find(d => d.id === currentView.dayId);
        const task = day.tasks[currentView.taskId];

        listSection.style.display = 'none';
        taskDetailSection.style.display = 'block';
        editBtn.style.display = 'none';

        sidebarTitle.innerText = 'Day Tasks';
        navHeader.innerHTML = `<button class="back-btn" onclick="navigateTo('day', '${day.id}')"><i class="fas fa-arrow-left"></i> ${day.title}</button>`;

        day.tasks.forEach((t, idx) => {
            const el = createSidebarItem(t.text, idx, () => navigateTo('task', idx), 'task');
            if (idx === currentView.taskId) el.style.borderLeft = "4px solid var(--main-green)";
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = "Task Detail";
        subtitle.innerText = task.text;

        renderTaskDetails(task);
    }
}

// === Checklist Rendering with Filters ===
function renderChecklist(items, itemType) {
    const container = document.getElementById('main-list-container');
    container.innerHTML = '';
    
    let filteredItems = items.map((item, index) => ({ item, index }));
    
    // Apply search filter
    if (searchQuery) {
        filteredItems = filteredItems.filter(({ item }) =>
            item.text.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    // Apply priority filter
    if (filterPriority && itemType === 'task') {
        filteredItems = filteredItems.filter(({ item }) =>
            item.priority === filterPriority
        );
    }
    
    // Apply tag filter
    if (filterTag && itemType === 'task') {
        filteredItems = filteredItems.filter(({ item }) =>
            item.tags && item.tags.includes(filterTag)
        );
    }
    
    filteredItems.forEach(({ item, index }) => {
        const div = document.createElement('div');
        div.className = `task-item ${item.completed ? 'completed' : ''}`;
        
        if (itemType === 'task') {
            div.setAttribute('data-priority', item.priority || 'medium');
        }
        
        const clickAction = itemType === 'task' ? `onclick="navigateTo('task', ${index})"` : '';
        
        let tagsHTML = '';
        if (itemType === 'task' && item.tags && item.tags.length > 0) {
            const tagObjs = item.tags.map(t => appData.tags.find(tag => tag.name === t)).filter(Boolean);
            tagsHTML = '<div class="task-tags">' + tagObjs.map(tag =>
                `<span class="tag" style="background: ${tag.color}">${tag.name}</span>`
            ).join('') + '</div>';
        }

        div.innerHTML = `
            <div class="checkbox-custom"><i class="fas fa-check"></i></div>
            <div style="flex-grow:1; margin-left:10px;">
                <span style="cursor:pointer;" ${clickAction}>${item.text}</span>
                ${tagsHTML}
            </div>
            <div class="action-icons">
                <i class="fas fa-pencil-alt" id="edit-${index}"></i>
                <i class="fas fa-trash" id="del-${index}"></i>
            </div>
        `;
        
        div.querySelector('.checkbox-custom').addEventListener('click', (e) => {
            e.stopPropagation();
            item.completed = !item.completed;
            if (item.completed && item.recurring) {
                item.lastCompleted = new Date().toISOString();
            }
            saveData();
        });
        
        div.querySelector(`#edit-${index}`).addEventListener('click', (e) => {
            e.stopPropagation();
            openModal('Edit Item', item.text, (val) => { if (val) { item.text = val; saveData(); }}, 'text');
        });
        
        div.querySelector(`#del-${index}`).addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this item?')) {
                items.splice(index, 1);
                saveData();
            }
        });
        
        container.appendChild(div);
    });
    
    if (filteredItems.length === 0 && (searchQuery || filterPriority || filterTag)) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 20px;">No items match your filters</p>';
    }
}

// === Task Details Rendering ===
function renderTaskDetails(task) {
    // Priority
    const prioritySelect = document.getElementById('task-priority');
    prioritySelect.value = task.priority || 'medium';
    prioritySelect.onchange = () => {
        task.priority = prioritySelect.value;
        saveDataQuietly();
    };
    
    // Tags
    renderTaskTags(task);
    
    // Due Date
    const dueDateInput = document.getElementById('task-due-date');
    dueDateInput.value = task.dueDate || '';
    dueDateInput.onchange = () => {
        task.dueDate = dueDateInput.value;
        saveDataQuietly();
    };
    
    // Recurring
    const recurringSelect = document.getElementById('task-recurring');
    recurringSelect.value = task.recurring || '';
    recurringSelect.onchange = () => {
        task.recurring = recurringSelect.value;
        saveDataQuietly();
    };
    
    // Time Tracking
    updateTaskTimeDisplay(task);
    
    // Notes
    renderNotes(task);
    
    // Videos
    renderVideos(task);
}

function renderTaskTags(task) {
    const container = document.getElementById('task-tags-container');
    container.innerHTML = '';
    
    if (task.tags && task.tags.length > 0) {
        task.tags.forEach(tagName => {
            const tagObj = appData.tags.find(t => t.name === tagName);
            if (tagObj) {
                const pill = document.createElement('div');
                pill.className = 'tag-pill';
                pill.style.background = tagObj.color;
                pill.innerHTML = `${tagObj.name} <i class="fas fa-times" onclick="removeTaskTag('${tagName}')"></i>`;
                container.appendChild(pill);
            }
        });
    }
}

function removeTaskTag(tagName) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    task.tags = task.tags.filter(t => t !== tagName);
    renderTaskTags(task);
    saveDataQuietly();
}

// === Tag Management ===
function openTagModal() {
    const modal = document.getElementById('tag-modal');
    const input = document.getElementById('tag-input');
    input.value = '';
    selectedTagColor = '#5CE38D';
    
    // Reset color selection
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    document.querySelector('.color-option[data-color="#5CE38D"]').classList.add('selected');
    
    modal.style.display = 'flex';
}

function updateTagFilter() {
    const select = document.getElementById('filter-tag');
    select.innerHTML = '<option value="">All Tags</option>';
    appData.tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag.name;
        opt.innerText = tag.name;
        select.appendChild(opt);
    });
}

// === Notes Management ===
function renderNotes(task) {
    const container = document.getElementById('notes-list-container');
    container.innerHTML = '';
    
    if (!task.notes) task.notes = [];
    
    task.notes.forEach((note, index) => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-item';
        noteDiv.innerHTML = `
            <textarea class="glass-input note-textarea" placeholder="Write your note here...">${note}</textarea>
            <div class="delete-note-btn" onclick="deleteNote(${index})">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        const textarea = noteDiv.querySelector('textarea');
        textarea.addEventListener('input', () => {
            task.notes[index] = textarea.value;
            saveDataQuietly();
        });
        
        container.appendChild(noteDiv);
    });
}

function addNote() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    if (!task.notes) task.notes = [];
    task.notes.push('');
    renderNotes(task);
    saveDataQuietly();
}

function deleteNote(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    task.notes.splice(index, 1);
    renderNotes(task);
    saveDataQuietly();
}

// === Videos Management ===
function renderVideos(task) {
    const container = document.getElementById('video-list-container');
    container.innerHTML = '';
    
    if (!task.videos) task.videos = [];
    
    task.videos.forEach((url, index) => {
        const videoId = extractYouTubeID(url);
        if (videoId) {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.innerHTML = `
                <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
                <div class="delete-video-btn" onclick="deleteVideo(${index})">
                    <i class="fas fa-times"></i>
                </div>
            `;
            container.appendChild(wrapper);
        }
    });
}

function addVideo() {
    const input = document.getElementById('youtube-url');
    const url = input.value.trim();
    if (!url) return;
    
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    if (!task.videos) task.videos = [];
    task.videos.push(url);
    input.value = '';
    renderVideos(task);
    saveDataQuietly();
}

function deleteVideo(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    task.videos.splice(index, 1);
    renderVideos(task);
    saveDataQuietly();
}

function extractYouTubeID(url) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return match ? match[1] : null;
}

// === Time Tracking ===
function updateTaskTimeDisplay(task) {
    const timeSpent = task.timeSpent || 0;
    const hours = Math.floor(timeSpent / 3600);
    const minutes = Math.floor((timeSpent % 3600) / 60);
    document.getElementById('task-time-spent').innerText = `${hours}h ${minutes}m`;
}

function startTaskTimer() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    if (timerInterval) return; // Already running
    
    timerStartTime = Date.now();
    timerElapsed = 0;
    
    document.getElementById('start-timer-btn').classList.add('hidden');
    document.getElementById('pause-timer-btn').classList.remove('hidden');
    
    timerInterval = setInterval(() => {
        timerElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
        task.timeSpent = (task.timeSpent || 0) + 1;
        updateTaskTimeDisplay(task);
        saveDataQuietly();
    }, 1000);
}

function pauseTaskTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    document.getElementById('start-timer-btn').classList.remove('hidden');
    document.getElementById('pause-timer-btn').classList.add('hidden');
}

// === Pomodoro Timer ===
function openPomodoroTimer() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    const task = day.tasks[currentView.taskId];
    
    document.getElementById('timer-task-name').innerText = `Working on: ${task.text}`;
    document.getElementById('pomodoro-overlay').classList.remove('hidden');
    pomodoroMinutes = 25;
    pomodoroSeconds = 0;
    updatePomodoroDisplay();
}

function closePomodoroTimer() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    pomodoroRunning = false;
    document.getElementById('pomodoro-overlay').classList.add('hidden');
    document.getElementById('timer-start').classList.remove('hidden');
    document.getElementById('timer-pause').classList.add('hidden');
}

function setPomodoroTime(minutes) {
    pomodoroMinutes = minutes;
    pomodoroSeconds = 0;
    updatePomodoroDisplay();
    
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function updatePomodoroDisplay() {
    const display = document.getElementById('timer-display');
    const mins = String(pomodoroMinutes).padStart(2, '0');
    const secs = String(pomodoroSeconds).padStart(2, '0');
    display.innerText = `${mins}:${secs}`;
}

function startPomodoroTimer() {
    if (pomodoroRunning) return;
    
    pomodoroRunning = true;
    document.getElementById('timer-start').classList.add('hidden');
    document.getElementById('timer-pause').classList.remove('hidden');
    
    pomodoroInterval = setInterval(() => {
        if (pomodoroSeconds === 0) {
            if (pomodoroMinutes === 0) {
                // Timer finished
                clearInterval(pomodoroInterval);
                pomodoroRunning = false;
                alert('Pomodoro session complete! Take a break.');
                closePomodoroTimer();
                return;
            }
            pomodoroMinutes--;
            pomodoroSeconds = 59;
        } else {
            pomodoroSeconds--;
        }
        updatePomodoroDisplay();
    }, 1000);
}

function pausePomodoroTimer() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    pomodoroRunning = false;
    document.getElementById('timer-start').classList.remove('hidden');
    document.getElementById('timer-pause').classList.add('hidden');
}

function resetPomodoroTimer() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    pomodoroRunning = false;
    pomodoroMinutes = 25;
    pomodoroSeconds = 0;
    updatePomodoroDisplay();
    document.getElementById('timer-start').classList.remove('hidden');
    document.getElementById('timer-pause').classList.add('hidden');
}

// === Analytics ===
function renderAnalytics() {
    document.getElementById('analytics-dashboard').style.display = 'block';
    document.getElementById('home-calendar-container').style.display = 'none';
    document.getElementById('main-list-section').style.display = 'none';
    
    document.getElementById('page-title').innerText = 'Analytics';
    document.getElementById('page-subtitle').innerText = 'Performance Overview';
    document.getElementById('sidebar-title').innerText = 'Stats';
    document.getElementById('nav-header').innerHTML = '<button class="back-btn" onclick="navigateTo(\'home\')"><i class="fas fa-arrow-left"></i> Home</button>';
    
    // Calculate statistics
    const stats = calculateStats();
    
    document.getElementById('stat-total-tasks').innerText = stats.totalTasks;
    document.getElementById('stat-completed-tasks').innerText = stats.completedTasks;
    document.getElementById('stat-pending-tasks').innerText = stats.pendingTasks;
    document.getElementById('stat-completion-rate').innerText = stats.completionRate + '%';
    
    // Calculate streak
    const streak = calculateStreak();
    document.getElementById('streak-days').innerText = streak + ' days';
    
    // Render charts
    renderTimeChart(stats);
    renderProgressChart();
}

function calculateStats() {
    let totalTasks = 0;
    let completedTasks = 0;
    
    appData.phases.forEach(phase => {
        phase.weeks?.forEach(week => {
            week.days?.forEach(day => {
                totalTasks += day.tasks?.length || 0;
                completedTasks += day.tasks?.filter(t => t.completed).length || 0;
            });
        });
    });
    
    const pendingTasks = totalTasks - completedTasks;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return { totalTasks, completedTasks, pendingTasks, completionRate };
}

function calculateStreak() {
    if (!appData.settings.lastActivity) return 0;
    
    const lastActivity = new Date(appData.settings.lastActivity);
    const today = new Date();
    const diffTime = today - lastActivity;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Simple streak: days since last activity < 2
    return diffDays < 2 ? diffDays + 1 : 1;
}

function renderTimeChart(stats) {
    const ctx = document.getElementById('time-chart');
    if (!ctx) return;
    
    // Destroy previous chart
    if (timeChart) timeChart.destroy();
    
    // Calculate time spent per phase
    const phaseData = appData.phases.map(phase => {
        let totalTime = 0;
        phase.weeks?.forEach(week => {
            week.days?.forEach(day => {
                day.tasks?.forEach(task => {
                    totalTime += task.timeSpent || 0;
                });
            });
        });
        return {
            name: phase.title,
            hours: Math.round(totalTime / 3600 * 10) / 10
        };
    });
    
    timeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: phaseData.map(p => p.name),
            datasets: [{
                label: 'Hours',
                data: phaseData.map(p => p.hours),
                backgroundColor: 'rgba(92, 227, 141, 0.6)',
                borderColor: 'rgba(92, 227, 141, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function renderProgressChart() {
    const ctx = document.getElementById('progress-chart');
    if (!ctx) return;
    
    if (progressChart) progressChart.destroy();
    
    const phaseProgress = appData.phases.map(phase => ({
        name: phase.title,
        progress: calculatePhaseProgress(phase)
    }));
    
    progressChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: phaseProgress.map(p => p.name),
            datasets: [{
                data: phaseProgress.map(p => p.progress),
                backgroundColor: [
                    'rgba(92, 227, 141, 0.8)',
                    'rgba(76, 201, 240, 0.8)',
                    'rgba(255, 107, 107, 0.8)',
                    'rgba(255, 230, 109, 0.8)',
                    'rgba(168, 218, 220, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#202020'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff' }
                }
            }
        }
    });
}

// === Archive ===
function renderArchive() {
    document.getElementById('archive-view').style.display = 'block';
    document.getElementById('home-calendar-container').style.display = 'none';
    document.getElementById('main-list-section').style.display = 'none';
    
    document.getElementById('page-title').innerText = 'Archive';
    document.getElementById('page-subtitle').innerText = 'Completed Items';
    document.getElementById('sidebar-title').innerText = 'Archives';
    document.getElementById('nav-header').innerHTML = '<button class="back-btn" onclick="navigateTo(\'home\')"><i class="fas fa-arrow-left"></i> Home</button>';
    
    const container = document.getElementById('archive-list');
    container.innerHTML = '';
    
    if (!appData.archive || appData.archive.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 40px;">No archived items</p>';
        return;
    }
    
    appData.archive.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'archive-item';
        div.innerHTML = `
            <h4>${item.title}</h4>
            <p>${item.type} - Archived on ${new Date(item.date).toLocaleDateString()}</p>
        `;
        container.appendChild(div);
    });
}

function archiveItem(type, id, title) {
    if (!appData.archive) appData.archive = [];
    appData.archive.push({
        type: type,
        title: title,
        date: new Date().toISOString()
    });
    saveDataQuietly();
}

function clearArchive() {
    if (confirm('Clear all archived items? This cannot be undone.')) {
        appData.archive = [];
        saveData();
        renderArchive();
    }
}

// === Recurring Tasks ===
function checkRecurringTasks() {
    const now = new Date();
    
    appData.phases.forEach(phase => {
        phase.weeks?.forEach(week => {
            week.days?.forEach(day => {
                day.tasks?.forEach(task => {
                    if (task.recurring && task.completed && task.lastCompleted) {
                        const lastCompleted = new Date(task.lastCompleted);
                        let shouldReset = false;
                        
                        if (task.recurring === 'daily') {
                            shouldReset = (now - lastCompleted) > 24 * 60 * 60 * 1000;
                        } else if (task.recurring === 'weekly') {
                            shouldReset = (now - lastCompleted) > 7 * 24 * 60 * 60 * 1000;
                        } else if (task.recurring === 'monthly') {
                            shouldReset = (now - lastCompleted) > 30 * 24 * 60 * 60 * 1000;
                        }
                        
                        if (shouldReset) {
                            task.completed = false;
                        }
                    }
                });
            });
        });
    });
}

// === Calendar ===
function setupCalendarControls() {
    document.getElementById('prev-month').onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    };
    document.getElementById('next-month').onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    };
}

function renderCalendar() {
    const monthYear = document.getElementById('calendar-month-year');
    const grid = document.getElementById('calendar-grid');
    
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    
    monthYear.innerText = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    grid.innerHTML = '';
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
        const header = document.createElement('div');
        header.className = 'calendar-day';
        header.innerText = name;
        header.style.fontWeight = '700';
        header.style.background = 'transparent';
        grid.appendChild(header);
    });
    
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }
    
    const assignedDates = getAssignedDatesMap();
    const today = new Date().toISOString().split('T')[0];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = day;
        
        if (assignedDates[dateStr]) {
            dayDiv.classList.add('has-task');
            const data = assignedDates[dateStr];
            dayDiv.onclick = () => {
                currentView.phaseId = data.phaseId;
                currentView.weekId = data.weekId;
                navigateTo('day', data.dayId);
            };
        }
        
        // Check for overdue tasks
        if (dateStr < today) {
            const hasOverdue = checkOverdueTasks(dateStr);
            if (hasOverdue) {
                dayDiv.classList.add('overdue');
            }
        }
        
        grid.appendChild(dayDiv);
    }
}

function getAssignedDatesMap() {
    let map = {};
    appData.phases.forEach(p => {
        p.weeks?.forEach(w => {
            w.days?.forEach(d => {
                if (d.assignedDate) map[d.assignedDate] = { phaseId: p.id, weekId: w.id, dayId: d.id };
            });
        });
    });
    return map;
}

function checkOverdueTasks(dateStr) {
    let hasOverdue = false;
    appData.phases.forEach(p => {
        p.weeks?.forEach(w => {
            w.days?.forEach(d => {
                d.tasks?.forEach(t => {
                    if (t.dueDate === dateStr && !t.completed) {
                        hasOverdue = true;
                    }
                });
            });
        });
    });
    return hasOverdue;
}

// === Core CRUD Operations ===
function createSidebarItem(text, id, clickHandler, type) {
    const div = document.createElement('div');
    div.className = 'nav-item';
    div.innerHTML = `
        <span class="item-text">${text}</span>
        <div class="action-icons">
            <i class="fas fa-pencil-alt" data-action="edit"></i>
            <i class="fas fa-archive" data-action="archive"></i>
            <i class="fas fa-trash" data-action="delete"></i>
        </div>
    `;
    div.querySelector('.item-text').addEventListener('click', clickHandler);
    div.querySelector('.fa-pencil-alt').addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('Edit Title', text, (newText) => { if (newText) updateItemTitle(type, id, newText); }, 'text');
    });
    div.querySelector('.fa-archive').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Archive this item?')) {
            archiveItem(type, id, text);
            deleteItem(type, id);
        }
    });
    div.querySelector('.fa-trash').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this? (Use Archive to preserve it)')) deleteItem(type, id);
    });
    return div;
}

function updateItemTitle(type, id, newTitle) {
    if (type === 'phase') appData.phases.find(x => x.id === id).title = newTitle;
    else if (type === 'week') appData.phases.find(x => x.id === currentView.phaseId).weeks.find(x => x.id === id).title = newTitle;
    else if (type === 'day') appData.phases.find(x => x.id === currentView.phaseId).weeks.find(x => x.id === currentView.weekId).days.find(x => x.id === id).title = newTitle;
    saveData();
}

function deleteItem(type, id) {
    if (type === 'phase') {
        appData.phases = appData.phases.filter(x => x.id !== id);
        if (currentView.phaseId === id) navigateTo('home');
    } else if (type === 'week') {
        const p = appData.phases.find(x => x.id === currentView.phaseId);
        p.weeks = p.weeks.filter(x => x.id !== id);
    } else if (type === 'day') {
        const p = appData.phases.find(x => x.id === currentView.phaseId);
        const w = p.weeks.find(x => x.id === currentView.weekId);
        w.days = w.days.filter(x => x.id !== id);
    }
    saveData();
}

function addItem() {
    const id = Date.now().toString();
    if (currentView.type === 'home') {
        openModal('New Phase', 'Phase ' + (appData.phases.length + 1), (val) => {
            if (val) {
                appData.phases.push({ id, title: val, subtitle: 'New Phase', goals: [], weeks: [] });
                saveData();
            }
        }, 'text');
    } else if (currentView.type === 'phase') {
        openModal('New Week', 'Week ' + String(appData.phases.find(x => x.id === currentView.phaseId).weeks.length + 1).padStart(2, '0'), (val) => {
            if (val) {
                const p = appData.phases.find(x => x.id === currentView.phaseId);
                p.weeks.push({ id, title: val, subtitle: 'New Week', objectives: [], days: [] });
                saveData();
            }
        }, 'text');
    } else if (currentView.type === 'week') {
        openModal('New Day', 'Day ' + String(appData.phases.find(x => x.id === currentView.phaseId).weeks.find(x => x.id === currentView.weekId).days.length + 1).padStart(2, '0'), (val) => {
            if (val) {
                const p = appData.phases.find(x => x.id === currentView.phaseId);
                const w = p.weeks.find(x => x.id === currentView.weekId);
                w.days.push({ id, title: val, assignedDate: '', tasks: [] });
                saveData();
            }
        }, 'text');
    }
}

function addListItem() {
    openModal('Add Item', '', (val) => {
        if (!val) return;
        const p = appData.phases.find(x => x.id === currentView.phaseId);
        if (currentView.type === 'phase') {
            p.goals.push({ text: val, completed: false });
        } else if (currentView.type === 'week') {
            p.weeks.find(x => x.id === currentView.weekId).objectives.push({ text: val, completed: false });
        } else if (currentView.type === 'day') {
            p.weeks.find(x => x.id === currentView.weekId).days.find(x => x.id === currentView.dayId).tasks.push({
                text: val,
                completed: false,
                notes: [],
                videos: [],
                priority: 'medium',
                tags: [],
                timeSpent: 0,
                dueDate: '',
                recurring: '',
                lastCompleted: ''
            });
        }
        saveData();
    }, 'text');
}

// === Progress Calculations ===
function calculateDayProgress(day) {
    if (!day.tasks || day.tasks.length === 0) return 0;
    return Math.round((day.tasks.filter(t => t.completed).length / day.tasks.length) * 100);
}

function calculateWeekProgress(week) {
    if (!week.days || week.days.length === 0) return 0;
    let total = 0;
    week.days.forEach(d => total += calculateDayProgress(d));
    return Math.round(total / week.days.length);
}

function calculatePhaseProgress(phase) {
    if (!phase.weeks || phase.weeks.length === 0) return 0;
    let total = 0;
    phase.weeks.forEach(w => total += calculateWeekProgress(w));
    return Math.round(total / phase.weeks.length);
}

function updateOverallProgress() {
    if (!appData.phases.length) {
        updateProgressBar(0);
        return;
    }
    let total = 0;
    appData.phases.forEach(p => total += calculatePhaseProgress(p));
    updateProgressBar(Math.round(total / appData.phases.length));
}

function updateProgressBar(percent) {
    const bar = document.getElementById('main-progress-bar');
    const text = document.getElementById('progress-text');
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.innerText = `${percent}%`;
}

// === Modal System ===
const modal = document.getElementById('input-modal');
const modalInput = document.getElementById('modal-input');
const modalDateInput = document.getElementById('modal-date-input');
let modalCallback = null;

function openModal(title, defaultVal, callback, inputType) {
    document.getElementById('modal-title').innerText = title;
    modalCallback = callback;
    modal.style.display = 'flex';
    if (inputType === 'date') {
        modalInput.classList.add('hidden');
        modalDateInput.classList.remove('hidden');
        modalDateInput.value = defaultVal;
        setTimeout(() => modalDateInput.focus(), 100);
    } else {
        modalDateInput.classList.add('hidden');
        modalInput.classList.remove('hidden');
        modalInput.value = defaultVal;
        setTimeout(() => modalInput.focus(), 100);
    }
}

// === Event Listeners ===
function setupEventListeners() {
    // Modal controls
    document.getElementById('modal-save').onclick = () => {
        const val = modalInput.classList.contains('hidden') ? modalDateInput.value : modalInput.value;
        if (modalCallback) modalCallback(val);
        modal.style.display = 'none';
    };
    document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
    
    // Enter key in modals
    modalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('modal-save').click();
    });
    
    // Sidebar actions
    document.getElementById('sidebar-add-btn').onclick = addItem;
    document.getElementById('add-item-btn').onclick = addListItem;
    
    // Subtitle editing
    document.getElementById('edit-subtitle-btn').onclick = () => {
        const subTitle = document.getElementById('page-subtitle').innerText;
        if (currentView.type === 'day') {
            openModal('Select Date', subTitle, (val) => {
                if (val) {
                    const p = appData.phases.find(x => x.id === currentView.phaseId);
                    const w = p.weeks.find(x => x.id === currentView.weekId);
                    const d = w.days.find(x => x.id === currentView.dayId);
                    d.assignedDate = val;
                    saveData();
                }
            }, 'date');
        } else {
            openModal('Edit Subtitle', subTitle, (val) => {
                if (val) {
                    const p = appData.phases.find(x => x.id === currentView.phaseId);
                    if (currentView.type === 'phase') p.subtitle = val;
                    else if (currentView.type === 'week') p.weeks.find(x => x.id === currentView.weekId).subtitle = val;
                    saveData();
                }
            }, 'text');
        }
    };
    
    // Settings modal
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('settings-btn').onclick = () => settingsModal.style.display = 'flex';
    document.querySelector('.close-modal').onclick = () => settingsModal.style.display = 'none';
    
    // Analytics
    document.getElementById('analytics-btn').onclick = () => navigateTo('analytics');
    
    // Archive
    document.getElementById('archive-btn').onclick = () => navigateTo('archive');
    
    // Export/Import
    document.getElementById('export-btn').onclick = () => {
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
        a.download = `friday_progress_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };
    
    document.getElementById('import-file').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                appData = JSON.parse(e.target.result);
                saveData();
                location.reload();
            } catch (err) {
                alert("Invalid file format.");
            }
        };
        reader.readAsText(e.target.files[0]);
    };
    
    // Task details - Notes & Videos
    document.getElementById('add-note-btn').onclick = addNote;
    document.getElementById('add-video-btn').onclick = addVideo;
    
    // Tag modal
    document.getElementById('tag-save').onclick = () => {
        const tagName = document.getElementById('tag-input').value.trim();
        if (!tagName) return;
        
        // Add to global tags if not exists
        if (!appData.tags.find(t => t.name === tagName)) {
            appData.tags.push({ name: tagName, color: selectedTagColor });
            updateTagFilter();
        }
        
        // Add to current task
        const phase = appData.phases.find(p => p.id === currentView.phaseId);
        const week = phase.weeks.find(w => w.id === currentView.weekId);
        const day = week.days.find(d => d.id === currentView.dayId);
        const task = day.tasks[currentView.taskId];
        
        if (!task.tags.includes(tagName)) {
            task.tags.push(tagName);
        }
        
        renderTaskTags(task);
        saveDataQuietly();
        document.getElementById('tag-modal').style.display = 'none';
    };
    
    document.getElementById('tag-cancel').onclick = () => {
        document.getElementById('tag-modal').style.display = 'none';
    };
    
    // Color picker for tags
    document.querySelectorAll('.color-option').forEach(el => {
        el.onclick = () => {
            selectedTagColor = el.getAttribute('data-color');
            document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
        };
    });
    
    // Search
    document.getElementById('global-search').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (currentView.type !== 'home' && currentView.type !== 'analytics' && currentView.type !== 'archive' && currentView.type !== 'task') {
            renderView();
        }
    });
    
    // Filters
    document.getElementById('filter-priority').addEventListener('change', (e) => {
        filterPriority = e.target.value;
        if (currentView.type === 'day') {
            renderView();
        }
    });
    
    document.getElementById('filter-tag').addEventListener('change', (e) => {
        filterTag = e.target.value;
        if (currentView.type === 'day') {
            renderView();
        }
    });
    
    // Pomodoro controls
    document.getElementById('timer-start').onclick = startPomodoroTimer;
    document.getElementById('timer-pause').onclick = pausePomodoroTimer;
    document.getElementById('timer-reset').onclick = resetPomodoroTimer;
}

// === Keyboard Shortcuts ===
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+N - New item
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (currentView.type !== 'analytics' && currentView.type !== 'archive') {
                if (currentView.type === 'home' || currentView.type === 'phase' || currentView.type === 'week') {
                    addItem();
                } else if (currentView.type === 'day') {
                    addListItem();
                }
            }
        }
        
        // Ctrl+F - Focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('global-search').focus();
        }
        
        // Ctrl+H - Home
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            navigateTo('home');
        }
        
        // Ctrl+T - Toggle theme
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            const themes = ['dark', 'blue', 'purple', 'green'];
            const currentIndex = themes.indexOf(appData.settings.theme || 'dark');
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            setTheme(nextTheme);
        }
        
        // Ctrl+E - Export
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            document.getElementById('export-btn').click();
        }
        
        // ? - Show shortcuts
        if (e.key === '?' && !e.ctrlKey && !e.shiftKey) {
            const panel = document.getElementById('shortcuts-panel');
            panel.classList.toggle('hidden');
        }
        
        // Escape - Close modals
        if (e.key === 'Escape') {
            document.getElementById('input-modal').style.display = 'none';
            document.getElementById('settings-modal').style.display = 'none';
            document.getElementById('tag-modal').style.display = 'none';
            document.getElementById('shortcuts-panel').classList.add('hidden');
            closePomodoroTimer();
        }
    });
}

// === Initialize on load ===
window.navigateTo = navigateTo;
window.openTagModal = openTagModal;
window.removeTaskTag = removeTaskTag;
window.deleteNote = deleteNote;
window.deleteVideo = deleteVideo;
window.startTaskTimer = startTaskTimer;
window.pauseTaskTimer = pauseTaskTimer;
window.openPomodoroTimer = openPomodoroTimer;
window.closePomodoroTimer = closePomodoroTimer;
window.setPomodoroTime = setPomodoroTime;
window.setTheme = setTheme;
window.clearArchive = clearArchive;
