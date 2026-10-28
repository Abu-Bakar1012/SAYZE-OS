import { useState } from "react";
import {
  Activity,
  BrainCircuit,
  Check,
  Clock3,
  Copy,
  Globe2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const TABS = [
  { id: "routing", label: "Model Routing", icon: BrainCircuit },
  { id: "privacy", label: "Privacy Air-Gap Log", icon: LockKeyhole },
  { id: "metrics", label: "Latency & Tokens", icon: Activity },
];

function highlightTokens(value) {
  if (!value) return "No data yet";
  const segments = value.split(/(\[(?:EMAIL|PHONE|CREDIT_CARD|SSN)_TOKEN_\d+\])/g);
  return segments.map((segment, index) => {
    if (/^\[(?:EMAIL|PHONE|CREDIT_CARD|SSN)_TOKEN_\d+\]$/.test(segment)) {
      return (
        <span className="telemetry-token" key={`${segment}-${index}`}>
          {segment}
        </span>
      );
    }
    return segment;
  });
}

function RoutingCard({ title, detail, selected, icon: Icon, status }) {
  return (
    <div
      className={`telemetry-route ${selected ? "telemetry-route--active" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <span className="telemetry-route__icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="telemetry-route__body">
        <span className="telemetry-route__title">{title}</span>
        <span className="telemetry-route__detail">{detail}</span>
      </span>
      <span className={`telemetry-route__status ${selected ? "is-active" : ""}`}>
        <i aria-hidden="true" />
        {selected ? "Selected" : status}
      </span>
    </div>
  );
}

function MetricBar({ label, value, detail, width, icon: Icon, tone = "cyan" }) {
  return (
    <div className={`telemetry-metric telemetry-metric--${tone}`}>
      <div className="telemetry-metric__header">
        <span className="telemetry-metric__label">
          <Icon size={15} aria-hidden="true" />
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      <div
        className="telemetry-meter"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
      >
        <motion.span
          className="telemetry-meter__fill"
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </div>
      <p className="telemetry-metric__detail">{detail}</p>
    </div>
  );
}

export default function ModelLogViewer({
  activeModel = "",
  latestRequest,
  auditLogs = [],
  auditError = "",
  selectedTab,
  onSelectedTabChange,
}) {
  const [internalTab, setInternalTab] = useState("routing");
  const activeTab = selectedTab ?? internalTab;
  const [copyState, setCopyState] = useState("");
  const isWebRoute = activeModel.includes("Lightning") || activeModel.includes("Tavily");
  const protectedCount = latestRequest?.piiTokensProtected ?? 0;
  const latencyMs = latestRequest?.latencyMs;
  const latencyMeter = Number.isFinite(latencyMs)
    ? Math.max(4, Math.min(100, (latencyMs / 10_000) * 100))
    : 0;
  const tokenMeter = Math.min(100, protectedCount * 12);
  const payload = latestRequest?.responsePayload;

  async function copyToClipboard(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(`${label} copied`);
      window.setTimeout(() => setCopyState(""), 1800);
    } catch {
      setCopyState("Clipboard unavailable");
      window.setTimeout(() => setCopyState(""), 2400);
    }
  }

  function changeTab(tab) {
    if (onSelectedTabChange) onSelectedTabChange(tab);
    else setInternalTab(tab);
  }

  return (
    <aside
      className="telemetry-panel side-panel rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-md"
      aria-label="AI telemetry and model inspector"
    >
      <div className="telemetry-panel__heading">
        <div>
          <p className="telemetry-kicker">
            <Activity size={13} aria-hidden="true" />
            SYSTEM TELEMETRY
          </p>
          <h2>Model Inspector</h2>
        </div>
        <span className="telemetry-live">
          <i aria-hidden="true" />
          LIVE
        </span>
      </div>

      <div className="telemetry-tabs" role="tablist" aria-label="Telemetry views">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            className={`telemetry-tab ${activeTab === id ? "is-active" : ""}`}
            id={`telemetry-tab-${id}`}
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`telemetry-panel-${id}`}
            onClick={() => changeTab(id)}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
            {activeTab === id && (
              <motion.span
                className="telemetry-tab__underline"
                layoutId="telemetry-tab-underline"
              />
            )}
          </button>
        ))}
      </div>

      <div
        id={`telemetry-panel-${activeTab}`}
        className="telemetry-content"
        role="tabpanel"
        aria-labelledby={`telemetry-tab-${activeTab}`}
        tabIndex={0}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.17, ease: "easeOut" }}
          >
            {activeTab === "routing" && (
              <section className="telemetry-section">
                <div className="telemetry-section__title">
                  <span>ROUTING DECISION</span>
                  {latestRequest && (
                    <span className="telemetry-model-label">{activeModel}</span>
                  )}
                </div>
                <div className="telemetry-route-list">
                  <RoutingCard
                    title="Nemotron-3-Ultra-550b"
                    detail="Deep reasoning · direct inference"
                    selected={Boolean(activeModel) && !isWebRoute}
                    status={activeModel ? "Standby" : "Ready"}
                    icon={BrainCircuit}
                  />
                  <RoutingCard
                    title="Nemotron-Lightning + Tavily"
                    detail="Fast inference · grounded web search"
                    selected={Boolean(activeModel) && isWebRoute}
                    status={activeModel ? "Standby" : "Ready"}
                    icon={Globe2}
                  />
                </div>
                {!latestRequest && (
                  <p className="telemetry-empty">
                    Route selection appears after the first completed request.
                  </p>
                )}

                <div className="telemetry-subheading">
                  <Clock3 size={14} aria-hidden="true" />
                  RECENT AUDIT EVENTS
                  <span>{auditLogs.length}</span>
                </div>
                {auditLogs.length ? (
                  <ul className="telemetry-audit-list">
                    {auditLogs.slice(0, 4).map((record) => (
                      <li className="telemetry-audit-item" key={record.id}>
                        <span className="telemetry-audit-item__model">
                          {record.model_used}
                        </span>
                        <span className="telemetry-audit-item__meta">
                          {record.pii_tokens_masked} protected
                          <time dateTime={record.timestamp}>
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </time>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="telemetry-empty">No audit events recorded.</p>
                )}
                {auditError && (
                  <p className="telemetry-error" role="status">{auditError}</p>
                )}
              </section>
            )}

            {activeTab === "privacy" && (
              <section className="telemetry-section">
                <div className="telemetry-section__title">
                  <span>LOCAL SANITIZATION TRACE</span>
                  <span className="telemetry-private">
                    <ShieldCheck size={12} aria-hidden="true" />
                    ON-DEVICE
                  </span>
                </div>
                {latestRequest ? (
                  <>
                    <div className="telemetry-comparison">
                      <div className="telemetry-comparison__column">
                        <div className="telemetry-comparison__label">
                          <span className="telemetry-indicator telemetry-indicator--raw" />
                          Raw Input
                          <span>LOCAL</span>
                        </div>
                        <span className="telemetry-detected-pill">
                          {protectedCount} value{protectedCount === 1 ? "" : "s"} detected
                        </span>
                        <p className="telemetry-code">
                          {latestRequest.originalPrompt}
                        </p>
                      </div>
                      <div className="telemetry-comparison__column telemetry-comparison__column--sanitized">
                        <div className="telemetry-comparison__label">
                          <span className="telemetry-indicator telemetry-indicator--safe" />
                          Local Sanitized Output
                          <span>EGRESS-SAFE</span>
                        </div>
                        <p className="telemetry-code telemetry-code--sanitized">
                          {highlightTokens(latestRequest.sanitizedPrompt)}
                        </p>
                      </div>
                    </div>
                    <div className="telemetry-actions">
                      <button
                        type="button"
                        className="telemetry-copy"
                        onClick={() =>
                          copyToClipboard(latestRequest.sanitizedPrompt, "Sanitized prompt")
                        }
                      >
                        {copyState === "Sanitized prompt copied" ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                        Copy sanitized prompt
                      </button>
                      <span className="telemetry-protected-count">
                        <ShieldCheck size={13} aria-hidden="true" />
                        {protectedCount} token{protectedCount === 1 ? "" : "s"} protected
                      </span>
                    </div>
                    {payload && (
                      <details className="telemetry-payload">
                        <div className="telemetry-payload__header">
                          <summary>API response payload</summary>
                          <button
                            className="telemetry-copy telemetry-copy--inline"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyToClipboard(
                                JSON.stringify(payload, null, 2),
                                "Response payload",
                              );
                            }}
                          >
                            {copyState === "Response payload copied" ? (
                              <Check size={12} aria-hidden="true" />
                            ) : (
                              <Copy size={12} aria-hidden="true" />
                            )}
                            Copy JSON
                          </button>
                        </div>
                        <pre>{JSON.stringify(payload, null, 2)}</pre>
                      </details>
                    )}
                    {copyState && (
                      <p className="telemetry-copy-status" role="status">
                        {copyState}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="telemetry-empty">
                    Sanitization traces appear after a completed request. Raw
                    input is shown locally and is not included in audit records.
                  </p>
                )}
              </section>
            )}

            {activeTab === "metrics" && (
              <section className="telemetry-section">
                <div className="telemetry-section__title">
                  <span>REQUEST PERFORMANCE</span>
                  <Zap size={14} aria-hidden="true" />
                </div>
                <div className="telemetry-metrics">
                  <MetricBar
                    label="End-to-end latency"
                    value={Number.isFinite(latencyMs) ? `${Math.round(latencyMs)} ms` : "—"}
                    detail={
                      Number.isFinite(latencyMs)
                        ? "Browser-measured request duration"
                        : "Measured after the next request"
                    }
                    width={latencyMeter}
                    icon={Zap}
                  />
                  <MetricBar
                    label="PII tokens protected"
                    value={protectedCount.toLocaleString()}
                    detail="Sensitive values replaced before provider egress"
                    width={tokenMeter}
                    icon={ShieldCheck}
                    tone="shield"
                  />
                </div>
                <div className="telemetry-metric-foot">
                  <span>Current route</span>
                  <strong>{activeModel || "Awaiting request"}</strong>
                </div>
                <p className="telemetry-empty">
                  Latency is measured client-side from request start through API
                  response. Token count reflects the latest completed request.
                </p>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}
