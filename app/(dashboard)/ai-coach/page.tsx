'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Bot,
  User,
  Send,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  TrendingUp,
  FileText,
  MessageSquare,
  ArrowRight,
  Info,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'claude-3-5-sonnet' | 'local-engine';
}

const STARTER_QUESTIONS = [
  'Can I afford a ₹15,000 gadget purchase this month?',
  'Where did most of my money go compared to last month?',
  'How can I reach my Emergency Fund goal 2 months earlier?',
  'What happens if my rent increases by ₹2,000 next month?',
];

// Helper to render markdown headings, lists, bold text, and disclaimers nicely
function FormattedMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Heading 3: ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="font-bold text-xs sm:text-sm text-slate-900 mt-3 pt-2 border-t border-slate-100 first:mt-0 first:pt-0 first:border-0"
            >
              {trimmed.replace('### ', '')}
            </h4>
          );
        }

        // Heading 2: ##
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-sm text-slate-900 mt-3">
              {trimmed.replace('## ', '')}
            </h3>
          );
        }

        // Bullet point: - or *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemContent = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
              <div>{renderInlineFormatting(itemContent)}</div>
            </div>
          );
        }

        // Numbered list: 1. 2.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-bold text-indigo-600 shrink-0">{numMatch[1]}.</span>
              <div>{renderInlineFormatting(numMatch[2])}</div>
            </div>
          );
        }

        // Horizontal rule
        if (trimmed === '---') {
          return <hr key={idx} className="my-2 border-slate-200" />;
        }

        // Disclaimer line
        if (trimmed.includes('Budgeting tool only. Not financial or investment advice.')) {
          return (
            <div
              key={idx}
              className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 font-medium flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{trimmed.replace(/\*/g, '')}</span>
            </div>
          );
        }

        // Regular paragraph
        return <p key={idx}>{renderInlineFormatting(trimmed)}</p>;
      })}
    </div>
  );
}

// Inline formatting helper for **bold** and *italic*
function renderInlineFormatting(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function AiCoachContent() {
  const [activeTab, setActiveTab] = useState<'review' | 'chat'>('review');

  // Review State
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<string | null>(null);
  const [reviewGeneratedAt, setReviewGeneratedAt] = useState<string | null>(null);
  const [generatingReview, setGeneratingReview] = useState<boolean>(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState<boolean>(false);
  const [copiedReview, setCopiedReview] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // Initialize months
  useEffect(() => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const months = [current];

    // Add previous 3 months
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    setAvailableMonths(months);
    setSelectedMonth(current);
  }, []);

  // Fetch or load review when month changes
  useEffect(() => {
    if (!selectedMonth) return;

    async function loadReview() {
      try {
        const today = new Date().toLocaleDateString('en-CA');
        const res = await fetch(`/api/ai/review?month=${selectedMonth}&today=${today}`);
        if (res.ok) {
          const data = await res.json();
          setReviewText(data.review);
          setReviewSource(data.source);
          setReviewGeneratedAt(data.generatedAt);
          setHasAnthropicKey(data.hasAnthropicKey ?? false);
        }
      } catch (err) {
        console.error('Failed to load cached review:', err);
      }
    }

    loadReview();
  }, [selectedMonth]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleGenerateReview = async () => {
    try {
      setGeneratingReview(true);
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          today: new Date().toLocaleDateString('en-CA'),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate review');
      }

      const data = await res.json();
      setReviewText(data.review);
      setReviewSource(data.source);
      setReviewGeneratedAt(data.generatedAt);
      setHasAnthropicKey(data.hasAnthropicKey ?? false);
      toastSuccess('Monthly Financial Review generated!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating review';
      toastError(msg);
    } finally {
      setGeneratingReview(false);
    }
  };

  const handleCopyReview = () => {
    if (!reviewText) return;
    navigator.clipboard.writeText(reviewText);
    setCopiedReview(true);
    toastInfo('Copied review to clipboard');
    setTimeout(() => setCopiedReview(false), 2000);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || sendingChat) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setSendingChat(true);

    try {
      // Build history
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          month: selectedMonth,
          history,
          today: new Date().toLocaleDateString('en-CA'),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error contacting assistant';
      toastError(msg);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">AI Financial Coach</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
              {hasAnthropicKey ? 'AI Assistant (Claude)' : 'Basic Summary Engine'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalized monthly reviews and real-time budgeting answers grounded in your verified numbers.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('review')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'review'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            Monthly Review
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            Interactive Coach
          </button>
        </div>
      </div>

      {/* TAB 1: MONTHLY FINANCIAL REVIEW */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">Review Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {reviewText && (
                <button
                  onClick={handleCopyReview}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                >
                  {copiedReview ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedReview ? 'Copied' : 'Copy'}
                </button>
              )}

              <button
                onClick={handleGenerateReview}
                disabled={generatingReview}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-xs disabled:opacity-50"
              >
                {generatingReview ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating Review...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {reviewText ? 'Regenerate Review' : 'Generate Monthly Review'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Empty State before generation */}
          {!reviewText && !generatingReview && (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3 max-w-lg mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Ready to Generate Your Monthly Review
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our coach analyzes your take-home pay, category spend variances, unpaid bills, and goal feasibility to create a clear 4-part summary with concrete trim ideas.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleGenerateReview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Review for{' '}
                  {selectedMonth
                    ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long' })
                    : 'This Month'}
                </button>
              </div>
            </div>
          )}

          {/* Generating Loading State */}
          {generatingReview && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900">
                  Synthesizing Your Monthly Financial Report...
                </h4>
                <p className="text-xs text-slate-500">
                  Calculating savings rate, comparing discretionary categories against 3-month history, and projecting goal feasibility.
                </p>
              </div>
            </div>
          )}

          {/* Rendered Review Card */}
          {reviewText && !generatingReview && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Monthly Performance Review:{' '}
                    {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  {reviewGeneratedAt && (
                    <span className="text-[11px] text-slate-400">
                      Generated on {new Date(reviewGeneratedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 self-start sm:self-center">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Source: {reviewSource && reviewSource !== 'local-engine' ? `AI Generated (${reviewSource})` : 'Basic Summary (Calculated from recorded data)'}
                </span>
              </div>

              <FormattedMarkdown text={reviewText} />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE ASSISTANT (CHAT) */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-[650px] overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                  Budget Coach Assistant
                </h3>
                <span className="text-[11px] text-slate-500">
                  Ask affordability, category variance, or goal questions
                </span>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <RotateCcw className="w-3 h-3" />
                Clear Chat
              </button>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.length === 0 && (
              <div className="py-8 text-center space-y-4 max-w-md mx-auto">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900">
                    How can I help your budget today?
                  </h4>
                  <p className="text-xs text-slate-500">
                    I calculate answers based strictly on your verified income, bills, and surplus. Try asking one of these:
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 text-left">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSendMessage(q)}
                      className="p-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-indigo-50/50 hover:text-indigo-700 border border-slate-200/80 hover:border-indigo-200 rounded-xl transition text-left flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isUser = m.role === 'user';

              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      isUser ? 'bg-slate-900 text-white' : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-xs'
                        : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs space-y-1.5'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    ) : (
                      <FormattedMarkdown text={m.content} />
                    )}
                    <div
                      className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${
                        isUser ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      <span>{m.timestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {sendingChat && (
              <div className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-xs p-3 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Calculating answer from your financial metrics...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about affordability, expenses, or milestones (e.g. 'Can I afford ₹10,000?')..."
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
                disabled={sendingChat}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sendingChat}
                className="inline-flex items-center justify-center h-9 w-9 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Disclaimer Footer */}
      <div className="pt-4 border-t border-slate-200 text-center">
        <p className="text-[11px] text-slate-600 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Budgeting tool only. Not financial or investment advice.
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          All observations and responses are strictly mathematical budgeting calculations grounded in your recorded income and expenses.
        </p>
      </div>
    </div>
  );
}

export default function AiCoachPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading AI Financial Coach...</p>
        </div>
      }
    >
      <AiCoachContent />
    </Suspense>
  );
}
