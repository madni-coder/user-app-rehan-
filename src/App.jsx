import { useState, useEffect } from "react";
import "./App.css";
import useSSE from "./hooks/useSSE";

function App() {
    const [latestMessageText, setLatestMessageText] = useState("");
    const [isDraft, setIsDraft] = useState(false);
    const [chatId, setChatId] = useState(null);
    const [isJoiningRoom, setIsJoiningRoom] = useState(false);
    const [backendUrl] = useState(() => {
        // Use network IP if accessed from network, localhost otherwise
        const hostname = window.location.hostname;
        return hostname === "localhost"
            ? "http://localhost:3000"
            : `http://${hostname}:3000`;
    });

    // Connect to SSE stream
    const { latestMessage, connectionStatus, error } = useSSE(
        chatId,
        backendUrl
    );

    // Join chat room from URL (default to "/1" when none provided)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const roomIdFromUrl = urlParams.get("room");

        if (roomIdFromUrl) {
            setIsJoiningRoom(true);
            setChatId(roomIdFromUrl);
            console.log("Joining room:", roomIdFromUrl);
            setTimeout(() => setIsJoiningRoom(false), 1000);
        } else {
            const defaultRoom = "1";
            setIsJoiningRoom(true);
            setChatId(defaultRoom);
            console.log("No room provided; defaulting to:", defaultRoom);
            setTimeout(() => setIsJoiningRoom(false), 1000);
            const newUrl = `${window.location.origin}${window.location.pathname}?room=${defaultRoom}`;
            window.history.replaceState({}, "", newUrl);
        }
    }, [backendUrl]);

    // Handle incoming SSE messages - display only the latest message
    useEffect(() => {
        if (!latestMessage) return;
        console.log("[App] SSE latestMessage:", latestMessage);
        if (
            latestMessage.type === "heartbeat" ||
            latestMessage.type === "connected"
        )
            return;

        if (latestMessage.type === "cleared") {
            setLatestMessageText("");
            setIsDraft(false);
            return;
        }

        // Handle both message structures
        const messageText = latestMessage.message?.text || latestMessage.text;
        const isFinal =
            latestMessage.message?.isFinal !== undefined
                ? latestMessage.message.isFinal
                : latestMessage.isFinal !== undefined
                ? latestMessage.isFinal
                : true;

        if (messageText) {
            setLatestMessageText(messageText);
            setIsDraft(!isFinal);
        }
    }, [latestMessage]);

    return (
        <div className="app-container">
            {/* Header */}
            <header className="chat-header">
                <div className="header-content">
                    <h1 className="app-title">👁️ View Only - Listener</h1>
                    <div className="connection-info">
                        {isJoiningRoom && (
                            <span className="status-badge creating">
                                ⏳ Joining room...
                            </span>
                        )}
                        {chatId && (
                            <span
                                className={`status-badge ${
                                    connectionStatus === "connected"
                                        ? "connected"
                                        : "disconnected"
                                }`}
                            >
                                {connectionStatus === "connected"
                                    ? "🟢 Listening"
                                    : "🔴 Disconnected"}
                            </span>
                        )}
                    </div>
                </div>
                {error && <div className="error-message">⚠️ {error}</div>}
                {chatId && (
                    <div className="room-info">
                        <span className="room-id">Key: {chatId}</span>
                    </div>
                )}
            </header>

            {/* Display Area - Large Text */}
            <main className="display-container">
                {!latestMessageText ? (
                    <div className="waiting-state">
                        <div className="waiting-icon">👂</div>
                        <p className="waiting-text">Waiting for messages...</p>
                        <p className="waiting-hint">
                            Messages from sender will appear here in large text
                        </p>
                    </div>
                ) : (
                    <div className="message-display">
                        <div
                            className={`large-text ${isDraft ? "typing" : ""}`}
                        >
                            {latestMessageText}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
