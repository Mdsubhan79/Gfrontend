import API from './api.js';
import SocketManager from './socket.js';

// Application State
const AppState = {
    currentUser: null,
    currentGoal: null,
    selectedMode: null,
    socketManager: null,
    dayTimer: null,
    teamInviteLink: null
};

// DOM Elements
const DOM = {
    landingSection: document.getElementById('landing-section'),
    modeSection: document.getElementById('mode-section'),
    goalSetupSection: document.getElementById('goal-setup-section'),
    teamLinkSection: document.getElementById('team-link-section'),
    progressSection: document.getElementById('progress-section'),
    congratsModal: document.getElementById('congrats-modal'),
    loadingSpinner: document.getElementById('loading-spinner'),
    toastContainer: document.getElementById('toast-container')
};

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    AppState.socketManager = new SocketManager();
    setupEventListeners();
    checkTeamInvite();

    const savedUser = localStorage.getItem('goalTrackerUser');

    if (savedUser) {
        AppState.currentUser = JSON.parse(savedUser);
        AppState.socketManager.connect(AppState.currentUser._id);

        const savedGoal = localStorage.getItem('currentGoal');
        if (savedGoal) {
            AppState.currentGoal = JSON.parse(savedGoal);
            try {
                const response = await API.getGoal(AppState.currentGoal._id);
                if (response.success) {
                    AppState.currentGoal = response.goal;
                    saveCurrentGoal(response.goal);

                    if (response.goal.mode === 'team' && response.goal.status === 'pending') {
                        await showTeamLinkSection();
                    } else if (response.goal.status === 'completed') {
                        showCongratulations();
                    } else {
                        await loadProgressSection();
                    }
                } else {
                    localStorage.removeItem('currentGoal');
                    AppState.currentGoal = null;
                    showModeSelection();
                }
            } catch (error) {
                console.error(error);
                showModeSelection();
            }
        } else {
            showModeSelection();
        }
    }
});

// EVENT LISTENERS
function setupEventListeners() {
    document.getElementById('registration-form').addEventListener('submit', handleRegistration);
    document.getElementById('solo-mode-btn').addEventListener('click', () => selectMode('solo'));
    document.getElementById('team-mode-btn').addEventListener('click', () => selectMode('team'));
    document.getElementById('goal-setup-form').addEventListener('submit', handleGoalSetup);
    document.getElementById('copy-link-btn')?.addEventListener('click', copyTeamLink);
    document.getElementById('start-team-btn')?.addEventListener('click', startTeamGoal);
    document.getElementById('day-task-form')?.addEventListener('submit', handleDayComplete);
    document.getElementById('new-goal-btn')?.addEventListener('click', resetApp);
    document.getElementById('create-new-goal-btn')?.addEventListener('click', resetApp);
    document.getElementById('view-old-goals-btn')?.addEventListener('click', showOldGoals);
    document.getElementById('close-old-goals')?.addEventListener('click', () => {
        document.getElementById('old-goals-modal').classList.add('hidden');
    });
    document.getElementById('back-btn')?.addEventListener('click', handleBackButton);
    setupSocketListeners();
}

// BACK BUTTON HANDLER
function handleBackButton() {
    if (!DOM.progressSection.classList.contains('hidden')) {
        hideAllSections();
        DOM.modeSection.classList.remove('hidden');
    } else if (!DOM.goalSetupSection.classList.contains('hidden')) {
        hideAllSections();
        DOM.modeSection.classList.remove('hidden');
    } else if (!DOM.teamLinkSection.classList.contains('hidden')) {
        hideAllSections();
        DOM.modeSection.classList.remove('hidden');
    } else if (!DOM.modeSection.classList.contains('hidden')) {
        hideAllSections();
        DOM.landingSection.classList.remove('hidden');
    }
}

// SOCKET LISTENERS
function setupSocketListeners() {
    AppState.socketManager.on('teamMemberJoined', async () => {
        const response = await API.getGoal(AppState.currentGoal._id);
        if (response.success) {
            AppState.currentGoal = response.goal;
            saveCurrentGoal(response.goal);
            await showTeamLinkSection();
        }
    });

    AppState.socketManager.on('teamGoalStarted', async () => {
        showToast('Goal started!', 'success');
        await loadProgressSection();
    });

    AppState.socketManager.on('goalCompleted', () => {
        showCongratulations();
    });

    AppState.socketManager.on('teamProgressUpdated', async (data) => {
        try {
            const response = await API.getGoal(data.goal._id || data.goalId);
            if (response.success) {
                AppState.currentGoal = response.goal;
                saveCurrentGoal(response.goal);
                await loadProgressSection();
                loadProgressHistory();
            }
        } catch (error) {
            console.error('Live sync failed', error);
        }
    });
}

// CHECK TEAM INVITE
async function checkTeamInvite() {
    const params = new URLSearchParams(window.location.search);
    const teamLink = params.get('teamLink');
    if (!teamLink) return;

    AppState.teamInviteLink = teamLink;
    const savedUser = localStorage.getItem('goalTrackerUser');

    if (savedUser) {
        AppState.currentUser = JSON.parse(savedUser);
        try {
            showLoading(true);
            const response = await API.joinTeam({ teamLink, userId: AppState.currentUser._id });
            if (response.success) {
                AppState.currentGoal = response.goal;
                saveCurrentGoal(response.goal);
                showTeamLinkSection();
                showToast('Joined team successfully', 'success');
            } else {
                showToast(response.message || 'Failed to join', 'error');
            }
        } catch (error) {
            console.error(error);
        } finally {
            showLoading(false);
        }
    } else {
        showToast('Register to join team', 'info');
    }
}

// REGISTER
async function handleRegistration(e) {
    e.preventDefault();
    showLoading(true);

    const userData = {
        name: document.getElementById('reg-name').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        phoneNumber: document.getElementById('reg-phone').value.trim()
    };

    if (!userData.name || !userData.email || !userData.phoneNumber) {
        showToast('Please fill all fields', 'error');
        showLoading(false);
        return;
    }

    try {
        const response = await API.registerUser(userData);
        if (response.success) {
            AppState.currentUser = response.user;
            localStorage.setItem('goalTrackerUser', JSON.stringify(response.user));
            AppState.socketManager.connect(response.user._id);

            if (AppState.teamInviteLink) {
                await handleJoinTeam(AppState.teamInviteLink, response.user._id);
            } else {
                showModeSelection();
            }
        } else {
            showToast(response.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Registration failed', 'error');
    } finally {
        showLoading(false);
    }
}

// JOIN TEAM
async function handleJoinTeam(teamLink, userId) {
    try {
        const response = await API.joinTeam({ teamLink, userId });
        if (response.success) {
            AppState.currentGoal = response.goal;
            saveCurrentGoal(response.goal);
            showTeamLinkSection();
        } else {
            showToast(response.message || 'Failed to join', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Failed to join team', 'error');
    }
}

// SAVE GOAL
function saveCurrentGoal(goal) {
    AppState.currentGoal = goal;
    saveGoal(goal);
}

function saveGoal(goal) {
    let goals = JSON.parse(localStorage.getItem('allGoals') || '[]');
    goals = goals.filter(g => g._id !== goal._id);
    goals.unshift(goal);
    localStorage.setItem('allGoals', JSON.stringify(goals));
    localStorage.setItem('currentGoal', JSON.stringify(goal));
}

// MODE SELECTION
function showModeSelection() {
    hideAllSections();
    DOM.modeSection.classList.remove('hidden');
}

// SELECT MODE
function selectMode(mode) {
    AppState.selectedMode = mode;
    hideAllSections();
    DOM.goalSetupSection.classList.remove('hidden');

    const teamContainer = document.getElementById('team-size-container');
    if (mode === 'team') {
        teamContainer.classList.remove('hidden');
    } else {
        teamContainer.classList.add('hidden');
    }
}

// CREATE GOAL
async function handleGoalSetup(e) {
    e.preventDefault();
    showLoading(true);

    const goalName = document.getElementById('goal-name').value.trim();
    const totalDays = parseInt(document.getElementById('goal-days').value);

    if (!goalName || !totalDays || totalDays < 1 || totalDays > 365) {
        showToast('Please enter valid goal details', 'error');
        showLoading(false);
        return;
    }

    const goalData = {
        userId: AppState.currentUser._id,
        goalName: goalName,
        totalDays: totalDays,
        mode: AppState.selectedMode,
        maxTeamMembers: AppState.selectedMode === 'team' 
            ? (parseInt(document.getElementById('team-size').value) || 2) 
            : 1
    };

    try {
        const response = await API.createGoal(goalData);
        if (response.success) {
            AppState.currentGoal = response.goal;
            saveCurrentGoal(response.goal);

            if (AppState.selectedMode === 'solo') {
                showToast('Goal created! Start your journey!', 'success');
                await loadProgressSection();
            } else {
                showToast('Goal created! Share the link!', 'success');
                showTeamLinkSection();
            }
        } else {
            showToast(response.message || 'Failed to create goal', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Failed to create goal', 'error');
    } finally {
        showLoading(false);
    }
}

// SHOW TEAM SCREEN
async function showTeamLinkSection() {
    hideAllSections();
    DOM.teamLinkSection.classList.remove('hidden');

    if (AppState.currentGoal && AppState.currentGoal.teamLink) {
        const link = `${window.location.origin}${window.location.pathname}?teamLink=${AppState.currentGoal.teamLink}`;
        document.getElementById('team-link-input').value = link;
    }
    await updateTeamMembersList();
}

// COPY LINK
async function copyTeamLink() {
    const link = document.getElementById('team-link-input').value;
    try {
        await navigator.clipboard.writeText(link);
        showToast('Link copied!', 'success');
    } catch {
        document.getElementById('team-link-input').select();
        document.execCommand('copy');
        showToast('Link copied!', 'success');
    }
}

// UPDATE TEAM MEMBERS
async function updateTeamMembersList() {
    if (!AppState.currentGoal) return;

    try {
        const response = await API.getGoal(AppState.currentGoal._id);
        if (!response.success) return;

        const goal = response.goal;
        AppState.currentGoal = goal;
        saveCurrentGoal(goal);

        const list = document.getElementById('team-members-list');
        list.innerHTML = '';

        goal.teamMembers.forEach(member => {
            const div = document.createElement('div');
            div.className = 'bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 flex items-center justify-between';
            div.innerHTML = `
                <div class="flex items-center">
                    <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                        <span class="text-white font-bold text-lg">${(member.name || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800">${member.name || 'Unknown'}</p>
                        <p class="text-sm text-gray-500">${member.email || ''}</p>
                    </div>
                </div>
                <span class="text-green-600">
                    <i class="fas fa-check-circle"></i> Joined
                </span>
            `;
            list.appendChild(div);
        });

        // START BUTTON - only show for creator when team is full
        const startBtn = document.getElementById('start-team-btn');
        const creatorId = typeof goal.creator === 'object' ? goal.creator._id : goal.creator;
        const isCreator = creatorId.toString() === AppState.currentUser._id.toString();
        const isTeamFull = goal.teamMembers.length >= goal.maxTeamMembers;
        const isPending = goal.status === 'pending';

        if (startBtn) {
            startBtn.classList.toggle('hidden', !(isCreator && isTeamFull && isPending));
        }

    } catch (error) {
        console.error('Update team list error:', error);
    }
}

// START TEAM
async function startTeamGoal() {
    showLoading(true);
    try {
        const response = await API.startTeamGoal(AppState.currentGoal._id, AppState.currentUser._id);
        if (response.success) {
            AppState.currentGoal = response.goal;
            saveCurrentGoal(response.goal);
            showToast('Goal started!', 'success');
            await loadProgressSection();
        } else {
            showToast(response.message || 'Failed to start', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Failed to start goal', 'error');
    } finally {
        showLoading(false);
    }
}

// LOAD PROGRESS SECTION
async function loadProgressSection() {
    hideAllSections();
    showLoading(true);

    try {
        const response = await API.getGoal(AppState.currentGoal._id);
        if (!response.success) {
            showToast('Goal not found', 'error');
            return;
        }

        const goal = response.goal;
        AppState.currentGoal = goal;
        saveCurrentGoal(goal);

        // Check if completed
        if (goal.status === 'completed') {
            showCongratulations();
            return;
        }

        // Update UI elements
        document.getElementById('current-goal-name').textContent = goal.goalName;
        document.getElementById('goal-mode-display').textContent = 
            goal.mode === 'solo' ? '🎯 Solo Goal' : '👥 Team Goal';

        const completedDays = getCompletedDaysCount();
        const totalDays = goal.totalDays;

        document.getElementById('days-progress').textContent = `Day ${completedDays + 1} / ${totalDays}`;
        document.getElementById('days-left-display').textContent = `${totalDays - completedDays} days remaining`;

        // Progress bar
        const progressPercent = Math.min((completedDays / totalDays) * 100, 100);
        document.getElementById('overall-progress-bar').style.width = `${progressPercent}%`;

        document.getElementById('current-day-title').textContent = `Day ${completedDays + 1}: What's Your Plan?`;

        // Delete button visibility
        const deleteBtn = document.getElementById('delete-goal-btn');
        if (deleteBtn) {
            const creatorId = typeof goal.creator === 'object' ? goal.creator._id : goal.creator;
            deleteBtn.classList.toggle('hidden', goal.mode === 'team' && creatorId.toString() !== AppState.currentUser._id.toString());
        }

        // Check 24-hour timer
        if (!checkDayUnlocked()) {
            document.getElementById('current-day-section').classList.add('hidden');
            document.getElementById('next-day-timer').classList.remove('hidden');
            startDayTimer();
        } else {
            document.getElementById('current-day-section').classList.remove('hidden');
            document.getElementById('next-day-timer').classList.add('hidden');
            clearInterval(AppState.dayTimer);
        }

        // Team progress
        if (goal.mode === 'team') {
            document.getElementById('team-progress-section').classList.remove('hidden');
            updateTeamProgressGrid(goal);
        } else {
            document.getElementById('team-progress-section').classList.add('hidden');
        }

        // Load history
        loadProgressHistory();

        DOM.progressSection.classList.remove('hidden');

    } catch (error) {
        console.error('Load progress error:', error);
        showToast('Failed to load progress', 'error');
    } finally {
        showLoading(false);
    }
}

// GET USER PROGRESS
function getCurrentUserProgress() {
    if (!AppState.currentGoal || !AppState.currentUser) return [];
    const goal = AppState.currentGoal;
    if (!goal.teamProgress) return [];

    const progressData = goal.teamProgress.find(tp => {
        if (!tp || !tp.userId) return false;
        const id = typeof tp.userId === 'object' ? (tp.userId._id || tp.userId.toString()) : tp.userId;
        return id.toString() === AppState.currentUser._id.toString();
    });

    return progressData?.userProgress || [];
}

// COUNT DAYS
function getCompletedDaysCount() {
    return getCurrentUserProgress().length;
}

// CHECK DAY UNLOCKED
function checkDayUnlocked() {
    const progress = getCurrentUserProgress();
    if (progress.length === 0) return true;

    const last = progress[progress.length - 1];
    if (!last || !last.completedAt) return true;

    const completed = new Date(last.completedAt).getTime();
    const now = Date.now();

    // 12 hour difference
    const diff = (now - completed) / (1000 * 60 * 60);

    return diff >= 12;
}

// TIMER
function startDayTimer() {
    clearInterval(AppState.dayTimer);
    updateDayTimer();
    AppState.dayTimer = setInterval(updateDayTimer, 1000);
}

function updateDayTimer() {
    const progress = getCurrentUserProgress();

    if (progress.length === 0) {
        clearInterval(AppState.dayTimer);
        return;
    }

    const last = progress[progress.length - 1];

    // 12 hour unlock timer
    const unlock = new Date(last.completedAt).getTime() + (12 * 60 * 60 * 1000);

    const diff = unlock - Date.now();

    if (diff <= 0) {
        clearInterval(AppState.dayTimer);
        loadProgressSection();
        return;
    }

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const timerDisplay = document.getElementById('timer-display');

    if (timerDisplay) {
        timerDisplay.textContent =
            `${String(h).padStart(2, '0')}:` +
            `${String(m).padStart(2, '0')}:` +
            `${String(s).padStart(2, '0')}`;
    }
}
// COMPLETE DAY
async function handleDayComplete(e) {
    e.preventDefault();

    const taskInput = document.getElementById('day-task-input');
    const task = taskInput.value.trim();

    if (!task) {
        showToast('Please enter a task', 'warning');
        return;
    }

    if (!AppState.currentGoal || !AppState.currentUser) {
        showToast('No active goal', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await API.completeDay({
            goalId: AppState.currentGoal._id,
            userId: AppState.currentUser._id,
            task: task
        });

        if (response.success) {
            AppState.currentGoal = response.goal;
            saveCurrentGoal(response.goal);
            taskInput.value = '';

            if (response.goal.status === 'completed') {
                showCongratulations();
            } else {
                showToast('🎉 Day completed!', 'success');
                await loadProgressSection();
            }
        } else {
            showToast(response.message || 'Failed to complete day', 'error');
        }
    } catch (error) {
        console.error('Complete day error:', error);
        showToast('Failed to save progress', 'error');
    } finally {
        showLoading(false);
    }
}

// LOAD PROGRESS HISTORY
function loadProgressHistory() {
    const container = document.getElementById('progress-history');
    if (!container) return;

    container.innerHTML = '';

    if (!AppState.currentGoal) return;

    const goal = AppState.currentGoal;
    const userProgress = getCurrentUserProgress();

    if (userProgress.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-tasks text-4xl mb-3"></i>
                <p>No days completed yet. Start your journey!</p>
            </div>
        `;
        return;
    }

    // Show in reverse (newest first)
    [...userProgress].reverse().forEach(day => {
        const div = document.createElement('div');
        div.className = 'goal-card bg-white border-2 border-gray-100 rounded-xl p-4 mb-3 flex items-center';

        const completedDate = day.completedAt 
            ? new Date(day.completedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })
            : 'Just now';

        div.innerHTML = `
            <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mr-4">
                <i class="fas fa-check text-white text-xl"></i>
            </div>
            <div class="flex-grow">
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-gray-800">Day ${day.dayNumber}</p>
                    <span class="text-sm text-gray-500">${completedDate}</span>
                </div>
                <p class="text-gray-600 mt-1">${day.task || 'No description'}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

// UPDATE TEAM PROGRESS GRID
function updateTeamProgressGrid(goal) {
    const grid = document.getElementById('team-progress-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!goal.teamMembers || !goal.teamProgress) return;

    goal.teamMembers.forEach(member => {
        const memberId = typeof member === 'object' ? (member._id || member.toString()) : member;
        const memberName = typeof member === 'object' ? (member.name || 'Unknown') : 'Unknown';

        const memberProgressData = goal.teamProgress.find(tp => {
            if (!tp || !tp.userId) return false;
            const id = typeof tp.userId === 'object' ? (tp.userId._id || tp.userId.toString()) : tp.userId;
            return id.toString() === memberId.toString();
        });

        const progress = memberProgressData?.userProgress || [];
        const completed = progress.length;
        const pct = goal.totalDays > 0 ? (completed / goal.totalDays) * 100 : 0;

        const card = document.createElement('div');
        card.className = 'bg-gradient-to-br from-gray-50 to-indigo-50 rounded-xl p-4';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <span class="text-white font-bold">${memberName.charAt(0).toUpperCase()}</span>
                    </div>
                    <p class="font-semibold">${memberName}</p>
                </div>
                <span class="font-bold text-indigo-600">${completed}/${goal.totalDays}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full" style="width:${pct}%"></div>
            </div>
            <div class="text-sm text-gray-600">
                ${progress.slice(-2).map(d => `<p>Day ${d.dayNumber}: ${d.task}</p>`).join('')}
                ${progress.length === 0 ? '<p class="text-gray-400">No progress yet</p>' : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// CONGRATS
function showCongratulations() {
    hideAllSections();
    DOM.congratsModal.classList.remove('hidden');
    DOM.congratsModal.classList.add('flex');

    if (AppState.currentGoal) {
        document.getElementById('completed-goal-name').textContent = `Goal: ${AppState.currentGoal.goalName}`;
    }

    localStorage.removeItem('currentGoal');
    AppState.currentGoal = null;
    clearInterval(AppState.dayTimer);
}

// RESET
function resetApp() {
    clearInterval(AppState.dayTimer);
    AppState.currentGoal = null;
    AppState.selectedMode = null;
    localStorage.removeItem('currentGoal');

    DOM.congratsModal.classList.add('hidden');
    DOM.congratsModal.classList.remove('flex');

    const goalForm = document.getElementById('goal-setup-form');
    const taskForm = document.getElementById('day-task-form');
    if (goalForm) goalForm.reset();
    if (taskForm) taskForm.reset();

    hideAllSections();
    DOM.modeSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Create your new goal 🚀', 'success');
}

// HIDE ALL
function hideAllSections() {
    DOM.landingSection.classList.add('hidden');
    DOM.modeSection.classList.add('hidden');
    DOM.goalSetupSection.classList.add('hidden');
    DOM.teamLinkSection.classList.add('hidden');
    DOM.progressSection.classList.add('hidden');
}

// LOADING
function showLoading(show) {
    if (show) {
        DOM.loadingSpinner.classList.remove('hidden');
        DOM.loadingSpinner.classList.add('flex');
    } else {
        DOM.loadingSpinner.classList.add('hidden');
        DOM.loadingSpinner.classList.remove('flex');
    }
}

// TOAST
function showToast(message, type = 'info') {
    const bgColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-indigo-600'
    };

    const div = document.createElement('div');
    div.className = `toast-enter ${bgColors[type] || bgColors.info} text-white px-5 py-3 rounded-xl shadow-lg`;
    div.textContent = message;
    DOM.toastContainer.appendChild(div);

    setTimeout(() => {
        div.classList.add('toast-exit');
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// SHOW OLD GOALS
function showOldGoals() {
    const modal = document.getElementById('old-goals-modal');
    const list = document.getElementById('old-goals-list');
    const goals = JSON.parse(localStorage.getItem('allGoals') || '[]');

    list.innerHTML = '';

    if (goals.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center py-8">No goals found</p>';
    } else {
        goals.forEach(goal => {
            const div = document.createElement('div');
            div.className = 'border rounded-2xl p-4 shadow-md bg-white';
            div.innerHTML = `
                <div class="flex justify-between items-start gap-3">
                    <div class="flex-1 cursor-pointer" data-goal-id="${goal._id}">
                        <h3 class="font-bold text-xl text-indigo-700">${goal.goalName}</h3>
                        <p class="text-gray-600">Days: ${goal.totalDays} | Mode: ${goal.mode} | Status: ${goal.status}</p>
                    </div>
                    <button class="delete-old-goal-btn bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700" data-goal-id="${goal._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Open goal on click
            div.querySelector('[data-goal-id]').addEventListener('click', async (e) => {
                const goalId = e.currentTarget.getAttribute('data-goal-id');
                await openOldGoal(goalId);
            });

            // Delete goal
            div.querySelector('.delete-old-goal-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                const goalId = e.currentTarget.getAttribute('data-goal-id');
                if (confirm('Delete this goal permanently?')) {
                    let allGoals = JSON.parse(localStorage.getItem('allGoals') || '[]');
                    allGoals = allGoals.filter(g => g._id !== goalId);
                    localStorage.setItem('allGoals', JSON.stringify(allGoals));
                    if (AppState.currentGoal && AppState.currentGoal._id === goalId) {
                        AppState.currentGoal = null;
                        localStorage.removeItem('currentGoal');
                    }
                    showToast('Goal deleted', 'success');
                    showOldGoals();
                }
            });

            list.appendChild(div);
        });
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// OPEN OLD GOAL
async function openOldGoal(goalId) {
    try {
        showLoading(true);
        const response = await API.getGoal(goalId);
        if (!response.success) {
            showToast('Goal not found', 'error');
            return;
        }

        AppState.currentGoal = response.goal;
        saveCurrentGoal(response.goal);

        document.getElementById('old-goals-modal').classList.add('hidden');

        if (response.goal.mode === 'team' && response.goal.status === 'pending') {
            await showTeamLinkSection();
        } else if (response.goal.status === 'completed') {
            showCongratulations();
        } else {
            await loadProgressSection();
        }

        showToast('Goal loaded', 'success');
    } catch (error) {
        console.error(error);
        showToast('Failed to open goal', 'error');
    } finally {
        showLoading(false);
    }
}