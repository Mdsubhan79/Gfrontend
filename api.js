// API Configuration
const API_CONFIG = {
    
    BASE_URL: 'https://gbackend-3tez.onrender.com/api',
};

// API Helper Functions
const API = {
    // User Registration
    async registerUser(userData) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });
            return await response.json();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    // Create Goal
    async createGoal(goalData) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/goals/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(goalData)
            });
            return await response.json();
        } catch (error) {
            console.error('Goal creation error:', error);
            throw error;
        }
    },

    // Join Team
    async joinTeam(joinData) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/goals/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(joinData)
            });
            return await response.json();
        } catch (error) {
            console.error('Join team error:', error);
            throw error;
        }
    },

    // Start Team Goal
    async startTeamGoal(goalId, userId) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/goals/start-team`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ goalId, userId })
            });
            return await response.json();
        } catch (error) {
            console.error('Start team error:', error);
            throw error;
        }
    },

    // Complete Day
    async completeDay(progressData) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/goals/day-progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(progressData)
            });
            return await response.json();
        } catch (error) {
            console.error('Day progress error:', error);
            throw error;
        }
    },

    // Get Goal Details
    async getGoal(goalId) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/goals/${goalId}`);
            return await response.json();
        } catch (error) {
            console.error('Get goal error:', error);
            throw error;
        }
    },

    // Get User's Goals
    async getUserGoals(userId) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/goals/user/${userId}`);
            return await response.json();
        } catch (error) {
            console.error('Get user goals error:', error);
            throw error;
        }
    }
};

export default API;