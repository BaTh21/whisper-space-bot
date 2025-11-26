class GroupWSManager {
    constructor() {
        this.sockets = {};       // { groupId: WebSocket }
        this.listeners = {};     // { groupId: Set<callback> }
        this.token = null;
        this.baseUrl = null;
    }

    init(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }

    connectToGroup(groupId) {
        if (this.sockets[groupId]) return;  // Already connected

        const ws = new WebSocket(`${this.baseUrl}/api/v1/ws/group/${groupId}?token=${this.token}`);
        this.sockets[groupId] = ws;

        ws.onopen = () => {
            console.log("WS connected → group", groupId);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Notify listeners (UI subscribers)
            if (this.listeners[groupId]) {
                this.listeners[groupId].forEach(cb => cb(data));
            }
        };

        ws.onclose = () => {
            console.log("WS closed → group", groupId);
            delete this.sockets[groupId];
        };
    }

    subscribe(groupId, callback) {
        if (!this.listeners[groupId]) {
            this.listeners[groupId] = new Set();
        }
        this.listeners[groupId].add(callback);
    }

    unsubscribe(groupId, callback) {
        if (this.listeners[groupId]) {
            this.listeners[groupId].delete(callback);
        }
    }

    send(groupId, msg) {
        const ws = this.sockets[groupId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }
}

export const groupWSManager = new GroupWSManager();
