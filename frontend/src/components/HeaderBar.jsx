import { motion } from "framer-motion";
import { Bot, Radio, Search } from "lucide-react";
import SecurityBadge from "./SecurityBadge";

function StatusIndicator({ label, status, icon: Icon, active = false }) {
  return (
    <div className="header-status" role="status" aria-label={`${label}: ${status}`}>
      {Icon ? (
        <Icon className="header-status__icon" size={13} aria-hidden="true" />
      ) : (
        <span
          className={`header-status__dot ${active ? "is-active" : ""}`}
          aria-hidden="true"
        />
      )}
      <span className="header-status__label">{label}</span>
      <span className={active ? "header-status__value is-active" : "header-status__value"}>
        {status}
      </span>
    </div>
  );
}

export default function HeaderBar({
  protectedCount = 0,
  activeModel = "",
  nebiusConnected = false,
}) {
  const tavilyActive = activeModel.includes("Tavily");
  const nebiusStatus = nebiusConnected ? "Connected" : "Standby";

  return (
    <motion.header
      className="topbar -mx-[42px] border-b border-slate-800/80 bg-slate-900/60 px-[42px] backdrop-blur-xl"
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <motion.a
        className="brand"
        href="/"
        aria-label="SAYZE OS home"
        whileHover={{ y: -1 }}
      >
        <motion.span
          className="brand__mark"
          animate={{
            boxShadow: [
              "0 0 10px rgba(0, 240, 255, 0.12)",
              "0 0 22px rgba(0, 240, 255, 0.38)",
              "0 0 10px rgba(0, 240, 255, 0.12)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Bot size={22} aria-hidden="true" />
        </motion.span>
        <span>
          <span className="brand__name">
            SAYZE <b>OS</b>
          </span>
          <span className="brand__caption">Personal intelligence, protected</span>
        </span>
        <span className="header-version">v1.0 Zero-Trust</span>
      </motion.a>

      <div className="topbar__status">
        <div className="header-quick-status" aria-label="Provider status">
          <StatusIndicator
            label="Nebius Token Factory"
            status={nebiusStatus}
            active={nebiusConnected}
          />
          <StatusIndicator
            label="Tavily Search"
            status={tavilyActive ? "Active" : "Standby"}
            active={tavilyActive}
            icon={Search}
          />
        </div>
        <SecurityBadge protectedCount={protectedCount} />
        <span className="system-status">
          <Radio size={13} aria-hidden="true" />
          CORE ENGINE
        </span>
      </div>
    </motion.header>
  );
}
