"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Mic, SendHorizonal, Sparkles } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatApiResponse = {
  reply?: string;
  intent?: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
const CHAT_TIMEOUT_MS = 15000;

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask me about crops, weather timing, irrigation, or market planning.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = input.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: trimmedMessage }]);
    setInput("");
    setLoading(true);
    setIntent("");

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as ChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to process chat request");
      }

      setIntent(data.intent ?? "general_support");

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.reply ?? "I couldn't generate a live response just now. Please try again.",
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof DOMException && error.name === "AbortError"
          ? "The request took too long. Please try again."
          : "The backend is unreachable right now. Please check the server and retry.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      requestRef.current = null;
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">
          <Sparkles className="h-4 w-4" />
          FarmEase Assistant
        </div>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          Talk to your farm operations copilot.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Fast, clean chat for your farm decisions — now with modern bubbles and mobile-first layout.
        </p>
      </section>

      <section className="relative flex min-h-[0] flex-1 flex-col overflow-hidden rounded-[2rem] border border-lime-100 bg-white/95 shadow-sm">
        <div className="flex items-center justify-between border-b border-lime-100 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-6">
          <span>Live chat</span>
          <span className="rounded-full bg-lime-50 px-3 py-1 text-lime-800 ring-1 ring-lime-100">
            {loading ? "Connecting" : intent ? `Intent: ${intent}` : "Ready"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-[2rem] px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user"
                      ? "bg-lime-700 text-white"
                      : "border border-lime-100 bg-white text-slate-800"
                    }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-[2rem] border border-lime-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-lime-500" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-lime-500 [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-lime-500 [animation-delay:240ms]" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="sticky bottom-0 z-10 border-t border-lime-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Voice input coming soon"
              title="Voice input coming soon"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
            >
              <Mic className="h-5 w-5" />
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask something like: suggest crops for rainy season"
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-lime-700 px-4 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-lime-400"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
