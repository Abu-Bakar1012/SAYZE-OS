import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const MarkdownResponse = lazy(() => import("./MarkdownResponse"));

const QUICK_PROMPTS = [
  {
    label: "Check my flight",
    prompt: "Check my flight with email test@example.com",
    icon: Search,
  },
  {
    label: "Latest Nebius news",
    prompt: "Summarize latest Nebius AI news",
    icon: Sparkles,
  },
];
const MAX_ATTACHMENT_SIZE = 100_000;

function StreamedResponse({ content }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleLength(content.length);
      return undefined;
    }
    setVisibleLength(0);
    let currentLength = 0;
    const interval = window.setInterval(() => {
      currentLength = Math.min(content.length, currentLength + 18);
      setVisibleLength(currentLength);
      if (currentLength >= content.length) window.clearInterval(interval);
    }, 12);

    return () => window.clearInterval(interval);
  }, [content, prefersReducedMotion]);

  return (
    <div className="markdown-response">
      <Suspense fallback={<p>{content.slice(0, visibleLength)}</p>}>
        <MarkdownResponse content={content.slice(0, visibleLength)} />
      </Suspense>
      {visibleLength < content.length && (
        <span className="stream-cursor" aria-hidden="true" />
      )}
    </div>
  );
}

export default function ChatWindow({
  messages,
  onSend,
  loading,
  error,
  privacyView,
  onPrivacyViewChange,
  onViewPrivacyLog,
  tokenMissing,
}) {
  const [prompt, setPrompt] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const historyRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function handleAttachmentChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!/\.(txt|md|csv)$/i.test(file.name)) {
      setAttachmentError("Attach a plain-text, Markdown, or CSV file.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setAttachmentError("Attachments must be smaller than 100 KB.");
      return;
    }

    try {
      const content = await file.text();
      setAttachment({ name: file.name, content });
      setAttachmentError("");
    } catch {
      setAttachmentError("This file could not be read locally.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const value = prompt.trim();
    if ((!value && !attachment) || loading || tokenMissing) return;

    const message = attachment
      ? `${value}${value ? "\n\n" : ""}[Attached file: ${attachment.name}]\n${attachment.content}`
      : value;
    if (message.length > 10_000) {
      setAttachmentError("Prompt and attachment must total 10,000 characters or fewer.");
      return;
    }
    onSend(message);
    setPrompt("");
    setAttachment(null);
    setAttachmentError("");
  }

  async function copyResponse(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(""), 1800);
    } catch {
      setCopiedMessageId("clipboard-unavailable");
      window.setTimeout(() => setCopiedMessageId(""), 2200);
    }
  }

  function useQuickPrompt(value) {
    if (!tokenMissing && !loading) onSend(value);
  }

  return (
    <section className="chat-card command-center" aria-label="Assistant conversation">
      <div className="chat-card__header">
        <div>
          <p className="eyebrow">Private workspace</p>
          <h2>Conversation</h2>
        </div>
        <label className="privacy-toggle">
          <input
            type="checkbox"
            checked={privacyView}
            onChange={(event) => onPrivacyViewChange(event.target.checked)}
          />
          <span className="privacy-toggle__track" aria-hidden="true">
            <span />
          </span>
          <span className="privacy-toggle__label">
            {privacyView ? (
              <LockKeyhole size={14} aria-hidden="true" />
            ) : (
              <Eye size={14} aria-hidden="true" />
            )}
            {privacyView ? "Private display" : "Show original prompts"}
          </span>
        </label>
      </div>

      <div className="chat-history" ref={historyRef} aria-live="polite">
        {messages.length === 0 ? (
          <motion.div
            className="executive-hero"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <span className="executive-hero__icon">
              <ShieldCheck size={24} aria-hidden="true" />
            </span>
            <p className="executive-hero__eyebrow">PRIVATE BY DESIGN</p>
            <h3>Zero-Trust Executive Intelligence</h3>
            <p className="executive-hero__description">
              Research, reason, and get things done. Sensitive details are
              tokenized locally before your request reaches an AI provider.
            </p>
            <div className="quick-prompt-list" aria-label="Suggested prompts">
              {QUICK_PROMPTS.map(({ label, prompt: value, icon: Icon }) => (
                <button
                  className="quick-prompt-chip"
                  key={label}
                  type="button"
                  onClick={() => useQuickPrompt(value)}
                  disabled={tokenMissing || loading}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                  <span className="quick-prompt-chip__example">{value}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const isUser = message.role === "user";
              const visibleContent =
                isUser && privacyView
                  ? message.sanitizedContent || "Private prompt — sanitization pending"
                  : message.content;
              const hasSearchIntent =
                isUser && /\b(search|latest|news|price|flight|weather)\b/i.test(
                  message.content,
                );

              return (
                <motion.article
                  className={`message message--${message.role}`}
                  key={message.id}
                  initial={{ opacity: 0, y: 10, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <div className="message__meta">
                    <span>{isUser ? "You" : "SAYZE"}</span>
                    {isUser && privacyView && message.sanitizedContent && (
                      <span className="message__privacy">
                        <ShieldCheck size={12} aria-hidden="true" />
                        Sanitized view
                      </span>
                    )}
                    {hasSearchIntent && (
                      <span className="message__search">
                        <Search size={12} aria-hidden="true" />
                        Web search
                      </span>
                    )}
                  </div>

                  <div className="message__content">
                    {isUser ? (
                      <p>{visibleContent}</p>
                    ) : (
                      <StreamedResponse content={message.content} />
                    )}
                  </div>

                  {!isUser && (
                    <div className="message__actions">
                      <button
                        className="message-action"
                        type="button"
                        onClick={() => copyResponse(message)}
                      >
                        {copiedMessageId === message.id ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                        {copiedMessageId === message.id
                          ? "Copied"
                          : "Copy response"}
                      </button>
                      <button
                        className="message-action"
                        type="button"
                        onClick={onViewPrivacyLog}
                      >
                        <ShieldCheck size={13} aria-hidden="true" />
                        View privacy log
                      </button>
                      {copiedMessageId === "clipboard-unavailable" && (
                        <span className="message-action-status" role="status">
                          Clipboard unavailable
                        </span>
                      )}
                    </div>
                  )}
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}

        {loading && (
          <motion.div
            className="thinking-indicator"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="thinking-indicator__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            SAYZE is preparing a protected response…
          </motion.div>
        )}
        {(error || attachmentError) && (
          <p className="error-banner" role="alert">
            {error || attachmentError}
          </p>
        )}
      </div>

      <form className="composer composer--executive" onSubmit={handleSubmit}>
        {attachment && (
          <div className="attachment-chip">
            <FileText size={13} aria-hidden="true" />
            <span>{attachment.name} · read locally</span>
            <button
              type="button"
              aria-label={`Remove ${attachment.name}`}
              onClick={() => setAttachment(null)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="composer__pill">
          <button
            className="composer-control"
            type="button"
            aria-label="Attach a text file"
            title="Attach a text, Markdown, or CSV file (100 KB max)"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <Paperclip size={17} aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
            onChange={handleAttachmentChange}
            tabIndex={-1}
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="assistant-prompt">
            Your message
          </label>
          <textarea
            id="assistant-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Message SAYZE…"
            rows={1}
            maxLength={10_000}
            disabled={loading}
            aria-describedby="composer-note"
          />
          <button
            className={`composer-control composer-control--privacy ${
              privacyView ? "is-active" : ""
            }`}
            type="button"
            aria-label={privacyView ? "Private prompt display enabled" : "Private prompt display disabled"}
            aria-pressed={privacyView}
            title="Toggle private display"
            onClick={() => onPrivacyViewChange(!privacyView)}
          >
            {privacyView ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
          <button
            className="send-button"
            type="submit"
            disabled={tokenMissing || loading || (!prompt.trim() && !attachment)}
            aria-label={tokenMissing ? "Enter API token to send message" : "Send message"}
            title={tokenMissing ? "Enter your API token above to send" : "Send message"}
          >
            <Send size={17} aria-hidden="true" />
          </button>
        </div>
        <p className="composer__note" id="composer-note">
          <ShieldCheck size={13} aria-hidden="true" />
          {tokenMissing
            ? "Enter your API token above to send · Your draft stays here"
            : "PII is always sanitized locally · Enter to send · Shift + Enter for newline"}
        </p>
      </form>
    </section>
  );
}
