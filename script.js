// ============================================================
// PROGRESS TRACKER PRO - Enhanced Features with Drag & Drop
// ============================================================

// === Data Structure & State ===
let appData = { 
    phases: [],
    settings: {
        theme: 'dark',
        lastActivity: null
    }
};

let currentView = { type: 'home', phaseId: null, weekId: null, dayId: null };
let calendarDate = new Date();
let searchQuery = '';
let currentMaterialsTab = 'notes';

// Time tracking state (now for entire day)
let dayTimerInterval = null;
let dayTimerStartTime = null;
let dayTimerElapsed = 0;

// Pomodoro state
let pomodoroTimer = null;
let pomodoroInterval = null;
let pomodoroMinutes = 25;
let pomodoroSeconds = 0;
let pomodoroRunning = false;

// Drag and drop state
let draggedElement = null;
let draggedIndex = null;

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
});

// === Data Persistence ===
function loadData() {
    const saved = localStorage.getItem('fridayProgressToolPro');
    if (saved) {
        const parsed = JSON.parse(saved);
        appData = { ...appData, ...parsed };
    }
    
    // Data migration: ensure all items have new simplified structure
    appData.phases.forEach(phase => {
        phase.weeks?.forEach(week => {
            week.days?.forEach(day => {
                // Initialize day-level properties
                if (!day.timeSpent) day.timeSpent = 0;
                if (!day.notes) day.notes = [];
                if (!day.videos) day.videos = [];
                if (!day.files) day.files = [];
                if (!day.links) day.links = [];
                
                // Simplify tasks - remove old complex properties
                day.tasks?.forEach(task => {
                    // Keep only text and completed
                    const simplified = {
                        text: task.text,
                        completed: task.completed || false
                    };
                    Object.assign(task, simplified);
                    // Remove old properties
                    delete task.priority;
                    delete task.tags;
                    delete task.timeSpent;
                    delete task.dueDate;
                    delete task.recurring;
                    delete task.lastCompleted;
                    delete task.notes;
                    delete task.videos;
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
    
    if (type === 'analytics') {
        currentView = { type: 'analytics' };
        renderAnalytics();
        return;
    }
    
    if (type === 'materials') {
        currentView.type = 'materials';
        renderMaterialsPage();
        return;
    }
    
    if (type === 'home') {
        currentView = { type: 'home', phaseId: null, weekId: null, dayId: null };
    } else if (type === 'phase') {
        currentView.type = 'phase';
        currentView.phaseId = id;
        currentView.weekId = null;
        currentView.dayId = null;
    } else if (type === 'week') {
        currentView.type = 'week';
        currentView.weekId = id;
        currentView.dayId = null;
    } else if (type === 'day') {
        currentView.type = 'day';
        currentView.dayId = id;
    }
    
    renderView();
}

function navigateToMaterials() {
    navigateTo('materials');
}

function renderView() {
    const sidebarList = document.getElementById('sidebar-list');
    const sidebarTitle = document.getElementById('sidebar-title');
    const navHeader = document.getElementById('nav-header');
    const homeCalendar = document.getElementById('home-calendar-container');
    const listSection = document.getElementById('main-list-section');
    const dayActionsSection = document.getElementById('day-actions-section');
    const materialsPage = document.getElementById('materials-page');
    const subtitle = document.getElementById('page-subtitle');
    const editBtn = document.getElementById('edit-subtitle-btn');

    sidebarList.innerHTML = '';
    
    // Default visibility reset
    homeCalendar.style.display = 'none';
    listSection.style.display = 'block';
    dayActionsSection.style.display = 'none';
    materialsPage.style.display = 'none';
    editBtn.style.display = 'inline-block';

    if (currentView.type === 'home') {
        sidebarTitle.innerText = 'Phases';
        navHeader.innerHTML = '';
        
        appData.phases.forEach(phase => {
            const el = createSidebarItem(phase.title, phase.id, () => navigateTo('phase', phase.id), 'phase', isPhaseComplete(phase));
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
            const el = createSidebarItem(week.title, week.id, () => navigateTo('week', week.id), 'week', isWeekComplete(week));
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
            const el = createSidebarItem(day.title, day.id, () => navigateTo('day', day.id), 'day', isDayComplete(day));
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

        sidebarTitle.innerText = 'Days';
        navHeader.innerHTML = `<button class="back-btn" onclick="navigateTo('week', '${week.id}')"><i class="fas fa-arrow-left"></i> ${week.title}</button>`;

        week.days.forEach(d => {
            const el = createSidebarItem(d.title, d.id, () => navigateTo('day', d.id), 'day', isDayComplete(d));
            if (d.id === day.id) el.style.borderLeft = "4px solid var(--main-green)";
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = day.title;
        subtitle.innerText = day.assignedDate || 'Set Date';
        document.getElementById('list-title').innerText = 'Tasks';

        // Show tasks and day actions
        listSection.style.display = 'block';
        dayActionsSection.style.display = 'block';

        renderChecklist(day.tasks, 'task');
        updateProgressBar(calculateDayProgress(day));
        
        // Update day time display
        updateDayTimeDisplay(day);
    }
}

function renderMaterialsPage() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);

    // Hide other sections
    document.getElementById('home-calendar-container').style.display = 'none';
    document.getElementById('main-list-section').style.display = 'none';
    document.getElementById('day-actions-section').style.display = 'none';
    document.getElementById('analytics-dashboard').style.display = 'none';
    
    // Show materials page
    document.getElementById('materials-page').style.display = 'block';
    
    // Update header
    document.getElementById('page-title').innerText = 'Materials';
    document.getElementById('page-subtitle').innerText = day.title;
    document.getElementById('edit-subtitle-btn').style.display = 'none';
    
    // Update nav
    document.getElementById('nav-header').innerHTML = `<button class="back-btn" onclick="navigateTo('day', '${day.id}')"><i class="fas fa-arrow-left"></i> ${day.title}</button>`;
    
    // Render materials based on current tab
    switchMaterialsTab(currentMaterialsTab);
}

function switchMaterialsTab(tabName) {
    currentMaterialsTab = tabName;
    
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    // Update tab buttons
    document.querySelectorAll('.materials-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event?.target?.classList?.add('active');
    
    // Hide all tab contents
    document.querySelectorAll('.materials-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'notes') {
        document.getElementById('materials-notes').classList.add('active');
        renderNotes(day);
    } else if (tabName === 'videos') {
        document.getElementById('materials-videos').classList.add('active');
        renderVideos(day);
    } else if (tabName === 'files') {
        document.getElementById('materials-files').classList.add('active');
        renderFiles(day);
    } else if (tabName === 'links') {
        document.getElementById('materials-links').classList.add('active');
        renderLinks(day);
    }
}

// === Checklist Rendering with Drag & Drop ===
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
    
    filteredItems.forEach(({ item, index }) => {
        const div = document.createElement('div');
        div.className = `task-item ${item.completed ? 'completed' : ''}`;
        
        // Add drag and drop only for tasks
        if (itemType === 'task') {
            div.setAttribute('draggable', 'true');
            div.setAttribute('data-index', index);
            
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            div.addEventListener('dragend', handleDragEnd);
        }
        
        div.innerHTML = `
            <div class="drag-handle ${itemType === 'task' ? '' : 'hidden'}"><i class="fas fa-grip-vertical"></i></div>
            <div class="checkbox-custom"><i class="fas fa-check"></i></div>
            <div style="flex-grow:1; margin-left:10px;">
                <span>${item.text}</span>
            </div>
            <div class="action-icons">
                <i class="fas fa-pencil-alt" id="edit-${index}"></i>
                <i class="fas fa-trash" id="del-${index}"></i>
            </div>
        `;
        
        div.querySelector('.checkbox-custom').addEventListener('click', (e) => {
            e.stopPropagation();
            item.completed = !item.completed;
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
    
    if (filteredItems.length === 0 && searchQuery) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 20px;">No items match your search</p>';
    }
}

// === Drag and Drop Handlers ===
function handleDragStart(e) {
    draggedElement = this;
    draggedIndex = parseInt(this.getAttribute('data-index'));
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(this.parentElement, e.clientY);
    if (afterElement == null) {
        this.parentElement.appendChild(draggedElement);
    } else {
        this.parentElement.insertBefore(draggedElement, afterElement);
    }
    
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const dropIndex = parseInt(this.getAttribute('data-index'));
    
    if (draggedIndex !== dropIndex) {
        const phase = appData.phases.find(p => p.id === currentView.phaseId);
        const week = phase.weeks.find(w => w.id === currentView.weekId);
        const day = week.days.find(d => d.id === currentView.dayId);
        
        // Reorder the tasks array
        const tasks = day.tasks;
        const draggedTask = tasks[draggedIndex];
        tasks.splice(draggedIndex, 1);
        
        // Adjust drop index if dragging down
        const newIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        tasks.splice(newIndex, 0, draggedTask);
        
        saveData();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    draggedElement = null;
    draggedIndex = null;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// === Completion Check Functions ===
function isDayComplete(day) {
    if (!day.tasks || day.tasks.length === 0) return false;
    return day.tasks.every(task => task.completed);
}

function isWeekComplete(week) {
    if (!week.days || week.days.length === 0) return false;
    return week.days.every(day => isDayComplete(day));
}

function isPhaseComplete(phase) {
    if (!phase.weeks || phase.weeks.length === 0) return false;
    return phase.weeks.every(week => isWeekComplete(week));
}

// === Time Tracking (Day Level) ===
function updateDayTimeDisplay(day) {
    const timeSpent = day.timeSpent || 0;
    const hours = Math.floor(timeSpent / 3600);
    const minutes = Math.floor((timeSpent % 3600) / 60);
    document.getElementById('day-time-spent').innerText = `${hours}h ${minutes}m`;
}

function startDayTimer() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    if (dayTimerInterval) return; // Already running
    
    dayTimerStartTime = Date.now();
    dayTimerElapsed = 0;
    
    document.getElementById('start-day-timer-btn').classList.add('hidden');
    document.getElementById('pause-day-timer-btn').classList.remove('hidden');
    
    dayTimerInterval = setInterval(() => {
        dayTimerElapsed = Math.floor((Date.now() - dayTimerStartTime) / 1000);
        day.timeSpent = (day.timeSpent || 0) + 1;
        updateDayTimeDisplay(day);
        saveDataQuietly();
    }, 1000);
}

function pauseDayTimer() {
    if (dayTimerInterval) {
        clearInterval(dayTimerInterval);
        dayTimerInterval = null;
    }
    
    document.getElementById('start-day-timer-btn').classList.remove('hidden');
    document.getElementById('pause-day-timer-btn').classList.add('hidden');
}

// === Pomodoro Timer ===
function openPomodoroTimer() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    document.getElementById('timer-task-name').innerText = `Working on: ${day.title}`;
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

// === Notes Management ===
function renderNotes(day) {
    const container = document.getElementById('notes-list-container');
    container.innerHTML = '';
    
    if (!day.notes) day.notes = [];
    
    if (day.notes.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 20px;">No notes yet. Click + to add one.</p>';
        return;
    }
    
    day.notes.forEach((note, index) => {
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
            day.notes[index] = textarea.value;
            saveDataQuietly();
        });
        
        container.appendChild(noteDiv);
    });
}

function addNote() {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    if (!day.notes) day.notes = [];
    day.notes.push('');
    renderNotes(day);
    saveDataQuietly();
}

function deleteNote(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    day.notes.splice(index, 1);
    renderNotes(day);
    saveDataQuietly();
}

// === Videos Management ===
function renderVideos(day) {
    const container = document.getElementById('video-list-container');
    container.innerHTML = '';
    
    if (!day.videos) day.videos = [];
    
    if (day.videos.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 20px;">No videos yet. Add a YouTube link above.</p>';
        return;
    }
    
    day.videos.forEach((url, index) => {
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
    
    if (!day.videos) day.videos = [];
    day.videos.push(url);
    input.value = '';
    renderVideos(day);
    saveDataQuietly();
}

function deleteVideo(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    day.videos.splice(index, 1);
    renderVideos(day);
    saveDataQuietly();
}

function extractYouTubeID(url) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return match ? match[1] : null;
}

// === Files Management (Upload from Computer) ===
function renderFiles(day) {
    const container = document.getElementById('files-list-container');
    container.innerHTML = '';
    
    if (!day.files) day.files = [];
    
    if (day.files.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 20px;">No files yet. Click "Add Files" to upload.</p>';
        return;
    }
    
    day.files.forEach((file, index) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item glass-effect';
        
        // Determine file icon based on type
        let icon = 'fa-file';
        if (file.type) {
            if (file.type.startsWith('image/')) icon = 'fa-file-image';
            else if (file.type.startsWith('video/')) icon = 'fa-file-video';
            else if (file.type.startsWith('audio/')) icon = 'fa-file-audio';
            else if (file.type.includes('pdf')) icon = 'fa-file-pdf';
            else if (file.type.includes('word') || file.type.includes('document')) icon = 'fa-file-word';
            else if (file.type.includes('excel') || file.type.includes('sheet')) icon = 'fa-file-excel';
            else if (file.type.includes('powerpoint') || file.type.includes('presentation')) icon = 'fa-file-powerpoint';
            else if (file.type.includes('zip') || file.type.includes('compressed')) icon = 'fa-file-archive';
        }
        
        const fileSize = file.size ? formatFileSize(file.size) : '';
        
        fileDiv.innerHTML = `
            <div class="file-content" onclick="downloadFile(${index})" style="cursor: pointer;">
                <i class="fas ${icon}"></i>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    ${fileSize ? `<span class="file-size">${fileSize}</span>` : ''}
                </div>
            </div>
            <div class="delete-file-btn" onclick="deleteFile(${index})">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        container.appendChild(fileDiv);
    });
}

function addFiles() {
    const input = document.getElementById('file-upload-input');
    const files = input.files;
    
    if (files.length === 0) return;
    
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    if (!day.files) day.files = [];
    
    // Process each file
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            day.files.push({
                name: file.name,
                type: file.type,
                size: file.size,
                data: e.target.result // base64 data
            });
            renderFiles(day);
            saveDataQuietly();
        };
        reader.readAsDataURL(file);
    });
    
    // Reset input
    input.value = '';
}

function downloadFile(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    const file = day.files[index];
    
    // Create download link
    const a = document.createElement('a');
    a.href = file.data;
    a.download = file.name;
    a.click();
}

function deleteFile(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    day.files.splice(index, 1);
    renderFiles(day);
    saveDataQuietly();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// === Links Management (Website URLs) ===
function renderLinks(day) {
    const container = document.getElementById('links-list-container');
    container.innerHTML = '';
    
    if (!day.links) day.links = [];
    
    if (day.links.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; text-align: center; padding: 20px;">No links yet. Add a website link above.</p>';
        return;
    }
    
    day.links.forEach((link, index) => {
        const linkDiv = document.createElement('div');
        linkDiv.className = 'link-item glass-effect';
        
        linkDiv.innerHTML = `
            <div class="link-content" onclick="window.open('${link}', '_blank')" style="cursor: pointer;">
                <i class="fas fa-link"></i>
                <span>${link}</span>
            </div>
            <div class="delete-link-btn" onclick="deleteLink(${index})">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        container.appendChild(linkDiv);
    });
}

function addLink() {
    const input = document.getElementById('link-url');
    const url = input.value.trim();
    if (!url) return;
    
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
    }
    
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    if (!day.links) day.links = [];
    day.links.push(url);
    input.value = '';
    renderLinks(day);
    saveDataQuietly();
}

function deleteLink(index) {
    const phase = appData.phases.find(p => p.id === currentView.phaseId);
    const week = phase.weeks.find(w => w.id === currentView.weekId);
    const day = week.days.find(d => d.id === currentView.dayId);
    
    day.links.splice(index, 1);
    renderLinks(day);
    saveDataQuietly();
}

// === Analytics ===
function renderAnalytics() {
    document.getElementById('analytics-dashboard').style.display = 'block';
    document.getElementById('home-calendar-container').style.display = 'none';
    document.getElementById('main-list-section').style.display = 'none';
    document.getElementById('day-actions-section').style.display = 'none';
    document.getElementById('materials-page').style.display = 'none';
    
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
    
    // Calculate time spent per phase (now from day level)
    const phaseData = appData.phases.map(phase => {
        let totalTime = 0;
        phase.weeks?.forEach(week => {
            week.days?.forEach(day => {
                totalTime += day.timeSpent || 0;
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

// === Core CRUD Operations ===
function createSidebarItem(text, id, clickHandler, type, isComplete) {
    const div = document.createElement('div');
    div.className = 'nav-item';
    
    // Apply strikethrough if complete
    const textStyle = isComplete ? 'style="text-decoration: line-through; opacity: 0.7;"' : '';
    
    div.innerHTML = `
        <span class="item-text" ${textStyle}>${text}</span>
        <div class="action-icons">
            <i class="fas fa-pencil-alt" data-action="edit"></i>
            <i class="fas fa-trash" data-action="delete"></i>
        </div>
    `;
    div.querySelector('.item-text').addEventListener('click', clickHandler);
    div.querySelector('.fa-pencil-alt').addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('Edit Title', text, (newText) => { if (newText) updateItemTitle(type, id, newText); }, 'text');
    });
    div.querySelector('.fa-trash').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this item?')) deleteItem(type, id);
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
                w.days.push({ 
                    id, 
                    title: val, 
                    assignedDate: '', 
                    tasks: [],
                    timeSpent: 0,
                    notes: [],
                    videos: [],
                    files: [],
                    links: []
                });
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
                completed: false
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
    
    // Materials - Notes, Videos, Files, Links
    document.getElementById('add-note-btn').onclick = addNote;
    document.getElementById('add-video-btn').onclick = addVideo;
    document.getElementById('add-file-btn').onclick = () => {
        document.getElementById('file-upload-input').click();
    };
    document.getElementById('file-upload-input').onchange = addFiles;
    document.getElementById('add-link-btn').onclick = addLink;
    
    // Search
    document.getElementById('global-search').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (currentView.type !== 'home' && currentView.type !== 'analytics' && currentView.type !== 'materials') {
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
            if (currentView.type !== 'analytics' && currentView.type !== 'materials') {
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
            document.getElementById('shortcuts-panel').classList.add('hidden');
            closePomodoroTimer();
        }
    });
}

// === Initialize on load ===
window.navigateTo = navigateTo;
window.navigateToMaterials = navigateToMaterials;
window.switchMaterialsTab = switchMaterialsTab;
window.deleteNote = deleteNote;
window.deleteVideo = deleteVideo;
window.deleteFile = deleteFile;
window.downloadFile = downloadFile;
window.deleteLink = deleteLink;
window.startDayTimer = startDayTimer;
window.pauseDayTimer = pauseDayTimer;
window.openPomodoroTimer = openPomodoroTimer;
window.closePomodoroTimer = closePomodoroTimer;
window.setPomodoroTime = setPomodoroTime;
window.setTheme = setTheme;
