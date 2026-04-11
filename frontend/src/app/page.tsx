"use client";

import { FormEvent, useMemo, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to FarmEase. Ask anything about crops, irrigation, weather planning, or farm operations.",
    },
  ]);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = input.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    setMessages((previousMessages) => [
      ...previousMessages,
      { role: "user", content: trimmedMessage },
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as { reply?: string };
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content:
            data.reply ?? "FarmEase is online but no reply was generated. Please try again.",
        },
      ]);
    } catch {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content:
            "Unable to reach the FarmEase backend. Please confirm the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f4df_0%,#f7fbf2_38%,#eef4e5_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-3xl border border-lime-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(42,78,18,0.08)] backdrop-blur sm:p-8">
          <p className="inline-flex items-center rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-lime-800">
            Agentic AI for Farmers
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            FarmEase 🌾 - Your AI Farming Assistant
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
            Make better farm decisions with an assistant built for daily agricultural workflows. This
            starter includes a responsive chat experience and backend API foundation for the upcoming
            multi-agent intelligence layer.
          </p>
        </section>

        <section className="rounded-3xl border border-lime-200/80 bg-white p-4 shadow-[0_15px_50px_rgba(35,64,18,0.12)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Chat Console</h2>
            <span className="text-xs font-medium text-slate-500">Backend: {API_BASE_URL}</span>
          </div>

          <div className="mb-4 h-[420px] overflow-y-auto rounded-2xl border border-lime-100 bg-lime-50/45 p-3 sm:p-4">
            {hasMessages ? (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "user"
                        ? "ml-auto bg-lime-700 text-white"
                        : "mr-auto border border-lime-200 bg-white text-slate-800"
                    }`}
                  >
                    {message.content}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Start a conversation with FarmEase.</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about crop health, irrigation, weather timing..."
              className="h-12 flex-1 rounded-xl border border-lime-200 bg-white px-4 text-sm outline-none ring-lime-300 transition focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl bg-lime-700 px-5 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-lime-400"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
