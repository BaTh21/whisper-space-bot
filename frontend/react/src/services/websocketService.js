// websocketService.js - FIXED VERSION
class WebSocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageHandlers = new Map();
        this.heartbeatInterval = null;
        this.authSent = false;
        this.connectionTimeout = null;
        this.authRetryCount = 0;
        this.maxAuthRetries = 3;
        this.isAuthenticated = false;
        this.activeSubscriptions = new Set();
        this.authPromise = null;
        this.authResolve = null;
        this.authReject = null;
    }

    getWebSocketUrl() {
        // Use VITE_WS_URL if defined
        const wsUrl = import.meta.env.VITE_WS_URL;
        if (wsUrl) {
            console.log('Using WebSocket URL from VITE_WS_URL:', wsUrl);
            return wsUrl;
        }

        // Fallback to API URL
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const url = new URL(apiUrl);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${url.host}`;
    }

    getAuthToken() {
        // FIXED: Check for tokens in all possible locations
        const token = localStorage.getItem('access_token') || 
                     localStorage.getItem('accessToken') ||
                     sessionStorage.getItem('access_token') || 
                     sessionStorage.getItem('accessToken');
        
        if (token) {
            console.log('🔑 Token found:', token.substring(0, 20) + '...');
            return token;
        }
        
        console.warn('⚠️ No authentication token found');
        return null;
    }

    // Create WebSocket URL with token in query params
    createWebSocketUrl(endpoint) {
        const baseUrl = this.getWebSocketUrl();
        const token = this.getAuthToken();
        
        if (!token) {
            console.error('❌ Cannot create WebSocket URL: No token found');
            return `${baseUrl}${endpoint}`;
        }
        
        // Add token as query parameter for WebSocket connections
        const url = new URL(`${baseUrl}${endpoint}`);
        url.searchParams.append('token', token);
        
        console.log('🔗 WebSocket URL created');
        return url.toString();
    }

    // FIXED: Check if token is expired
    isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiryTime = payload.exp * 1000;
            const currentTime = Date.now();
            const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
            
            return expiryTime - currentTime < bufferTime;
        } catch (error) {
            console.error('❌ Error checking token expiry:', error);
            return true; // If we can't parse, assume expired
        }
    }

    async connect(endpoint = '/api/v1/ws/notifications') {
        // First check token validity
        const token = this.getAuthToken();
        if (!token) {
            console.error('❌ Cannot connect: No token found');
            return Promise.reject(new Error('No authentication token found'));
        }
        
        // Check if token is expired or about to expire
        if (this.isTokenExpired(token)) {
            console.log('🔄 Token is expired or expiring soon');
            // In a real app, you should refresh the token here
            // For now, we'll just try to reconnect with the current token
        }
        
        // Don't reconnect if already connected
        if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
            console.log('⚠️ WebSocket already connected');
            return Promise.resolve(true);
        }
        
        // Clear existing connection
        this.disconnect();

        // Create WebSocket URL with token in query params
        const wsUrl = this.createWebSocketUrl(endpoint);
        console.log('🌐 Connecting to WebSocket:', wsUrl.replace(/(token=)[^&]+/, '$1***'));
        
        // Create auth promise
        this.authPromise = new Promise((resolve, reject) => {
            this.authResolve = resolve;
            this.authReject = reject;
        });
        
        // Set timeout for auth
        this.connectionTimeout = setTimeout(() => {
            if (!this.isAuthenticated) {
                console.log('⏰ Authentication timeout');
                if (this.authReject) {
                    this.authReject(new Error('Authentication timeout'));
                    this.authResolve = null;
                    this.authReject = null;
                }
                this.disconnect();
            }
        }, 10000);
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.authSent = false;
            this.isAuthenticated = false;
            this.authRetryCount = 0;
            
            this.socket.onopen = (event) => {
                console.log('✅ WebSocket connection opened successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }

                // For notifications endpoint, wait for auth_success from server
                console.log('⏳ Waiting for server authentication...');
                
                // Start heartbeat
                this.startHeartbeat();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📥 Received WebSocket message:', data.type || data.action || 'unknown');
                    
                    // Handle authentication responses
                    if (data.type === 'auth_success' || data.action === 'auth_success') {
                        console.log('🔐 Authentication successful');
                        this.isAuthenticated = true;
                        this.authSent = true;
                        
                        // Resolve auth promise
                        if (this.authResolve) {
                            this.authResolve(data);
                            this.authResolve = null;
                            this.authReject = null;
                        }
                        
                        return;
                    }
                    
                    if (data.type === 'auth_error' || data.action === 'auth_error') {
                        console.error('❌ Authentication failed:', data.error || data.message);
                        this.isAuthenticated = false;
                        
                        // Reject auth promise
                        if (this.authReject) {
                            this.authReject(new Error(data.error || data.message || 'Authentication failed'));
                            this.authResolve = null;
                            this.authReject = null;
                        }
                        
                        this.disconnect();
                        return;
                    }
                    
                    // Handle pong
                    if (data.type === 'pong') {
                        return;
                    }
                    
                    // Handle connection welcome
                    if (data.type === 'connected' || data.type === 'welcome') {
                        console.log('🤝 Server welcome message');
                        return;
                    }

                    // Handle error messages
                    if (data.type === 'error') {
                        console.error('❌ WebSocket error:', data.message || data.error);
                        
                        // If it's a token error, clear tokens
                        if (data.message?.includes('token') || data.error?.includes('token')) {
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('accessToken');
                            localStorage.removeItem('refresh_token');
                            localStorage.removeItem('refreshToken');
                        }
                        return;
                    }

                    // Notify all handlers
                    this.notifyAllHandlers(data);

                } catch (error) {
                    console.error('❌ Error parsing message:', error);
                }
            };

            this.socket.onclose = (event) => {
                console.log('🔌 WebSocket closed:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                });
                
                this.isConnected = false;
                this.isAuthenticated = false;
                this.authSent = false;
                this.stopHeartbeat();
                this.activeSubscriptions.clear();
                
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                
                // Reject auth promise if still pending
                if (this.authReject) {
                    this.authReject(new Error(`Connection closed: ${event.reason || 'Unknown reason'}`));
                    this.authResolve = null;
                    this.authReject = null;
                }

                // Don't reconnect for auth failures
                if (event.code === 1008 || event.code === 4001 || event.code === 403) {
                    console.log('🚫 Authentication failure, not reconnecting');
                    return;
                }

                // Attempt reconnection
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
                    console.log(`⏳ Reconnecting in ${delay/1000}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.connect(endpoint);
                        }
                    }, delay);
                } else {
                    console.log('🚫 Max reconnection attempts reached');
                }
            };

            this.socket.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                
                // Reject auth promise on error
                if (this.authReject) {
                    this.authReject(new Error('WebSocket connection error'));
                    this.authResolve = null;
                    this.authReject = null;
                }
            };

        } catch (error) {
            console.error('❌ Error creating WebSocket:', error);
            this.handleConnectionError();
            return Promise.reject(error);
        }
        
        return this.authPromise;
    }

    sendAuthentication() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ WebSocket not ready for authentication');
            
            // Retry after delay
            if (this.authRetryCount < this.maxAuthRetries) {
                this.authRetryCount++;
                setTimeout(() => this.sendAuthentication(), 1000);
            }
            return;
        }

        const token = this.getAuthToken();
        if (!token) {
            console.error('❌ Cannot authenticate: No token found');
            if (this.authReject) {
                this.authReject(new Error('No token found'));
            }
            this.disconnect();
            return;
        }

        try {
            const authMessage = {
                type: 'auth',
                token: token,
                timestamp: Date.now()
            };
            this.socket.send(JSON.stringify(authMessage));
            this.authSent = true;
            console.log('🔐 Authentication sent');
        } catch (error) {
            console.error('❌ Error sending authentication:', error);
            if (this.authReject) {
                this.authReject(error);
            }
        }
    }

    // Connect to private chat (returns promise)
    connectToPrivateChat(friendId) {
        return this.connect(`/api/v1/ws/private/${friendId}`);
    }

    // Connect to group chat (returns promise)
    connectToGroupChat(groupId) {
        return this.connect(`/api/v1/ws/group/${groupId}`);
    }

    // Connect to notifications (returns promise)
    connectToNotifications() {
        return this.connect('/api/v1/ws/notifications');
    }
     // Wait for authentication
    waitForAuth(timeout = 10000) {
        if (this.isAuthenticated) {
            return Promise.resolve(true);
        }
        
        return new Promise((resolve, reject) => {
            const checkAuth = () => {
                if (this.isAuthenticated) {
                    resolve(true);
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            
            setTimeout(() => {
                if (!this.isAuthenticated) {
                    reject(new Error('Authentication timeout'));
                }
            }, timeout);
            
            checkAuth();
        });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
                try {
                    this.socket.send(JSON.stringify({
                        type: 'ping',
                        timestamp: Date.now()
                    }));
                } catch (error) {
                    console.error('❌ Heartbeat error:', error);
                }
            }
        }, 25000); // 25 seconds (matches backend)
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    disconnect() {
        console.log('👋 Disconnecting WebSocket');
        this.isConnected = false;
        this.isAuthenticated = false;
        this.authSent = false;
        this.stopHeartbeat();
        this.activeSubscriptions.clear();
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.socket) {
            const readyState = this.socket.readyState;
            
            // Close if open or connecting
            if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
                this.socket.close(1000, 'Client disconnect');
            }
            
            this.socket = null;
        }
    }

    handleConnectionError() {
        this.isConnected = false;
        this.stopHeartbeat();
        this.activeSubscriptions.clear();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
            console.log(`⏳ Retrying in ${delay/1000}s`);
            
            setTimeout(() => this.connect(), delay);
        }
    }

    onMessage(type, handler) {
        if (typeof handler === 'function') {
            this.messageHandlers.set(type, handler);
        }
    }

    onMessagePattern(pattern, handler) {
        if (typeof handler === 'function') {
            this.messageHandlers.set(pattern, handler);
        }
    }

    removeHandler(type) {
        this.messageHandlers.delete(type);
    }

    removeAllHandlers() {
        this.messageHandlers.clear();
    }

    notifyHandlers(type, data) {
        const handler = this.messageHandlers.get(type);
        if (handler) {
            try {
                handler(data);
            } catch (error) {
                console.error('❌ Handler error:', error);
            }
        }
    }

    notifyAllHandlers(data) {
        this.messageHandlers.forEach((handler, key) => {
            try {
                // If key is a pattern (string), check if it matches
                if (typeof key === 'string') {
                    // Check for type match
                    if (data.type === key || data.action === key) {
                        handler(data);
                    }
                    // Check for pattern match (e.g., "friend_*")
                    else if (key.includes('*') && data.type) {
                        const pattern = new RegExp(key.replace('*', '.*'));
                        if (pattern.test(data.type)) {
                            handler(data);
                        }
                    }
                }
                // If no specific type handler, use generic handler
                else if (!key && typeof handler === 'function') {
                    handler(data);
                }
            } catch (error) {
                console.error('❌ Handler error:', error);
            }
        });
    }

    send(data) {
        if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(data));
                return true;
            } catch (error) {
                console.error('❌ Send error:', error);
                return false;
            }
        }
        console.warn('⚠️ Cannot send: Not connected');
        return false;
    }

    subscribeToRoom(room) {
        if (!this.activeSubscriptions.has(room)) {
            this.activeSubscriptions.add(room);
            console.log(`✅ Subscribed to room: ${room}`);
        }
    }

    unsubscribeFromRoom(room) {
        if (this.activeSubscriptions.has(room)) {
            this.activeSubscriptions.delete(room);
            console.log(`❌ Unsubscribed from room: ${room}`);
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated,
            readyState: this.socket?.readyState,
            reconnectAttempts: this.reconnectAttempts,
            authSent: this.authSent,
            url: this.socket?.url,
            handlerCount: this.messageHandlers.size,
            subscriptions: Array.from(this.activeSubscriptions)
        };
    }
}

export const websocketService = new WebSocketService();