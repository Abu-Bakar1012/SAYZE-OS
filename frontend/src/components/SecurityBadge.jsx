import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export default function SecurityBadge({ protectedCount = 0 }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const countValue = useMotionValue(0);
  const roundedCount = useTransform(countValue, (value) =>
    Math.round(value).toLocaleString(),
  );
  const isProtecting = protectedCount > 0;

  useEffect(() => {
    const controls = animate(countValue, protectedCount, {
      duration: 0.55,
      ease: "easeOut",
    });
    return controls.stop;
  }, [countValue, protectedCount]);

  return (
    <motion.div
      className="security-badge-wrap"
      onHoverStart={() => setTooltipOpen(true)}
      onHoverEnd={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setTooltipOpen(false);
        }
      }}
    >
      <motion.button
        className="security-badge"
        type="button"
        aria-label={`Local PII Guardrail Active. PII Protected: ${protectedCount} tokens. Details`}
        aria-expanded={tooltipOpen}
        aria-describedby="nemoclaw-status-detail"
        whileHover={{ y: -1, scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="security-badge__icon" aria-hidden="true">
          {isProtecting && (
            <motion.span
              className="security-badge__pulse"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.85, 1.7], opacity: [0.6, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          )}
          <ShieldCheck size={17} />
        </span>
        <span className="security-badge__active">Local PII Guardrail</span>
        <span className="security-badge__divider" aria-hidden="true" />
        <span className="security-badge__count">
          PII Protected: <motion.span>{roundedCount}</motion.span> tokens
        </span>
      </motion.button>

      <motion.div
        id="nemoclaw-status-detail"
        className="security-tooltip"
        role="tooltip"
        initial={false}
        animate={
          tooltipOpen
            ? { opacity: 1, y: 0, pointerEvents: "auto" }
            : { opacity: 0, y: 6, pointerEvents: "none" }
        }
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <span className="security-tooltip__eyebrow">Privacy guardrail</span>
        <strong>Regex-based local PII sanitization</strong>
        <span>
          Common email, phone, credit card, and SSN patterns are tokenized
          locally before the sanitized prompt is sent to configured providers.
          This pattern-based guardrail is not a guarantee that every sensitive
          value will be detected.
        </span>
      </motion.div>
    </motion.div>
  );
}
