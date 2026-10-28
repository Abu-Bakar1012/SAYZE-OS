import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { default as SyntaxHighlighter } from "react-syntax-highlighter/dist/esm/prism-light";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";

const LANGUAGE_ALIASES = {
  html: "markup",
  js: "javascript",
  py: "python",
  sh: "bash",
  xml: "markup",
};
const SUPPORTED_LANGUAGES = new Set([
  "bash",
  "css",
  "javascript",
  "json",
  "markup",
  "python",
  "sql",
]);

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("markup", markup);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("sql", sql);

export default function MarkdownResponse({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children, ...props }) {
          const sourceLanguage = /language-(\w+)/.exec(className || "")?.[1];
          const language =
            LANGUAGE_ALIASES[sourceLanguage] || sourceLanguage;
          if (language && SUPPORTED_LANGUAGES.has(language)) {
            return (
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                PreTag="div"
                customStyle={{ margin: "0.75rem 0", borderRadius: "0.7rem" }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          }
          if (sourceLanguage) {
            return <code className="markdown-code-block">{children}</code>;
          }
          return (
            <code className="markdown-inline-code" {...props}>
              {children}
            </code>
          );
        },
        a({ children, href, ...props }) {
          return (
            <a href={href} target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
