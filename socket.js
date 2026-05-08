// Socket.IO Configuration
const SOCKET_CONFIG = {
    // Change this to your Render backend URL after deployment
    URL: 'https://your-app-name.onrender.com',
    // For local development, use: 'http://localhost:3000'
};

class SocketManager {
    constructor() {
        this.socket = null;
        this.listeners = {};
    }

    // Initialize socket connection
    connect(userId) {
        this.socket = io(SOCKET_CONFIG.URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            // Join user's personal room
            this.socket.emit('join', { userId });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        // Setup default listeners
        this.setupDefaultListeners();
    }

    // Setup default event listeners
    setupDefaultListeners() {
        // Team member joined
        this.socket.on('teamMemberJoined', (data) => {
            console.log('Team member joined:', data);
            if (this.listeners['teamMemberJoined']) {
                this.listeners['teamMemberJoined'](data);
            }
        });

        // Team goal started
        this.socket.on('teamGoalStarted', (data) => {
            console.log('Team goal started:', data);
            if (this.listeners['teamGoalStarted']) {
                this.listeners['teamGoalStarted'](data);
            }
        });

        // Goal completed
        this.socket.on('goalCompleted', (data) => {
            console.log('Goal completed:', data);
            if (this.listeners['goalCompleted']) {
                this.listeners['goalCompleted'](data);
            }
        });

        // Team progress updated
        this.socket.on('teamProgressUpdated', (data) => {
            console.log('Team progress updated:', data);
            if (this.listeners['teamProgressUpdated']) {
                this.listeners['teamProgressUpdated'](data);
            }
        });

        // Day unlocked
        this.socket.on('dayUnlocked', (data) => {
            console.log('Day unlocked:', data);
            if (this.listeners['dayUnlocked']) {
                this.listeners['dayUnlocked'](data);
            }
        });
    }

    // Join goal room for team updates
    joinGoalRoom(goalId) {
        if (this.socket) {
            this.socket.emit('joinGoalRoom', { goalId });
        }
    }

    // Leave goal room
    leaveGoalRoom(goalId) {
        if (this.socket) {
            this.socket.emit('leaveGoalRoom', { goalId });
        }
    }

    // Register custom event listener
    on(event, callback) {
        this.listeners[event] = callback;
    }

    // Remove event listener
    off(event) {
        delete this.listeners[event];
    }

    // Disconnect socket
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

export default SocketManager;