// src/hooks/useWebSocket.js
import { useCallback, useEffect, useRef, useState } from 'react';

export const useWebSocket = (url, options = {}) => {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    onReconnect,
    shouldReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    debug = false
  } = options;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isSubscribedRef = useRef(true);
  const [readyState, setReadyState] = useState(WebSocket.CONNECTING);

  const log = useCallback((message, data) => {
    if (debug) {
      console.log(`[WebSocket] ${message}`, data || '');
    }
  }, [debug]);

  const connect = useCallback(() => {
    if (!isSubscribedRef.current || !url) return;

    // Clear existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      log('Connecting to:', url);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setReadyState(WebSocket.CONNECTING);

      ws.onopen = () => {
        log('Connected successfully');
        setReadyState(WebSocket.OPEN);
        reconnectAttemptsRef.current = 0;
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Setup heartbeat
        if (heartbeatInterval > 0) {
          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
            }
          }, heartbeatInterval);
        }

        if (onOpen) onOpen();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Ignore heartbeat responses
          if (data.type === 'heartbeat') return;
          
          log('Message received:', data);
          if (onMessage) onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          if (onError) onError(new Error('Failed to parse message'));
        }
      };

      ws.onclose = (event) => {
        log('Connection closed:', event.code, event.reason);
        setReadyState(WebSocket.CLOSED);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        if (onClose) onClose(event);

        // Attempt to reconnect
        if (isSubscribedRef.current && shouldReconnect && event.code !== 1000) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = reconnectInterval * Math.pow(2, reconnectAttemptsRef.current);
            reconnectAttemptsRef.current++;
            
            log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (onReconnect) onReconnect(reconnectAttemptsRef.current);
              connect();
            }, delay);
          } else {
            log('Max reconnection attempts reached');
            if (onError) onError(new Error('Max reconnection attempts reached'));
          }
        }
      };

      ws.onerror = (error) => {
        log('Connection error:', error);
        setReadyState(WebSocket.CLOSED);
        if (onError) onError(error);
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setReadyState(WebSocket.CLOSED);
      if (onError) onError(error);
    }
  }, [url, onMessage, onOpen, onClose, onError, onReconnect, shouldReconnect, reconnectInterval, maxReconnectAttempts, heartbeatInterval, log]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        wsRef.current.send(messageStr);
        log('Message sent:', message);
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      log('WebSocket not connected, message not sent:', message);
      return false;
    }
  }, [log]);

  const closeConnection = useCallback((code = 1000, reason = 'Normal closure') => {
    isSubscribedRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(code, reason);
      wsRef.current = null;
    }
    
    setReadyState(WebSocket.CLOSED);
  }, []);

  // Connection management
  useEffect(() => {
    isSubscribedRef.current = true;
    if (url) {
      connect();
    }

    return () => {
      closeConnection();
    };
  }, [url, connect, closeConnection]);

  const isConnected = readyState === WebSocket.OPEN;

  return {
    sendMessage,
    closeConnection,
    readyState,
    isConnected,
    reconnectAttempts: reconnectAttemptsRef.current,
    reconnect: connect
  };
};