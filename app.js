import API from './api.js';
import SocketManager from './socket.js';

// Application State
const AppState = {
    currentUser: null,
    currentGoal: null,
    selectedMode: null,
    socketManager: null,
    dayTimer: null
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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    AppState.socketManager = new SocketManager();
    setupEventListeners();
    checkTeamInvite();
});

// Setup Event Listeners
function setupEventListeners() {
    // Registration Form
    document.getElementById('registration-form').addEventListener('submit', handleRegistration);

    // Mode Selection
    document.getElementById('solo-mode-btn').addEventListener('click', () => selectMode('solo'));
    document.getElementById('team-mode-btn').addEventListener('click', () => selectMode('team'));

    // Goal Setup Form
    document.getElementById('goal-setup-form').addEventListener('submit', handleGoalSetup);

    // Team Link Copy
    document.getElementById('copy-link-btn')?.addEventListener('click', copyTeamLink);

    // Start Team Goal
    document.getElementById('start-team-btn')?.addEventListener('click', startTeamGoal);

    // Day Task Form
    document.getElementById('day-task-form')?.addEventListener('click', handleDayComplete);

    // New Goal Button
    document.getElementById('new-goal-btn')?.addEventListener('click', resetApp);

    // Setup socket listeners
    setupSocketListeners();
}

// Setup Socket Event Listeners
function setupSocketListeners() {
    AppState.socketManager.on('teamMemberJoined', (data) => {
        showToast(`Team member joined!`, 'success');
        updateTeamMembersList();
    });

    AppState.socketManager.on('teamGoalStarted', (data) => {
        showToast('Goal started! Time to shine!', 'success');
        loadProgressSection();
    });

    AppState.socketManager.on('goalCompleted', (data) => {
        showCongratulations();
    });

    AppState.socketManager.on('teamProgressUpdated', (data) => {
        updateTeamProgress(data);
    });

    AppState.socketManager.on('dayUnlocked', (data) => {
        showToast('New day unlocked!', 'info');
        loadProgressSection();
    });
}

// Check if user is joining via team invite
function checkTeamInvite() {
    const urlParams = new URLSearchParams(window.location.search);
    const teamLink = urlParams.get('teamLink');
    
    if (teamLink) {
        AppState.teamInviteLink = teamLink;
        document.getElementById('landing-section').classList.remove('hidden');
        showToast('Complete registration to join the team!', 'info');
    }
}

// Handle User Registration
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
            
            // Initialize socket connection
            AppState.socketManager.connect(response.user._id);

            // Check if joining team
            if (AppState.teamInviteLink) {
                await handleJoinTeam(AppState.teamInviteLink, response.user._id);
            } else {
                showModeSelection();
            }
        } else {
            showToast(response.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Registration failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Join Team
async function handleJoinTeam(teamLink, userId) {
    try {
        const response = await API.joinTeam({
            teamLink,
            userId
        });

        if (response.success) {
            AppState.currentGoal = response.goal;
            showToast('Successfully joined the team!', 'success');
            showTeamLinkSection();
        } else {
            showToast(response.message || 'Failed to join team', 'error');
            showModeSelection();
        }
    } catch (error) {
        showToast('Failed to join team', 'error');
        showModeSelection();
    }
}

// Show Mode Selection
function showModeSelection() {
    hideAllSections();
    DOM.modeSection.classList.remove('hidden');
    DOM.modeSection.classList.add('slide-in-up');
}

// Select Mode
function selectMode(mode) {
    AppState.selectedMode = mode;
    hideAllSections();
    
    DOM.goalSetupSection.classList.remove('hidden');
    DOM.goalSetupSection.classList.add('slide-in-up');
    
    document.getElementById('setup-title').textContent = 
        mode === 'solo' ? 'Set Your Solo Goal' : 'Set Your Team Goal';
    
    // Show/hide team size input
    const teamSizeContainer = document.getElementById('team-size-container');
    if (mode === 'team') {
        teamSizeContainer.classList.remove('hidden');
    } else {
        teamSizeContainer.classList.add('hidden');
    }
}

// Handle Goal Setup
async function handleGoalSetup(e) {
    e.preventDefault();
    showLoading(true);

    const goalData = {
        userId: AppState.currentUser._id,
        goalName: document.getElementById('goal-name').value,
        totalDays: parseInt(document.getElementById('goal-days').value),
        mode: AppState.selectedMode,
        maxTeamMembers: AppState.selectedMode === 'team' 
            ? parseInt(document.getElementById('team-size').value) 
            : 1
    };

    try {
        const response = await API.createGoal(goalData);
        
        if (response.success) {
            AppState.currentGoal = response.goal;
            
            if (AppState.selectedMode === 'solo') {
                loadProgressSection();
            } else {
                showTeamLinkSection();
            }
        } else {
            showToast(response.message || 'Failed to create goal', 'error');
        }
    } catch (error) {
        showToast('Failed to create goal', 'error');
    } finally {
        showLoading(false);
    }
}

// Show Team Link Section
function showTeamLinkSection() {
    hideAllSections();
    DOM.teamLinkSection.classList.remove('hidden');
    DOM.teamLinkSection.classList.add('slide-in-up');
    
    // Set team link
    const teamLink = `${window.location.origin}?teamLink=${AppState.currentGoal.teamLink}`;
    document.getElementById('team-link-input').value = teamLink;
    
    // Update team members list
    updateTeamMembersList();
    
    // Join goal room
    AppState.socketManager.joinGoalRoom(AppState.currentGoal._id);
}

// Copy Team Link
function copyTeamLink() {
    const linkInput = document.getElementById('team-link-input');
    linkInput.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
}

// Update Team Members List
async function updateTeamMembersList() {
    try {
        const response = await API.getGoal(AppState.currentGoal._id);
        const goal = response.goal;
        
        const membersList = document.getElementById('team-members-list');
        const waitingMessage = document.getElementById('waiting-message');
        const startButton = document.getElementById('start-team-btn');
        
        membersList.innerHTML = '';
        
        goal.teamMembers.forEach((member, index) => {
            const memberCard = document.createElement('div');
            memberCard.className = 'bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 flex items-center justify-between';
            memberCard.innerHTML = `
                <div class="flex items-center">
                    <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                        <span class="text-white font-bold text-lg">${member.name.charAt(0)}</span>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800">${member.name}</p>
                        <p class="text-sm text-gray-500">${member.email}</p>
                    </div>
                </div>
                <span class="px-4 py-2 rounded-full text-sm font-semibold ${
                    index === 0 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                }">
                    ${index === 0 ? '👑 Creator' : '✨ Member'}
                </span>
            `;
            membersList.appendChild(memberCard);
        });
        
        // Show/hide waiting message and start button
        if (goal.teamMembers.length >= goal.maxTeamMembers) {
            waitingMessage.classList.add('hidden');
            startButton.classList.remove('hidden');
        } else {
            waitingMessage.classList.remove('hidden');
            startButton.classList.add('hidden');
        }
        
        AppState.currentGoal = goal;
    } catch (error) {
        showToast('Failed to update team list', 'error');
    }
}

// Start Team Goal
async function startTeamGoal() {
    showLoading(true);
    
    try {
        const response = await API.startTeamGoal(
            AppState.currentGoal._id,
            AppState.currentUser._id
        );
        
        if (response.success) {
            AppState.currentGoal = response.goal;
            loadProgressSection();
        } else {
            showToast(response.message || 'Failed to start goal', 'error');
        }
    } catch (error) {
        showToast('Failed to start goal', 'error');
    } finally {
        showLoading(false);
    }
}

// Load Progress Section
async function loadProgressSection() {
    hideAllSections();
    showLoading(true);
    
    try {
        const response = await API.getGoal(AppState.currentGoal._id);
        const goal = response.goal;
        AppState.currentGoal = goal;
        
        // Update UI
        document.getElementById('current-goal-name').textContent = goal.goalName;
        document.getElementById('goal-mode-display').textContent = 
            goal.mode === 'solo' ? '🎯 Solo Goal' : '👥 Team Goal';
        
        // Progress info
        const completedDays = getCompletedDaysCount();
        const totalDays = goal.totalDays;
        document.getElementById('days-progress').textContent = 
            `Day ${Math.min(completedDays + 1, totalDays)} / ${totalDays}`;
        
        const daysLeft = totalDays - completedDays;
        document.getElementById('days-left-display').textContent = 
            daysLeft > 0 ? `${daysLeft} days remaining` : 'Completed! 🎉';
        
        // Progress bar
        const progressPercent = (completedDays / totalDays) * 100;
        document.getElementById('overall-progress-bar').style.width = `${progressPercent}%`;
        
        // Check if goal is completed
        if (goal.status === 'completed') {
            showCongratulations();
            return;
        }
        
        // Set current day title
        const currentDay = completedDays + 1;
        document.getElementById('current-day-title').textContent = 
            `Day ${currentDay}: What's Your Plan?`;
        
        // Check if next day is unlocked
        const canProceed = checkDayUnlocked();
        
        if (canProceed) {
            document.getElementById('current-day-section').classList.remove('hidden');
            document.getElementById('next-day-timer').classList.add('hidden');
        } else {
            document.getElementById('current-day-section').classList.add('hidden');
            document.getElementById('next-day-timer').classList.remove('hidden');
            startDayTimer();
        }
        
        // Show/hide team progress
        if (goal.mode === 'team') {
            document.getElementById('team-progress-section').classList.remove('hidden');
            updateTeamProgress(goal);
        } else {
            document.getElementById('team-progress-section').classList.add('hidden');
        }
        
        // Load progress history
        loadProgressHistory();
        
        DOM.progressSection.classList.remove('hidden');
        DOM.progressSection.classList.add('slide-in-up');
        
    } catch (error) {
        showToast('Failed to load progress', 'error');
    } finally {
        showLoading(false);
    }
}

// Get completed days count for current user
function getCompletedDaysCount() {
    if (!AppState.currentGoal) return 0;
    
    if (AppState.currentGoal.mode === 'team') {
        const userProgress = AppState.currentGoal.teamProgress.find(
            tp => tp.userId === AppState.currentUser._id || 
                  tp.userId._id === AppState.currentUser._id
        );
        return userProgress ? userProgress.userProgress.length : 0;
    } else {
        return AppState.currentGoal.currentDay - 1;
    }
}

// Check if current day is unlocked
function checkDayUnlocked() {
    if (!AppState.currentGoal) return true;
    
    if (AppState.currentGoal.mode === 'team') {
        const userProgress = AppState.currentGoal.teamProgress.find(
            tp => tp.userId === AppState.currentUser._id || 
                  tp.userId._id === AppState.currentUser._id
        );
        
        if (!userProgress || userProgress.userProgress.length === 0) return true;
        
        const lastCompletedDay = userProgress.userProgress[userProgress.userProgress.length - 1];
        if (!lastCompletedDay) return true;
        
        const lastCompletedTime = new Date(lastCompletedDay.completedAt).getTime();
        const currentTime = new Date().getTime();
        const hoursDiff = (currentTime - lastCompletedTime) / (1000 * 60 * 60);
        
        return hoursDiff >= 24;
    } else {
        // For solo mode, we track based on goal's last day completion
        return true; // Simplified for solo mode
    }
}

// Start day timer
function startDayTimer() {
    clearInterval(AppState.dayTimer);
    
    updateDayTimer();
    AppState.dayTimer = setInterval(updateDayTimer, 1000);
}

// Update day timer display
function updateDayTimer() {
    const userProgress = getCurrentUserProgress();
    if (!userProgress || userProgress.length === 0) return;
    
    const lastCompletedDay = userProgress[userProgress.length - 1];
    const lastCompletedTime = new Date(lastCompletedDay.completedAt).getTime();
    const unlockTime = lastCompletedTime + (24 * 60 * 60 * 1000);
    const currentTime = new Date().getTime();
    const timeLeft = unlockTime - currentTime;
    
    if (timeLeft <= 0) {
        clearInterval(AppState.dayTimer);
        document.getElementById('current-day-section').classList.remove('hidden');
        document.getElementById('next-day-timer').classList.add('hidden');
        return;
    }
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    document.getElementById('timer-display').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Get current user's progress
function getCurrentUserProgress() {
    if (!AppState.currentGoal) return [];
    
    if (AppState.currentGoal.mode === 'team') {
        const userProgress = AppState.currentGoal.teamProgress.find(
            tp => tp.userId === AppState.currentUser._id || 
                  tp.userId._id === AppState.currentUser._id
        );
        return userProgress ? userProgress.userProgress : [];
    } else {
        return [];
    }
}

// Handle Day Complete
async function handleDayComplete(e) {
    e.preventDefault();
    showLoading(true);
    
    const task = document.getElementById('day-task-input').value;
    
    try {
        const response = await API.completeDay({
            goalId: AppState.currentGoal._id,
            userId: AppState.currentUser._id,
            task
        });
        
        if (response.success) {
            document.getElementById('day-task-input').value = '';
            
            if (response.goal.status === 'completed') {
                showCongratulations();
            } else {
                showToast('🎉 Day completed! Great job!', 'success');
                AppState.currentGoal = response.goal;
                loadProgressSection();
            }
        } else {
            showToast(response.message || 'Failed to complete day', 'error');
        }
    } catch (error) {
        showToast('Failed to save progress', 'error');
    } finally {
        showLoading(false);
    }
}

// Update Team Progress
function updateTeamProgress(goal) {
    const teamGrid = document.getElementById('team-progress-grid');
    teamGrid.innerHTML = '';
    
    goal.teamMembers.forEach((member, index) => {
        const memberId = typeof member === 'object' ? member._id : member;
        const memberProgress = goal.teamProgress.find(
            tp => tp.userId === memberId || 
                  (typeof tp.userId === 'object' && tp.userId._id === memberId)
        );
        
        const completedDays = memberProgress ? memberProgress.userProgress.length : 0;
        const progressPercent = (completedDays / goal.totalDays) * 100;
        
        const memberCard = document.createElement('div');
        memberCard.className = 'bg-gradient-to-br from-gray-50 to-indigo-50 rounded-xl p-6';
        memberCard.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <span class="text-white font-bold">${member.name ? member.name.charAt(0) : '?'}</span>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800">${member.name || 'Unknown'}</p>
                        <p class="text-sm text-gray-500">${member.email || ''}</p>
                    </div>
                </div>
                <span class="text-lg font-bold text-indigo-600">${completedDays}/${goal.totalDays}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full progress-fill" 
                     style="width: ${progressPercent}%"></div>
            </div>
            <div class="space-y-1">
                ${memberProgress && memberProgress.userProgress.slice(-3).map(day => `
                    <p class="text-sm text-gray-600">
                        <span class="font-medium">Day ${day.dayNumber}:</span> ${day.task}
                    </p>
                `).join('')}
            </div>
        `;
        
        teamGrid.appendChild(memberCard);
    });
}

// Load Progress History
function loadProgressHistory() {
    const historyContainer = document.getElementById('progress-history');
    historyContainer.innerHTML = '';
    
    const userProgress = getCurrentUserProgress();
    
    if (userProgress.length === 0) {
        historyContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-tasks text-4xl mb-3"></i>
                <p>No days completed yet. Start your journey!</p>
            </div>
        `;
        return;
    }
    
    userProgress.reverse().forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = 'goal-card bg-white border-2 border-gray-100 rounded-xl p-4 flex items-center';
        dayCard.innerHTML = `
            <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mr-4">
                <i class="fas fa-check text-white text-xl"></i>
            </div>
            <div class="flex-grow">
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-gray-800">Day ${day.dayNumber}</p>
                    <span class="text-sm text-gray-500">${new Date(day.completedAt).toLocaleDateString()}</span>
                </div>
                <p class="text-gray-600 mt-1">${day.task}</p>
            </div>
        `;
        historyContainer.appendChild(dayCard);
    });
}

// Show Congratulations
function showCongratulations() {
    hideAllSections();
    DOM.congratsModal.classList.remove('hidden');
    DOM.congratsModal.classList.add('flex', 'fade-in');
    
    document.getElementById('completed-goal-name').textContent = 
        `Goal: ${AppState.currentGoal.goalName}`;
    
    // Create confetti effect
    createConfetti();
}

// Create confetti effect
function createConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confettiPieces = [];
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    
    // Create confetti pieces
    for (let i = 0; i < 200; i++) {
        confettiPieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedX: Math.random() * 6 - 3,
            speedY: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5
        });
    }
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confettiPieces.forEach(piece => {
            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate(piece.rotation * Math.PI / 180);
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
            ctx.restore();
            
            piece.x += piece.speedX;
            piece.y += piece.speedY;
            piece.rotation += piece.rotationSpeed;
            
            if (piece.y > canvas.height) {
                piece.y = -10;
                piece.x = Math.random() * canvas.width;
            }
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Stop confetti after 10 seconds
    setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 10000);
}

// Reset App
function resetApp() {
    clearInterval(AppState.dayTimer);
    DOM.congratsModal.classList.add('hidden');
    DOM.congratsModal.classList.remove('flex');
    AppState.currentGoal = null;
    AppState.selectedMode = null;
    showModeSelection();
}

// Hide all sections
function hideAllSections() {
    DOM.landingSection.classList.add('hidden');
    DOM.modeSection.classList.add('hidden');
    DOM.goalSetupSection.classList.add('hidden');
    DOM.teamLinkSection.classList.add('hidden');
    DOM.progressSection.classList.add('hidden');
}

// Show/Hide Loading Spinner
function showLoading(show) {
    if (show) {
        DOM.loadingSpinner.classList.remove('hidden');
        DOM.loadingSpinner.classList.add('flex');
    } else {
        DOM.loadingSpinner.classList.add('hidden');
        DOM.loadingSpinner.classList.remove('flex');
    }
}

// Show Toast Notification
function showToast(message, type = 'info') {
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    const bgColors = {
        success: 'bg-gradient-to-r from-green-400 to-green-600',
        error: 'bg-gradient-to-r from-red-400 to-red-600',
        info: 'bg-gradient-to-r from-blue-400 to-blue-600',
        warning: 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast-enter ${bgColors[type]} text-white px-6 py-4 rounded-xl shadow-lg flex items-center`;
    toast.innerHTML = `
        <span class="text-xl mr-3">${icons[type]}</span>
        <p class="flex-grow">${message}</p>
        <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}