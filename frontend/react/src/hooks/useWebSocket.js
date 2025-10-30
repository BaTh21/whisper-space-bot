import { useEffect, useRef, useState } from 'react';

export function useWebSocket(roomId) {
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/ws/chat/${roomId}/`;
    const socket = new WebSocket(url);

    socket.onopen = () => console.log('WS connected:', roomId);
    socket.onmessage = (e) => setLastMessage(e);
    socket.onerror = (err) => console.error('WS error', err);
    socket.onclose = () => console.log('WS closed');

    ws.current = socket;

    return () => socket.close();
  }, [roomId]);

  return { lastMessage };
}