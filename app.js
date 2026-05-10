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

                const response = await API.getGoal(
                    AppState.currentGoal._id
                );

                if (response.success) {

                    AppState.currentGoal = response.goal;

                    saveCurrentGoal(response.goal);

                    if (response.goal.status === 'completed') {

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

    } else {

        hideAllSections();

        DOM.landingSection.classList.remove('hidden');
    }
});

// EVENT LISTENERS
function setupEventListeners() {

    document
        .getElementById('registration-form')
        .addEventListener('submit', handleRegistration);

    document
        .getElementById('solo-mode-btn')
        .addEventListener('click', () => selectMode('solo'));

    document
        .getElementById('team-mode-btn')
        .addEventListener('click', () => selectMode('team'));

    document
        .getElementById('goal-setup-form')
        .addEventListener('submit', handleGoalSetup);

    document
        .getElementById('copy-link-btn')
        ?.addEventListener('click', copyTeamLink);

    document
        .getElementById('start-team-btn')
        ?.addEventListener('click', startTeamGoal);

    document
        .getElementById('day-task-form')
        ?.addEventListener('submit', handleDayComplete);

    document
        .getElementById('new-goal-btn')
        ?.addEventListener('click', resetApp);

    document
       .getElementById('create-new-goal-btn')
       ?.addEventListener('click', resetApp);

    document
    .getElementById('delete-goal-btn')
    ?.addEventListener('click', deleteGoal);

    document
.getElementById('view-old-goals-btn')
?.addEventListener('click', showOldGoals);

document
.getElementById('close-old-goals')
?.addEventListener('click', () => {

    document
    .getElementById('old-goals-modal')
    .classList.add('hidden');
});

    setupSocketListeners();
}

// SOCKETS
function setupSocketListeners() {

    AppState.socketManager.on('teamMemberJoined', () => {

        showToast('Team member joined!', 'success');

        updateTeamMembersList();
    });

    AppState.socketManager.on('teamGoalStarted', async () => {

        showToast('Goal started!', 'success');

        await loadProgressSection();
    });

    AppState.socketManager.on('goalCompleted', () => {

        showCongratulations();
    });
}

// TEAM INVITE
function checkTeamInvite() {

    const params = new URLSearchParams(window.location.search);

    const teamLink = params.get('teamLink');

    if (teamLink) {

        AppState.teamInviteLink = teamLink;

        showToast('Complete registration to join team', 'info');
    }
}

// REGISTER
async function handleRegistration(e) {

    e.preventDefault();

    showLoading(true);

    const userData = {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        phoneNumber: document.getElementById('reg-phone').value
    };

    try {

        const response = await API.registerUser(userData);

        if (response.success) {

            AppState.currentUser = response.user;

            localStorage.setItem(
                'goalTrackerUser',
                JSON.stringify(response.user)
            );

            AppState.socketManager.connect(response.user._id);

            if (AppState.teamInviteLink) {

                await handleJoinTeam(
                    AppState.teamInviteLink,
                    response.user._id
                );

            } else {

                showModeSelection();
            }

        } else {

            showToast(response.message, 'error');
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

        const response = await API.joinTeam({
            teamLink,
            userId
        });

        if (response.success) {

            AppState.currentGoal = response.goal;

            saveCurrentGoal(response.goal);

            showTeamLinkSection();

        } else {

            showToast(response.message, 'error');
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

    const teamContainer =
        document.getElementById('team-size-container');

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

    const goalData = {
        userId: AppState.currentUser._id,
        goalName: document.getElementById('goal-name').value,
        totalDays: parseInt(
            document.getElementById('goal-days').value
        ),
        mode: AppState.selectedMode,
        maxTeamMembers:
            AppState.selectedMode === 'team'
                ? parseInt(document.getElementById('team-size').value)
                : 1
    };

    try {

        const response = await API.createGoal(goalData);

        if (response.success) {

            AppState.currentGoal = response.goal;

            saveCurrentGoal(response.goal);

            if (goalData.mode === 'solo') {

                await loadProgressSection();

            } else {

                showTeamLinkSection();
            }

        } else {

            showToast(response.message, 'error');
        }

    } catch (error) {

        console.error(error);

        showToast('Failed to create goal', 'error');

    } finally {

        showLoading(false);
    }
}

// TEAM LINK
function showTeamLinkSection() {

    hideAllSections();

    DOM.teamLinkSection.classList.remove('hidden');

    const link =
        `${window.location.origin}?teamLink=${AppState.currentGoal.teamLink}`;

    document.getElementById('team-link-input').value = link;

    updateTeamMembersList();
}

// COPY LINK
async function copyTeamLink() {

    const link =
        document.getElementById('team-link-input').value;

    await navigator.clipboard.writeText(link);

    showToast('Link copied!', 'success');
}

// TEAM LIST
async function updateTeamMembersList() {

    const response = await API.getGoal(
        AppState.currentGoal._id
    );

    const goal = response.goal;

    const list =
        document.getElementById('team-members-list');

    list.innerHTML = '';

    goal.teamMembers.forEach(member => {

        const div = document.createElement('div');

        div.className =
            'bg-gray-100 p-4 rounded-xl mb-3';

        div.innerHTML = `
            <p class="font-bold">${member.name}</p>
            <p>${member.email}</p>
        `;

        list.appendChild(div);
    });

    if (
        goal.teamMembers.length >=
        goal.maxTeamMembers
    ) {

        document
            .getElementById('start-team-btn')
            .classList.remove('hidden');
    }
}

// START TEAM
async function startTeamGoal() {

    const response = await API.startTeamGoal(
        AppState.currentGoal._id,
        AppState.currentUser._id
    );

    if (response.success) {

        AppState.currentGoal = response.goal;

        saveCurrentGoal(response.goal);

        await loadProgressSection();
    }
}

// LOAD PROGRESS
async function loadProgressSection() {

    hideAllSections();

    DOM.progressSection.classList.remove('hidden');

    const response = await API.getGoal(
        AppState.currentGoal._id
    );

    if (!response.success) {

        showToast('Goal not found', 'error');

        return;
    }

    AppState.currentGoal = response.goal;

    saveCurrentGoal(response.goal);

    const goal = response.goal;

    document.getElementById('current-goal-name')
        .textContent = goal.goalName;

    const completedDays = getCompletedDaysCount();

    document.getElementById('days-progress')
        .textContent =
        `Day ${completedDays + 1}/${goal.totalDays}`;

    document.getElementById('days-left-display')
        .textContent =
        `${goal.totalDays - completedDays} days left`;

    document.getElementById('overall-progress-bar')
        .style.width =
        `${(completedDays / goal.totalDays) * 100}%`;

    document.getElementById('current-day-title')
        .textContent =
        `Day ${completedDays + 1}`;


    const deleteBtn =
    document.getElementById('delete-goal-btn');

// SOLO = always show
if (goal.mode === 'solo') {

    deleteBtn.classList.remove('hidden');

} else {

    // TEAM = only creator
    if (
        goal.creator._id.toString() ===
        AppState.currentUser._id.toString()
    ) {

        deleteBtn.classList.remove('hidden');

    } else {

        deleteBtn.classList.add('hidden');
    }
}

    loadProgressHistory();

    if (!checkDayUnlocked()) {

        document
            .getElementById('current-day-section')
            .classList.add('hidden');

        document
            .getElementById('next-day-timer')
            .classList.remove('hidden');

        startDayTimer();

    } else {

        document
            .getElementById('current-day-section')
            .classList.remove('hidden');

        document
            .getElementById('next-day-timer')
            .classList.add('hidden');
    }
}

// GET USER PROGRESS
function getCurrentUserProgress() {

    const goal = AppState.currentGoal;

    if (!goal || !goal.teamProgress)
        return [];

    const progressData =
        goal.teamProgress.find(tp => {

            const id =
                typeof tp.userId === 'object'
                    ? tp.userId._id
                    : tp.userId;

            return (
                id.toString() ===
                AppState.currentUser._id.toString()
            );
        });

    return progressData?.userProgress || [];
}

// COUNT DAYS
function getCompletedDaysCount() {

    return getCurrentUserProgress().length;
}

// CHECK DAY
function checkDayUnlocked() {

    const progress = getCurrentUserProgress();

    if (progress.length === 0)
        return true;

    const last =
        progress[progress.length - 1];

    const completed =
        new Date(last.completedAt).getTime();

    const now = Date.now();

    const diff =
        (now - completed) /
        (1000 * 60 * 60);

    return diff >= 24;
}

// TIMER
function startDayTimer() {

    clearInterval(AppState.dayTimer);

    updateDayTimer();

    AppState.dayTimer =
        setInterval(updateDayTimer, 1000);
}

function updateDayTimer() {

    const progress = getCurrentUserProgress();

    if (progress.length === 0)
        return;

    const last =
        progress[progress.length - 1];

    const unlock =
        new Date(last.completedAt).getTime() +
        24 * 60 * 60 * 1000;

    const diff = unlock - Date.now();

    if (diff <= 0) {

        clearInterval(AppState.dayTimer);

        loadProgressSection();

        return;
    }

    const h =
        Math.floor(diff / (1000 * 60 * 60));

    const m =
        Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const s =
        Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('timer-display')
        .textContent =
        `${h}h ${m}m ${s}s`;
}

// COMPLETE DAY
async function handleDayComplete(e) {

    e.preventDefault();

    const task =
        document.getElementById('day-task-input').value;

    if (!task) {

        showToast('Enter task', 'warning');

        return;
    }

    showLoading(true);

    try {

        const response = await API.completeDay({
            goalId: AppState.currentGoal._id,
            userId: AppState.currentUser._id,
            task
        });

        if (response.success) {

            AppState.currentGoal = response.goal;

            saveCurrentGoal(response.goal);

            loadProgressHistory();

            document.getElementById('day-task-input').value = '';

            if (response.goal.status === 'completed') {

                showCongratulations();

            } else {

                showToast('Day completed!', 'success');

                await loadProgressSection();
            }

        } else {

            showToast(response.message, 'error');
        }

    } catch (error) {

        console.error(error);

        showToast('Failed to save day', 'error');

    } finally {

        showLoading(false);
    }
}

// HISTORY
function loadProgressHistory() {

    const container =
        document.getElementById('progress-history');

    container.innerHTML = '';

    const progress =
        getCurrentUserProgress();

    if (progress.length === 0) {

        container.innerHTML = `
            <div class="text-center py-8">
                No progress yet
            </div>
        `;

        return;
    }

    [...progress].reverse().forEach(day => {

        const div = document.createElement('div');

        div.className =
            'bg-white border rounded-xl p-4 mb-3';

        div.innerHTML = `
            <h3 class="font-bold">
                Day ${day.dayNumber}
            </h3>

            <p>${day.task}</p>

            <small>
                ${new Date(day.completedAt).toLocaleString()}
            </small>
        `;

        container.appendChild(div);
    });
}

// CONGRATS
function showCongratulations() {

    DOM.congratsModal.classList.remove('hidden');

    DOM.congratsModal.classList.add('flex');

    document.getElementById(
        'completed-goal-name'
    ).textContent =
        AppState.currentGoal.goalName;

    localStorage.removeItem('currentGoal');
}

// RESET
function resetApp() {

    clearInterval(AppState.dayTimer);

    // reset state
    AppState.currentGoal = null;

    AppState.selectedMode = null;

    // remove old goal
    localStorage.removeItem('currentGoal');

    // hide modal
    DOM.congratsModal.classList.add('hidden');

    DOM.congratsModal.classList.remove('flex');

    // clear forms
    document.getElementById('goal-setup-form').reset();

    document.getElementById('day-task-form').reset();

    // reset sections
    hideAllSections();

    // show mode selection
    DOM.modeSection.classList.remove('hidden');

    // scroll top
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    showToast('Create your new goal 🚀', 'success');
}
// ======================================================
// DELETE OLD GOAL
// ======================================================

window.deleteOldGoal = function(goalId) {

    const confirmDelete =
        confirm(
            'Are you sure you want to delete this goal permanently?'
        );

    if (!confirmDelete) return;

    let goals =
        JSON.parse(
            localStorage.getItem('allGoals')
        ) || [];

    // remove goal
    goals =
        goals.filter(
            goal => goal._id !== goalId
        );

    // save updated list
    localStorage.setItem(
        'allGoals',
        JSON.stringify(goals)
    );

    // remove current goal if same
    if (
        AppState.currentGoal &&
        AppState.currentGoal._id === goalId
    ) {

        AppState.currentGoal = null;

        localStorage.removeItem(
            'currentGoal'
        );
    }

    showToast(
        'Goal deleted permanently',
        'success'
    );

    // refresh modal
    showOldGoals();
};
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

    } else {

        DOM.loadingSpinner.classList.add('hidden');
    }
}

// TOAST
function showToast(message, type = 'info') {

    const div = document.createElement('div');

    div.className =
        'bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg';

    div.innerText = message;

    DOM.toastContainer.appendChild(div);

    setTimeout(() => {

        div.remove();

    }, 3000);
}


// ======================================================
// SAVE GOALS
// ======================================================

function saveGoal(goal) {

    let goals =
        JSON.parse(
            localStorage.getItem('allGoals')
        ) || [];

    // find existing goal index
    const existingIndex =
        goals.findIndex(
            g => g._id === goal._id
        );

    // update existing goal
    if (existingIndex !== -1) {

        goals[existingIndex] = goal;

    } else {

        // add new goal
        goals.push(goal);
    }

    // save updated goals
    localStorage.setItem(
        'allGoals',
        JSON.stringify(goals)
    );

    // save current goal
    localStorage.setItem(
        'currentGoal',
        JSON.stringify(goal)
    );
}
// ======================================================
// SHOW OLD GOALS
// ======================================================

function showOldGoals() {

    const modal =
        document.getElementById(
            'old-goals-modal'
        );

    const list =
        document.getElementById(
            'old-goals-list'
        );

    const goals =
        JSON.parse(
            localStorage.getItem('allGoals')
        ) || [];

    list.innerHTML = '';

    if (goals.length === 0) {

        list.innerHTML = `
            <p class="text-gray-500 text-center">
                No goals found
            </p>
        `;

    } else {

        goals.forEach(goal => {

            list.innerHTML += `

                <div class="border rounded-2xl p-4 shadow-md hover:shadow-lg transition-all bg-white">

                    <div class="flex justify-between items-start gap-3">

                        <div 
                        class="flex-1 cursor-pointer"
                        onclick="openOldGoal('${goal._id}')">

                            <h3 class="font-bold text-xl text-indigo-700">
                                ${goal.goalName}
                            </h3>

                            <p class="text-gray-600 mt-1">
                                Days: ${goal.totalDays}
                            </p>

                            <p class="text-gray-600">
                                Mode: ${goal.mode}
                            </p>

                            <p class="text-gray-600">
                                Status: ${goal.status}
                            </p>

                        </div>

                        <button
                        onclick="deleteOldGoal('${goal._id}')"
                        class="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-all">

                            <i class="fas fa-trash"></i>

                        </button>

                    </div>

                </div>
            `;
        });
    }

    modal.classList.remove('hidden');

    modal.classList.add('flex');
}
// ======================================================
// OPEN OLD GOAL
// ======================================================

window.openOldGoal = function(goalId) {

    try {

        const goals =
            JSON.parse(
                localStorage.getItem('allGoals')
            ) || [];

        const selectedGoal =
            goals.find(
                goal => goal._id === goalId
            );

        if (!selectedGoal) {

            showToast(
                'Goal not found',
                'error'
            );

            return;
        }

        // set active goal
        AppState.currentGoal =
            selectedGoal;

        // save current goal
        localStorage.setItem(
            'currentGoal',
            JSON.stringify(selectedGoal)
        );

        // close modal
        document
            .getElementById('old-goals-modal')
            .classList.add('hidden');

        // load goal section
        loadProgressSection();

        showToast(
            'Goal loaded',
            'success'
        );

    } catch (error) {

        console.error(error);

        showToast(
            'Failed to open goal',
            'error'
        );
    }
};


document
.getElementById('back-btn')
?.addEventListener('click', () => {

    // hide all sections
    hideAllSections();

    // show previous screen
    if (AppState.currentGoal) {

        DOM.progressSection.classList.remove('hidden');

    } else if (AppState.selectedMode) {

        DOM.goalSetupSection.classList.remove('hidden');

    } else {

        DOM.modeSection.classList.remove('hidden');
    }
});

document
.getElementById('back-btn')
?.addEventListener('click', () => {

    // progress -> mode
    if (
        !DOM.progressSection.classList.contains('hidden')
    ) {

        DOM.progressSection.classList.add('hidden');

        DOM.modeSection.classList.remove('hidden');

        return;
    }

    // setup -> mode
    if (
        !DOM.goalSetupSection.classList.contains('hidden')
    ) {

        DOM.goalSetupSection.classList.add('hidden');

        DOM.modeSection.classList.remove('hidden');

        return;
    }

    // mode -> landing
    if (
        !DOM.modeSection.classList.contains('hidden')
    ) {

        DOM.modeSection.classList.add('hidden');

        DOM.landingSection.classList.remove('hidden');

        return;
    }
});