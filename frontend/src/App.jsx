import { useState } from "react";
import axios from "axios";
import confetti from "canvas-confetti";
import { KeyRound } from "lucide-react";
import ChatWindow from "./components/ChatWindow";
import HeaderBar from "./components/HeaderBar";
import ModelLogViewer from "./components/ModelLogViewer";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  timeout: 60_000,
});

function createMessageId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export default function App() {
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const [latestRequest, setLatestRequest] = useState(null);
  const [piiProtected, setPiiProtected] = useState(0);
  const [nebiusConnected, setNebiusConnected] = useState(false);
  const [privacyView, setPrivacyView] = useState(true);
  const [telemetryTab, setTelemetryTab] = useState("routing");
  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");

  async function loadAuditLogs(bearerToken) {
    try {
      const response = await api.get("/api/v1/audit-logs", {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      setAuditLogs(response.data);
      setAuditError("");
    } catch (requestError) {
      setAuditError(
        requestError.response?.data?.detail ||
          "The audit log could not be refreshed.",
      );
    }
  }

  async function sendMessage(prompt) {
    setError("");
    setAuditError("");
    setLoading(true);
    const messageId = createMessageId();
    const startedAt = performance.now();
    setMessages((current) => [
      ...current,
      { id: messageId, role: "user", content: prompt },
    ]);

    try {
      const response = await api.post(
        "/api/v1/execute",
        { prompt },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const result = response.data;
      const latencyMs = performance.now() - startedAt;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, sanitizedContent: result.sanitized_prompt }
            : message,
        ).concat({
          id: createMessageId(),
          role: "assistant",
          content: result.final_response,
        }),
      );
      setLatestRequest({
        originalPrompt: prompt,
        sanitizedPrompt: result.sanitized_prompt,
        rawResponse: result.raw_response,
        piiTokensProtected: result.pii_tokens_protected,
        latencyMs,
        responsePayload: result,
      });
      setActiveModel(result.model_used);
      setNebiusConnected(true);
      setPiiProtected((current) => current + result.pii_tokens_protected);
      if (result.pii_tokens_protected >= 3) {
        confetti({
          particleCount: 70,
          spread: 62,
          origin: { y: 0.72 },
          colors: ["#00F0FF", "#10B981", "#8B5CF6", "#E2E8F0"],
          ticks: 150,
          disableForReducedMotion: true,
        });
      }
      await loadAuditLogs(token);
    } catch (requestError) {
      setNebiusConnected(false);
      setError(
        requestError.response?.data?.detail ||
          "Unable to reach SAYZE. Check the API connection and token, then try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <HeaderBar
        protectedCount={piiProtected}
        activeModel={activeModel}
        nebiusConnected={nebiusConnected}
      />

      <div className="workspace">
        <section className="conversation-column">
          <div className="workspace-title">
            <div>
              <p className="eyebrow">Executive assistant</p>
              <h1>Think clearly. Move faster.</h1>
            </div>
            <div className="token-control">
              <KeyRound size={15} aria-hidden="true" />
              <label className="sr-only" htmlFor="api-token">
                SAYZE app bearer token
              </label>
              <input
                id="api-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste SAYZE_API_TOKEN"
                aria-describedby="token-help"
              />
              <span className="sr-only" id="token-help">
                Use SAYZE_API_TOKEN from backend/.env, not your Nebius or Tavily
                provider key. The token stays in memory and is sent only to your
                SAYZE API.
              </span>
            </div>
          </div>

          {!token.trim() && (
            <div className="notice-banner" role="note">
              Nebius and Tavily keys configure the backend; they are not the
              browser login. Paste the separate SAYZE_API_TOKEN from
              <code> backend/.env</code> above to send messages. This app token
              stays in memory and is not saved in browser storage.
            </div>
          )}

          <ChatWindow
            messages={messages}
            onSend={sendMessage}
            loading={loading}
            error={error}
            privacyView={privacyView}
            onPrivacyViewChange={setPrivacyView}
            onViewPrivacyLog={() => setTelemetryTab("privacy")}
            tokenMissing={!token.trim()}
          />
          <p className="workspace-footnote">
            SAYZE can make mistakes. Review important information before acting.
          </p>
        </section>

        <ModelLogViewer
          activeModel={activeModel}
          latestRequest={latestRequest}
          auditLogs={auditLogs}
          auditError={auditError}
          selectedTab={telemetryTab}
          onSelectedTabChange={setTelemetryTab}
        />
      </div>
    </main>
  );
}
