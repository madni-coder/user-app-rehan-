import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook for Server-Sent Events (SSE) connection
 * Connects to backend SSE stream with auto-reconnect functionality
 * 
 * @param {string} roomId - The chat/room ID to connect to
 * @param {string} baseUrl - Backend API base URL (default: http://localhost:3000)
 * @returns {Object} { latestMessage, connectionStatus, error }
 */
const useSSE = (roomId, baseUrl = 'http://localhost:3000') => {
    const [latestMessage, setLatestMessage] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [error, setError] = useState(null);

    const eventSourceRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);

    // Maximum reconnect attempts before giving up
    const MAX_RECONNECT_ATTEMPTS = 10;
    // Base delay for exponential backoff (in ms)
    const BASE_RECONNECT_DELAY = 1000;

    /**
     * Calculate exponential backoff delay
     */
    const getReconnectDelay = useCallback(() => {
        const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            30000 // Max 30 seconds
        );
        return delay;
    }, []);

    /**
     * Cleanup function to close EventSource and clear timeouts
     */
    const cleanup = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    /**
     * Connect to SSE stream
     */
    const connect = useCallback(() => {
        // Don't connect if component is unmounted or no roomId
        if (!isMountedRef.current || !roomId) {
            return;
        }

        // Close existing connection
        cleanup();

        try {
            const url = `${baseUrl}/chat/${roomId}/stream`;
            console.log(`[useSSE] Connecting to ${url}`);

            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            // Connection opened
            eventSource.onopen = () => {
                if (isMountedRef.current) {
                    console.log('[useSSE] Connected');
                    setConnectionStatus('connected');
                    setError(null);
                    reconnectAttemptsRef.current = 0; // Reset counter on successful connection
                }
            };

            // Receive message
            eventSource.onmessage = (event) => {
                if (!isMountedRef.current) return;

                try {
                    const data = JSON.parse(event.data);
                    console.log('[useSSE] Message received:', data);

                    // Update latest message
                    setLatestMessage(data);

                    // Handle heartbeat
                    if (data.type === 'heartbeat') {
                        console.log('[useSSE] Heartbeat received');
                    }
                } catch (err) {
                    console.error('[useSSE] Error parsing message:', err);
                }
            };

            // Connection error
            eventSource.onerror = (err) => {
                console.error('[useSSE] Connection error:', err);

                if (!isMountedRef.current) return;

                setConnectionStatus('disconnected');
                eventSource.close();

                // Auto reconnect with exponential backoff
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptsRef.current += 1;
                    const delay = getReconnectDelay();

                    console.log(
                        `[useSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
                    );

                    setError(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            connect();
                        }
                    }, delay);
                } else {
                    console.error('[useSSE] Max reconnect attempts reached');
                    setError('Connection failed. Please refresh the page.');
                }
            };

        } catch (err) {
            console.error('[useSSE] Error creating EventSource:', err);
            if (isMountedRef.current) {
                setConnectionStatus('disconnected');
                setError(err.message);
            }
        }
    }, [roomId, baseUrl, cleanup, getReconnectDelay]);

    /**
     * Effect to manage SSE connection lifecycle
     */
    useEffect(() => {
        isMountedRef.current = true;

        if (roomId) {
            connect();
        }

        // Cleanup on unmount or roomId change
        return () => {
            isMountedRef.current = false;
            cleanup();
        };
    }, [roomId, connect, cleanup]);

    return {
        latestMessage,
        connectionStatus,
        error
    };
};

export default useSSE;
