// === Data Structure & State ===
let appData = { phases: [] };
let currentView = { type: 'home', phaseId: null, weekId: null, dayId: null, taskId: null };
let calendarDate = new Date(); 

// === Initial Load ===
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupCalendarControls();
    setupEventListeners();
    renderView();
});

// === Data Persistence ===
function loadData() {
    const saved = localStorage.getItem('fridayProgressTool');
    if (saved) appData = JSON.parse(saved);
}

function saveData() {
    localStorage.setItem('fridayProgressTool', JSON.stringify(appData));
    renderView(); 
}

function saveDataQuietly() {
    localStorage.setItem('fridayProgressTool', JSON.stringify(appData));
}

// === Navigation & Rendering ===
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
        if(!phase) return navigateTo('home');

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
            if(d.id === day.id) el.style.borderLeft = "4px solid var(--main-green)"; 
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
            if(idx === currentView.taskId) el.style.borderLeft = "4px solid var(--main-green)";
            sidebarList.appendChild(el);
        });

        document.getElementById('page-title').innerText = "Task Detail";
        subtitle.innerText = task.text;

        renderTaskDetails(task);
    }
}

// === Checklist Rendering ===
function renderChecklist(items, itemType) {
    const container = document.getElementById('main-list-container');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `task-item ${item.completed ? 'completed' : ''}`;
        
        const clickAction = itemType === 'task' ? `onclick="navigateTo('task', ${index})"` : '';

        div.innerHTML = `
            <div class="checkbox-custom"><i class="fas fa-check"></i></div>
            <span style="flex-grow:1; margin-left:10px; cursor:pointer;" ${clickAction}>${item.text}</span>
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
            openModal('Edit Item', item.text, (val) => { if(val) { item.text = val; saveData(); }}, 'text');
        });
        div.querySelector(`#del-${index}`).addEventListener('click', (e) => {
            e.stopPropagation();
            items.splice(index, 1); 
            saveData(); 
        });
        container.appendChild(div);
    });
}

// === Task Details (Notes & Videos) ===
function renderTaskDetails(task) {
    // === Data Migration: Convert old single note to array if needed ===
    if (typeof task.notes === 'string') {
        task.notes = task.notes ? [task.notes] : [];
    }
    if (!Array.isArray(task.notes)) task.notes = [];

    // === Data Migration: Convert old single video to array if needed ===
    if (!task.videos) task.videos = [];
    if (task.videoUrl) {
        task.videos.push(task.videoUrl);
        delete task.videoUrl; // Remove old key
    }

    // 1. Render Notes
    const notesContainer = document.getElementById('notes-list-container');
    notesContainer.innerHTML = '';

    task.notes.forEach((noteText, idx) => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-item';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'glass-input note-textarea';
        textarea.placeholder = "Write your note here...";
        textarea.value = noteText;
        textarea.oninput = () => { task.notes[idx] = textarea.value; saveDataQuietly(); };

        const delBtn = document.createElement('div');
        delBtn.className = 'delete-note-btn';
        delBtn.innerHTML = '<i class="fas fa-times"></i>';
        delBtn.onclick = () => { task.notes.splice(idx, 1); saveData(); };

        noteDiv.appendChild(textarea);
        noteDiv.appendChild(delBtn);
        notesContainer.appendChild(noteDiv);
    });

    document.getElementById('add-note-btn').onclick = () => {
        task.notes.push('');
        saveData();
    };

    // 2. Render Videos
    const videoContainer = document.getElementById('video-list-container');
    videoContainer.innerHTML = '';
    const urlInput = document.getElementById('youtube-url');
    urlInput.value = ''; // Reset input

    task.videos.forEach((vidUrl, idx) => {
        const videoId = extractYoutubeId(vidUrl);
        if(videoId) {
            const vidDiv = document.createElement('div');
            vidDiv.className = 'video-wrapper';
            vidDiv.innerHTML = `
                <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                <div class="delete-video-btn" onclick="deleteVideo(${idx})"><i class="fas fa-times"></i></div>
            `;
            videoContainer.appendChild(vidDiv);
        }
    });

    // Add Video Logic
    document.getElementById('add-video-btn').onclick = () => {
        const url = urlInput.value;
        if(url && extractYoutubeId(url)) {
            task.videos.push(url);
            saveData();
        } else {
            alert("Invalid YouTube URL");
        }
    };

    // Expose delete function to global scope due to onclick attribute usage in innerHTML
    window.deleteVideo = (idx) => {
        task.videos.splice(idx, 1);
        saveData();
    };
}

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// === Navigation ===
function navigateTo(viewType, id = null) {
    currentView.type = viewType;
    if(viewType === 'phase') currentView.phaseId = id;
    if(viewType === 'week') currentView.weekId = id;
    if(viewType === 'day') currentView.dayId = id;
    if(viewType === 'task') currentView.taskId = id;
    renderView();
}

// === Calendar Logic ===
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('calendar-month-year');
    if(!grid || !monthYear) return;

    grid.innerHTML = '';
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const today = new Date();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYear.innerText = `${monthNames[month]} ${year}`;

    const assignedDates = getAssignedDatesMap();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day empty';
        grid.appendChild(div);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.innerText = i;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        if (assignedDates[dateStr]) {
            div.classList.add('has-task');
            div.onclick = () => {
                const data = assignedDates[dateStr];
                currentView.phaseId = data.phaseId;
                currentView.weekId = data.weekId;
                navigateTo('day', data.dayId);
            };
        }
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            div.style.border = '2px solid var(--main-green)';
        }
        grid.appendChild(div);
    }
}

function setupCalendarControls() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn && nextBtn) {
        prevBtn.onclick = () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); };
        nextBtn.onclick = () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); };
    }
}

function getAssignedDatesMap() {
    let map = {};
    appData.phases.forEach(p => {
        p.weeks.forEach(w => {
            w.days.forEach(d => { if(d.assignedDate) map[d.assignedDate] = { phaseId: p.id, weekId: w.id, dayId: d.id }; });
        });
    });
    return map;
}

// === Core Logic (CRUD) ===
function createSidebarItem(text, id, clickHandler, type) {
    const div = document.createElement('div');
    div.className = 'nav-item';
    div.innerHTML = `
        <span class="item-text">${text}</span>
        <div class="action-icons">
            <i class="fas fa-pencil-alt" data-action="edit"></i>
            <i class="fas fa-trash" data-action="delete"></i>
        </div>
    `;
    div.querySelector('.item-text').addEventListener('click', clickHandler);
    div.querySelector('.fa-pencil-alt').addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('Edit Title', text, (newText) => { if(newText) updateItemTitle(type, id, newText); }, 'text');
    });
    div.querySelector('.fa-trash').addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm('Delete this?')) deleteItem(type, id);
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
        if(currentView.phaseId === id) navigateTo('home');
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
        openModal('New Phase', 'Phase ' + (appData.phases.length + 1), (val) => { if(val) { appData.phases.push({ id, title: val, subtitle: 'New Phase', goals: [], weeks: [] }); saveData(); }}, 'text');
    } else if (currentView.type === 'phase') {
        openModal('New Week', 'Week 01', (val) => { if(val) { const p = appData.phases.find(x => x.id === currentView.phaseId); p.weeks.push({ id, title: val, subtitle: 'New Week', objectives: [], days: [] }); saveData(); }}, 'text');
    } else if (currentView.type === 'week') {
        openModal('New Day', 'Day 01', (val) => { if(val) { const p = appData.phases.find(x => x.id === currentView.phaseId); const w = p.weeks.find(x => x.id === currentView.weekId); w.days.push({ id, title: val, assignedDate: '', tasks: [] }); saveData(); }}, 'text');
    }
}

function addListItem() {
    openModal('Add Item', '', (val) => {
        if(!val) return;
        const p = appData.phases.find(x => x.id === currentView.phaseId);
        if (currentView.type === 'phase') p.goals.push({ text: val, completed: false });
        else if (currentView.type === 'week') p.weeks.find(x => x.id === currentView.weekId).objectives.push({ text: val, completed: false });
        else if (currentView.type === 'day') p.weeks.find(x => x.id === currentView.weekId).days.find(x => x.id === currentView.dayId).tasks.push({ text: val, completed: false, notes: [], videos: [] });
        saveData();
    }, 'text');
}

// === Calculations ===
function calculateDayProgress(day) {
    if (!day.tasks || day.tasks.length === 0) return 0;
    return Math.round((day.tasks.filter(t => t.completed).length / day.tasks.length) * 100);
}
function calculateWeekProgress(week) {
    if (!week.days || week.days.length === 0) return 0;
    let total = 0; week.days.forEach(d => total += calculateDayProgress(d));
    return Math.round(total / week.days.length);
}
function calculatePhaseProgress(phase) {
    if (!phase.weeks || phase.weeks.length === 0) return 0;
    let total = 0; phase.weeks.forEach(w => total += calculatePhaseProgress(w));
    return Math.round(total / phase.weeks.length);
}
function updateOverallProgress() {
    if (!appData.phases.length) { updateProgressBar(0); return; }
    let total = 0; appData.phases.forEach(p => total += calculatePhaseProgress(p));
    updateProgressBar(Math.round(total / appData.phases.length));
}
function updateProgressBar(percent) {
    const bar = document.getElementById('main-progress-bar');
    const text = document.getElementById('progress-text');
    if(bar) bar.style.width = `${percent}%`;
    if(text) text.innerText = `${percent}%`;
}

// === Modal & Events ===
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
    } else {
        modalDateInput.classList.add('hidden');
        modalInput.classList.remove('hidden');
        modalInput.value = defaultVal;
    }
}

function setupEventListeners() {
    document.getElementById('modal-save').onclick = () => {
        const val = modalInput.classList.contains('hidden') ? modalDateInput.value : modalInput.value;
        if(modalCallback) modalCallback(val);
        modal.style.display = 'none';
    };
    document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
    document.getElementById('sidebar-add-btn').onclick = addItem;
    document.getElementById('add-item-btn').onclick = addListItem;

    document.getElementById('edit-subtitle-btn').onclick = () => {
        const subTitle = document.getElementById('page-subtitle').innerText;
        if (currentView.type === 'day') {
            openModal('Select Date', subTitle, (val) => {
                if(val) {
                    const p = appData.phases.find(x => x.id === currentView.phaseId);
                    const w = p.weeks.find(x => x.id === currentView.weekId);
                    const d = w.days.find(x => x.id === currentView.dayId);
                    d.assignedDate = val; saveData();
                }
            }, 'date');
        } else {
            openModal('Edit Subtitle', subTitle, (val) => {
                if(val) {
                    const p = appData.phases.find(x => x.id === currentView.phaseId);
                    if (currentView.type === 'phase') p.subtitle = val;
                    else if (currentView.type === 'week') p.weeks.find(x => x.id === currentView.weekId).subtitle = val;
                    saveData();
                }
            }, 'text');
        }
    };

    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('settings-btn').onclick = () => settingsModal.style.display = 'flex';
    document.querySelector('.close-modal').onclick = () => settingsModal.style.display = 'none';
    document.getElementById('export-btn').onclick = () => {
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData));
        a.download = "friday_progress_backup.json";
        a.click();
    };
    document.getElementById('import-file').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try { appData = JSON.parse(e.target.result); saveData(); location.reload(); } catch (err) { alert("Invalid File."); }
        };
        reader.readAsText(e.target.files[0]);
    };
}