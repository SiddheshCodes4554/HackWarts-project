"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Microphone, SendHorizonal, Sparkles } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask me about crops, weather timing, irrigation, or market planning.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = input.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: trimmedMessage }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data = (await response.json().catch(() => ({}))) as { reply?: string };

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.reply ?? "I couldn't generate a live response just now. Please try again.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "The backend is unreachable right now. Please check the server and retry.",
        },
      ]);
    } finally {
      setLoading(false);
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
                  </div>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="sticky bottom-0 z-10 border-t border-lime-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
            >
              <Microphone className="h-5 w-5" />
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
