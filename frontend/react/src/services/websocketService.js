// services/websocketService.js
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
    // Try multiple possible token locations
    const token = localStorage.getItem('access_token') || 
                 sessionStorage.getItem('access_token') ||
                 localStorage.getItem('accessToken') ||  // Note: different key
                 sessionStorage.getItem('accessToken');
    
    if (token) {
        console.log('🔑 Token found:', token.substring(0, 20) + '...');
        // Validate token format
        if (token.split('.').length !== 3) {
            console.warn('⚠️ Token format appears invalid (not a JWT)');
            // Fallback to empty or handle appropriately
            return null;
        }
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
        
        console.log('🔗 WebSocket URL with token:', url.toString().replace(token, '***'));
        return url.toString();
    }

    connect(endpoint = '/api/v1/ws/notifications') {
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
        
        // Debug: Check if URL is valid
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            console.error('❌ Invalid WebSocket URL:', wsUrl);
            return Promise.reject(new Error('Invalid WebSocket URL'));
        }
        
        // Create auth promise
        this.authPromise = new Promise((resolve, reject) => {
            this.authResolve = resolve;
            this.authReject = reject;
        });
        
        // Set timeout for auth
        setTimeout(() => {
            if (this.authPromise && !this.isAuthenticated) {
                console.log('⏰ Authentication timeout');
                if (this.authReject) {
                    this.authReject(new Error('Authentication timeout'));
                }
            }
        }, 10000);
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.authSent = false;
            this.isAuthenticated = false;
            this.authRetryCount = 0;
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected && this.socket) {
                    console.log('⏰ WebSocket connection timeout');
                    this.socket.close();
                    if (this.authReject) {
                        this.authReject(new Error('Connection timeout'));
                    }
                }
            }, 15000);

            this.socket.onopen = (event) => {
                console.log('✅ WebSocket connection opened successfully');
                console.log('📡 WebSocket URL:', this.socket.url);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }

                // For notifications endpoint, we still need to send auth message
                if (endpoint === '/api/v1/ws/notifications') {
                    this.sendAuthentication();
                } else {
                    // For private/group chats, token is in query params
                    // Wait for auth_success message from server
                    console.log('⏳ Waiting for server authentication...');
                }
                
                // Start heartbeat
                this.startHeartbeat();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📥 Received WebSocket message:', data.type || data.action || 'unknown');
                    
                    // Handle authentication responses
                    if (data.type === 'auth_success' || data.action === 'auth_success') {
                        console.log('🔐 Authentication successful:', data.message);
                        this.isAuthenticated = true;
                        this.authSent = true;
                        
                        // Resolve auth promise
                        if (this.authResolve) {
                            this.authResolve(data);
                            this.authResolve = null;
                            this.authReject = null;
                        }
                        
                        // Notify auth listeners
                        this.notifyHandlers('auth_success', data);
                        return;
                    }
                    
                    if (data.type === 'auth_error' || data.action === 'auth_error' || data.type === 'error') {
                        console.error('❌ Authentication failed:', data.error || data.message || data.reason);
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
                    if (data.type === 'pong' || data.action === 'pong') {
                        return;
                    }
                    
                    // Handle connection welcome
                    if (data.type === 'connected' || data.type === 'welcome') {
                        console.log('🤝 Server welcome message');
                        return;
                    }

                    // Notify all handlers
                    this.notifyAllHandlers(data);

                } catch (error) {
                    console.error('❌ Error parsing message:', error);
                    console.log('Raw message:', event.data);
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
                console.log('Error details:', {
                    url: this.socket?.url?.replace(/(token=)[^&]+/, '$1***'),
                    readyState: this.socket?.readyState
                });
                
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