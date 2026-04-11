"use client";

import { FormEvent, useState } from "react";
import { SendHorizonal, Sparkles } from "lucide-react";

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
    <main className="flex flex-1 flex-col gap-5 pb-6 pt-2">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">
          <Sparkles className="h-4 w-4" />
          FarmEase Assistant
        </div>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          Talk to your farm operations copilot.
        </h1>
      </section>

      <section className="flex flex-1 flex-col rounded-[1.75rem] border border-lime-100 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex-1 space-y-3 overflow-y-auto rounded-[1.5rem] bg-lime-50/50 p-3 sm:p-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[92%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto bg-lime-700 text-white"
                  : "mr-auto border border-lime-200 bg-white text-slate-800"
              }`}
            >
              {message.content}
            </div>
          ))}
          {loading && (
            <div className="mr-auto inline-flex items-center gap-2 rounded-3xl border border-lime-200 bg-white px-4 py-3 text-sm text-slate-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-lime-500" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-lime-500 [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-lime-500 [animation-delay:240ms]" />
              Thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask something like: suggest crops for rainy season"
            className="h-12 flex-1 rounded-2xl border border-lime-200 bg-white px-4 text-sm outline-none ring-lime-300 transition focus:ring-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-lime-700 px-4 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-lime-400"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
