import { useState, useRef, useCallback, useEffect } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { io, Socket } from "socket.io-client";
import styles from "./CallButton.module.css";

type CallStatus = "idle" | "connecting" | "active" | "ended" | "error";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CallButton() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [agentMode, setAgentMode] = useState<"AI" | "HUMAN">("AI");
  const [transcript, setTranscript] = useState<
    Array<{ role: string; content: string }>
  >([]);

  const retellClientRef = useRef<RetellWebClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastTranscriptLengthRef = useRef<number>(0);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Forward new transcript entries to the backend via Socket.io
  useEffect(() => {
    if (!socketRef.current?.connected || !sessionIdRef.current) {
      return;
    }
    
    // Only send new entries (compare with last known length)
    const newEntries = transcript.slice(lastTranscriptLengthRef.current);
    lastTranscriptLengthRef.current = transcript.length;
    
    // Emit each new transcript entry to the backend
    for (const entry of newEntries) {
      console.log(`📤 Forwarding transcript [${sessionIdRef.current}]:`, entry.role, entry.content.substring(0, 30));
      socketRef.current.emit("voice:transcript", {
        sessionId: sessionIdRef.current,
        role: entry.role,
        content: entry.content,
        timestamp: Date.now(),
      });
    }
  }, [transcript]);

  // Initialize Retell client on mount
  useEffect(() => {
    retellClientRef.current = new RetellWebClient();

    // Set up event listeners
    const client = retellClientRef.current;

    client.on("call_started", () => {
      console.log("✅ Retell call started");
      setStatus("active");
      setError(null);
    });

    client.on("call_ended", () => {
      console.log("📞 Retell call ended");
      setStatus("ended");
      setTimeout(() => setStatus("idle"), 2000);
    });

    client.on("error", (err) => {
      console.error("❌ Retell error:", err);
      setError(err.message || "Call failed");
      setStatus("error");
      setTimeout(() => {
        setStatus("idle");
        setError(null);
      }, 3000);
    });

    client.on("update", (update) => {
      // Handle transcript updates
      if (update.transcript) {
        setTranscript(update.transcript);
      }
    });

    return () => {
      // Cleanup on unmount
      if (retellClientRef.current) {
        retellClientRef.current.stopCall();
      }
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!retellClientRef.current) {
      setError("Call client not initialized");
      return;
    }

    setStatus("connecting");
    setError(null);
    setTranscript([]);
    lastTranscriptLengthRef.current = 0;

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create web call via backend
      const response = await fetch(`${API_URL}/api/voice/web-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || errorData.error || "Failed to create call"
        );
      }

      const data = await response.json();
      console.log("📞 Web call created:", data);

      sessionIdRef.current = data.sessionId;

      // Connect to Socket.io to forward transcript updates to agents
      if (!socketRef.current) {
        socketRef.current = io(API_URL, {
          transports: ["websocket", "polling"],
        });
        
        socketRef.current.on("connect", () => {
          console.log("🔌 Voice call socket connected:", socketRef.current?.id);
          // Join the room once connected
          if (sessionIdRef.current) {
            socketRef.current?.emit("voice:join", { sessionId: sessionIdRef.current });
            console.log("🔌 Joined voice call room:", sessionIdRef.current);
          }
        });
        
        socketRef.current.on("disconnect", () => {
          console.log("🔌 Voice call socket disconnected");
        });
      } else if (socketRef.current.connected) {
        // Socket already connected, join immediately
        socketRef.current.emit("voice:join", { sessionId: data.sessionId });
        console.log("🔌 Joined voice call room:", data.sessionId);
      }
      // If not connected yet, the connect handler above will join when ready

      // Start the Retell call with the access token
      await retellClientRef.current.startCall({
        accessToken: data.accessToken,
      });
    } catch (err) {
      console.error("❌ Failed to start call:", err);
      setError(err instanceof Error ? err.message : "Failed to start call");
      setStatus("error");
      setTimeout(() => {
        setStatus("idle");
        setError(null);
      }, 3000);
    }
  }, []);

  const endCall = useCallback(() => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    
    // Notify backend that call ended
    if (socketRef.current && sessionIdRef.current) {
      socketRef.current.emit("voice:end", { sessionId: sessionIdRef.current });
    }
    
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const toggleMute = useCallback(() => {
    if (retellClientRef.current && status === "active") {
      if (isMuted) {
        retellClientRef.current.unmute();
      } else {
        retellClientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  }, [isMuted, status]);

  const handleCall = async () => {
    if (status === "idle") {
      await startCall();
    } else if (status === "active") {
      endCall();
    }
  };

  // Transfer to human representative
  const transferToHuman = useCallback(async () => {
    if (!sessionIdRef.current || isTransferring) return;
    
    setIsTransferring(true);
    try {
      const response = await fetch(`${API_URL}/api/switch/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: sessionIdRef.current,
          direction: "AI_TO_HUMAN",
          reason: "CUSTOMER_BUTTON",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to transfer");
      }

      const data = await response.json();
      if (data.success) {
        setAgentMode("HUMAN");
        // Add a system message to transcript
        setTranscript((prev) => [
          ...prev,
          { role: "system", content: "Connecting you with a human representative..." },
        ]);
      }
    } catch (err) {
      console.error("Transfer error:", err);
      setError("Unable to transfer. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  }, [isTransferring]);

  const isInCall = status === "active" || status === "connecting";

  return (
    <div className={`${styles.container} ${isInCall ? styles.inCall : ""}`}>
      {/* Call Controls Section */}
      <div className={styles.controlsSection}>
        <div className={styles.visualization}>
          <div
            className={`${styles.rings} ${
              status === "active" ? styles.active : ""
            }`}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>

          <button
            className={`${styles.callButton} ${styles[status]}`}
            onClick={handleCall}
            disabled={status === "connecting" || status === "ended"}
          >
            {status === "idle" && "📞"}
            {status === "connecting" && "⏳"}
            {status === "active" && "📴"}
            {status === "ended" && "✓"}
            {status === "error" && "❌"}
          </button>
        </div>

        <div className={styles.statusText}>
          {status === "idle" && "Tap to start voice call"}
          {status === "connecting" && "Connecting to AI agent..."}
          {status === "active" && "Speaking with AI Agent"}
          {status === "ended" && "Call ended"}
          {status === "error" && (error || "Connection failed")}
        </div>

        {status === "active" && (
          <div className={styles.controls}>
            <button
              className={`${styles.controlButton} ${
                isMuted ? styles.muted : ""
              }`}
              onClick={toggleMute}
            >
              {isMuted ? "🔇 Unmute" : "🎙️ Mute"}
            </button>
            {agentMode === "AI" && (
              <button
                className={`${styles.controlButton} ${styles.humanButton}`}
                onClick={transferToHuman}
                disabled={isTransferring}
              >
                {isTransferring ? "⏳ Connecting..." : "👤 Talk to Human"}
              </button>
            )}
            <button
              className={`${styles.controlButton} ${styles.endButton}`}
              onClick={endCall}
            >
              📞 End Call
            </button>
          </div>
        )}

        {status === "active" && agentMode === "HUMAN" && (
          <div className={styles.humanModeIndicator}>
            👤 Connected with Human Representative
          </div>
        )}
      </div>

      {/* Transcript Section - visible during and after calls */}
      {(isInCall || transcript.length > 0) && (
        <div className={styles.transcriptSection}>
          <div className={styles.transcriptHeader}>
            <span className={styles.transcriptIcon}>📝</span>
            <span className={styles.transcriptTitle}>Live Transcript</span>
            {status === "active" && (
              <span className={styles.liveIndicator}>
                <span className={styles.liveDot}></span>
                LIVE
              </span>
            )}
          </div>

          <div className={styles.transcriptList}>
            {transcript.length === 0 ? (
              <div className={styles.transcriptEmpty}>
                <span className={styles.emptyIcon}>🎤</span>
                <p>Transcript will appear here as you speak...</p>
              </div>
            ) : (
              <>
                {transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`${styles.transcriptEntry} ${
                      entry.role === "agent" ? styles.agent : styles.user
                    }`}
                  >
                    <div className={styles.entryHeader}>
                      <span className={styles.role}>
                        {entry.role === "agent" ? "🤖 AI Agent" : "👤 You"}
                      </span>
                    </div>
                    <p className={styles.entryContent}>{entry.content}</p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
