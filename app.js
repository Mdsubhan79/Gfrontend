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

                    // TEAM WAITING ROOM
if (
    response.goal.mode === 'team' &&
    response.goal.status === 'pending'
) {

    await showTeamLinkSection();
}

// COMPLETED
else if (
    response.goal.status === 'completed'
) {

    showCongratulations();
}

// ACTIVE GOAL
else {

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

    // check old goals
    const allGoals =
        JSON.parse(
            localStorage.getItem('allGoals')
        ) || [];

    // show mode screen
    showModeSelection();

    // optional auto-open latest goal
    // if you want later
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

// ===
// SOCKET LISTENERS
// ===

function setupSocketListeners() {

    AppState.socketManager.on(
    'teamMemberJoined',
    async () => {

        const response =
            await API.getGoal(
                AppState.currentGoal._id
            );

        if (response.success) {

            AppState.currentGoal =
                response.goal;

            saveCurrentGoal(
                response.goal
            );

            await showTeamLinkSection();
        }
    }
);

    AppState.socketManager.on(
        'teamGoalStarted',
        async () => {

            showToast(
                'Goal started!',
                'success'
            );

            await loadProgressSection();
        }
    );

    AppState.socketManager.on(
        'goalCompleted',
        () => {

            showCongratulations();
        }
    );
// ======================================
// LIVE TEAM UPDATE
// ======================================

AppState.socketManager.on(
    'teamProgressUpdated',
    async (data) => {

        try {

            // ALWAYS FETCH LATEST GOAL
            const response =
                await API.getGoal(
                    data.goal._id
                );

            if (!response.success)
                return;

            // UPDATE STATE
            AppState.currentGoal =
                response.goal;

            // SAVE
            saveGoal(response.goal);

            // FULL UI REFRESH
            await loadProgressSection();

            // FORCE HISTORY REFRESH
            loadProgressHistory();

        } catch (error) {

            console.error(
                'Realtime sync failed',
                error
            );
        }
    }
);
}
// ===
// CHECK TEAM INVITE
// ===

async function checkTeamInvite() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const teamLink =
        params.get('teamLink');

    if (!teamLink) return;

    AppState.teamInviteLink = teamLink;

    // already logged in
    const savedUser =
        localStorage.getItem(
            'goalTrackerUser'
        );

    if (savedUser) {

        AppState.currentUser =
            JSON.parse(savedUser);

        try {

            showLoading(true);

            // auto join
            const response =
                await API.joinTeam({
                    teamLink,
                    userId:
                    AppState.currentUser._id
                });

            if (response.success) {

                AppState.currentGoal =
                    response.goal;

                saveCurrentGoal(
                    response.goal
                );

                showTeamLinkSection();

                showToast(
                    'Joined team successfully',
                    'success'
                );

            } else {

                showToast(
                    response.message,
                    'error'
                );
            }

        } catch (error) {

            console.error(error);

        } finally {

            showLoading(false);
        }

    } else {

        // user not logged in
        showToast(
            'Register to join team',
            'info'
        );
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

// ===
// SHOW TEAM SCREEN
// ===

async function showTeamLinkSection() {

    hideAllSections();

    DOM.teamLinkSection
    .classList.remove('hidden');

    const link =
`${window.location.origin}?teamLink=${AppState.currentGoal.teamLink}`;

    document
    .getElementById(
        'team-link-input'
    ).value = link;

    await updateTeamMembersList();
}

// COPY LINK
async function copyTeamLink() {

    const link =
        document.getElementById('team-link-input').value;

    await navigator.clipboard.writeText(link);

    showToast('Link copied!', 'success');
}
// ===
// UPDATE TEAM MEMBERS
// ===

async function updateTeamMembersList() {

    const response =
        await API.getGoal(
            AppState.currentGoal._id
        );

    if (!response.success) return;

    const goal = response.goal;

    AppState.currentGoal = goal;

    saveCurrentGoal(goal);

    const list =
        document.getElementById(
            'team-members-list'
        );

    list.innerHTML = '';

    goal.teamMembers.forEach(member => {

        const div =
            document.createElement('div');

        div.className =
            'bg-gray-100 p-4 rounded-xl mb-3';

        div.innerHTML = `
            <div class="flex items-center justify-between">

                <div>
                    <p class="font-bold">
                        ${member.name}
                    </p>

                    <p class="text-sm text-gray-600">
                        ${member.email}
                    </p>
                </div>

                <div class="text-green-600">
                    <i class="fas fa-circle"></i>
                </div>

            </div>
        `;

        list.appendChild(div);
    });

    // START BUTTON LOGIC

    const startBtn =
        document.getElementById(
            'start-team-btn'
        );

    const creatorId =
        typeof goal.creator === 'object'
        ? goal.creator._id
        : goal.creator;

    // only creator sees button
    if (
        creatorId.toString() ===
        AppState.currentUser._id.toString()
    ) {

        if (
            goal.teamMembers.length >=
            goal.maxTeamMembers
        ) {

            startBtn.classList.remove(
                'hidden'
            );

        } else {

            startBtn.classList.add(
                'hidden'
            );
        }

    } else {

        startBtn.classList.add(
            'hidden'
        );
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

// ======================================================
// LOAD HISTORY
// ======================================================

function loadProgressHistory() {

    const container =
        document.getElementById(
            'progress-history'
        );

    container.innerHTML = '';

    const goal =
    structuredClone(AppState.currentGoal);
    if (!goal) return;

    // ==========================================
    // SOLO MODE
    // ==========================================

    if (goal.mode === 'solo') {

        const progress =
            getCurrentUserProgress();

        if (progress.length === 0) {

            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    No progress yet
                </div>
            `;

            return;
        }

        [...progress]
        .reverse()
        .forEach(day => {

            const div =
                document.createElement('div');

            div.className =
                'bg-white border rounded-xl p-4 mb-3 shadow';

            div.innerHTML = `

                <div class="flex justify-between items-center mb-2">

                    <h3 class="font-bold text-indigo-700">
                        Day ${day.dayNumber}
                    </h3>

                    <span class="text-green-600 text-sm">
                        Completed
                    </span>

                </div>

                <p class="text-gray-700 mb-2">
                    ${day.task}
                </p>

                <small class="text-gray-500">
                    ${new Date(day.completedAt)
                        .toLocaleString()}
                </small>
            `;

            container.appendChild(div);
        });

        return;
    }

    // ==========================================
    // TEAM MODE
    // ==========================================

    const totalDays =
        goal.totalDays;

    for (let day = 1; day <= totalDays; day++) {

        const dayBox =
            document.createElement('div');

        dayBox.className =
            'bg-gray-50 border rounded-2xl p-4 mb-5';

        dayBox.innerHTML = `
            <h2 class="text-xl font-bold text-indigo-700 mb-4">
                Day ${day}
            </h2>
        `;

        goal.teamMembers.forEach(member => {

            // find member progress
            const memberProgress =
                goal.teamProgress.find(tp => {

                    const id =
                        tp.userId._id
                            ? tp.userId._id.toString()
                            : tp.userId.toString();

                    return (
                        id === member._id.toString()
                    );
                });

            // find current day task
            const dayTask =
                memberProgress?.userProgress
                    ?.find(
                        p => p.dayNumber === day
                    );

            const taskDiv =
                document.createElement('div');

            taskDiv.className =
                'bg-white rounded-xl p-4 mb-3 shadow-sm';

            // completed
            if (dayTask) {

                taskDiv.innerHTML = `

                    <div class="flex justify-between items-center mb-2">

                        <h3 class="font-bold text-purple-700">
                            ${member.name}
                        </h3>

                        <span class="text-green-600 text-sm font-semibold">
                            Completed
                        </span>

                    </div>

                    <p class="text-gray-700 mb-2">
                        ${dayTask.task}
                    </p>

                    <small class="text-gray-500">
                        ${new Date(dayTask.completedAt)
                            .toLocaleString()}
                    </small>
                `;

            }

            // not completed
            else {

                taskDiv.innerHTML = `

                    <div class="flex justify-between items-center">

                        <h3 class="font-bold text-purple-700">
                            ${member.name}
                        </h3>

                        <span class="text-red-500 text-sm font-semibold">
                            Not completed yet
                        </span>

                    </div>
                `;
            }

            dayBox.appendChild(taskDiv);
        });

        container.appendChild(dayBox);
    }
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

    // remove duplicate
    goals =
        goals.filter(
            g => g._id !== goal._id
        );

    // add updated goal
    goals.unshift(goal);

    localStorage.setItem(
        'allGoals',
        JSON.stringify(goals)
    );

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

window.openOldGoal = async function(goalId) {

    try {

        showLoading(true);

        // ALWAYS FETCH LATEST GOAL
        const response =
            await API.getGoal(goalId);

        if (!response.success) {

            showToast(
                'Goal not found',
                'error'
            );

            return;
        }

        // update app state
        AppState.currentGoal =
            response.goal;

        // IMPORTANT
        saveGoal(response.goal);

        // save current goal
        localStorage.setItem(
            'currentGoal',
            JSON.stringify(response.goal)
        );

        // close old goal modal
        document
            .getElementById('old-goals-modal')
            .classList.add('hidden');

        // ===================================
        // TEAM WAITING ROOM
        // ===================================

        if (
            response.goal.mode === 'team' &&
            response.goal.status === 'pending'
        ) {

            await showTeamLinkSection();
        }

        // ===================================
        // ACTIVE TEAM / SOLO
        // ===================================

        else {

            await loadProgressSection();
        }

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

    } finally {

        showLoading(false);
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