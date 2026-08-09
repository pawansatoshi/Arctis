'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// MarkdownContent — renders AI chat messages with proper
// markdown: code blocks (with copy button), tables, lists,
// headings, links. Shared between AI Workspace and Copilot so
// there's one place to maintain chat-message rendering.
// ============================================================

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className ?? '')?.[1];
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group/code my-2 rounded-lg overflow-hidden border border-black/[0.08] dark:border-white/[0.08]">
      {language && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-900/[0.04] dark:bg-black/30 border-b border-black/[0.06] dark:border-white/[0.06]">
          <span className="text-surface-500 text-[10px] font-mono uppercase tracking-wide">{language}</span>
        </div>
      )}
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        className={cn(
          'absolute top-1.5 right-1.5 p-1.5 rounded-md bg-surface-900/10 dark:bg-white/10 text-surface-600 dark:text-surface-400',
          'opacity-0 group-hover/code:opacity-100 transition-opacity hover:bg-surface-900/20 dark:hover:bg-white/20',
          language && 'top-8'
        )}
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
      <pre className="overflow-x-auto p-3 bg-surface-900 dark:bg-black/40 text-[13px] leading-relaxed">
        <code className="font-mono text-surface-100 dark:text-surface-200">{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose-chat text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0 whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-surface-950">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1.5 text-surface-950">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[15px] font-semibold mt-3 mb-1.5 text-surface-950">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2.5 mb-1 text-surface-950">{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-500/40 pl-3 my-2 text-surface-600 italic">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-black/[0.08] dark:border-white/[0.08]" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08]">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-900/[0.04] dark:bg-white/[0.04]">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-surface-950 border-b border-black/[0.08] dark:border-white/[0.08]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">{children}</td>,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-surface-900/[0.06] dark:bg-white/10 text-[13px] font-mono text-rose-600 dark:text-rose-400" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
