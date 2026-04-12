"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CloudRain,
  DollarSign,
  Leaf,
  SendHorizonal,
  Sparkles,
  Trash2,
  History,
} from "lucide-react";
import { useLocation } from "../../../context/LocationContext";
import { useUser } from "@/context/UserContext";
import { useChatHistory } from "@/lib/useChatHistory";

type SectionData = Record<string, unknown>;

type StructuredCards = {
  weather: SectionData;
  crops: SectionData;
  market: SectionData;
  finance: SectionData;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  structured?: Partial<StructuredCards>;
};

type ChatApiResponse = {
  reply?: string;
  intent?: string;
  error?: string;
  final_message?: string;
  weather?: SectionData;
  crops?: SectionData;
  market?: SectionData;
  finance?: SectionData;
};

const CHAT_API_PATH = "/api/chat";
const CHAT_TIMEOUT_MS = 15000;

function toDisplayText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (value === null || value === undefined) {
    return "-";
  }

  return String(value);
}

function toReadableLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isSectionData(value: unknown): value is SectionData {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStructuredCards(data: ChatApiResponse): Partial<StructuredCards> {
  return {
    ...(isSectionData(data.weather) ? { weather: data.weather } : {}),
    ...(isSectionData(data.crops) ? { crops: data.crops } : {}),
    ...(isSectionData(data.market) ? { market: data.market } : {}),
    ...(isSectionData(data.finance) ? { finance: data.finance } : {}),
  };
}

function hasStructuredCards(structured?: Partial<StructuredCards>): boolean {
  if (!structured) {
    return false;
  }

  return Object.values(structured).some((section) =>
    isSectionData(section) && hasRenderableFields(section),
  );
}

function shouldUseStructuredCards(intent: string | undefined, structured?: Partial<StructuredCards>): boolean {
  if (intent !== "crop_advice" || !hasStructuredCards(structured)) {
    return false;
  }

  const cropSection = structured?.crops;
  if (!isSectionData(cropSection)) {
    return false;
  }

  const diseaseFields = ["disease", "symptoms", "root_cause", "treatment", "prevention", "warnings"];
  return diseaseFields.some((field) => {
    const value = cropSection[field];
    return value !== null && value !== undefined && value !== "";
  });
}

function hasRenderableFields(section: SectionData): boolean {
  return Object.entries(section).some(([, value]) => value !== null && value !== undefined && value !== "");
}

function renderSectionRows(section: SectionData): Array<[string, string]> {
  return Object.entries(section)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 5)
    .map(([key, value]) => [toReadableLabel(key), toDisplayText(value)]);
}

export default function AssistantPage() {
  const { latitude, longitude, placeName } = useLocation();
  const { user, profile, profileStatus, loading: userLoading } = useUser();
  const { history, addToHistory, clear } = useChatHistory();
  const router = useRouter();
  
  // Protect route - wait for auth/profile bootstrap to settle before redirecting.
  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profileStatus === "missing") {
      router.replace("/onboarding");
    }
  }, [profileStatus, router, user, userLoading]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask me about crops, weather timing, irrigation, or market planning.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  // Use user's stored location if available, fallback to auto-detected location
  const effectiveLatitude = profile?.latitude && profile.latitude !== 0 ? profile.latitude : latitude;
  const effectiveLongitude = profile?.longitude && profile.longitude !== 0 ? profile.longitude : longitude;
  const effectiveLocation = profile?.location_name || placeName;

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
      const response = await fetch(CHAT_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedMessage,
          userId: user?.id,
          location: {
            latitude: effectiveLatitude,
            longitude: effectiveLongitude,
            placeName: effectiveLocation,
          },
        }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as ChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Live AI unavailable right now. Please retry.");
      }

      setIntent(data.intent ?? "general_support");
      const structured = parseStructuredCards(data);
      const assistantResponse = data.reply ?? "I couldn't generate a live response just now. Please try again.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: assistantResponse,
          intent: data.intent,
          structured: shouldUseStructuredCards(data.intent, structured) ? structured : undefined,
        },
      ]);

      // Save to chat history
      if (user) {
        await addToHistory(trimmedMessage, assistantResponse, data.intent || "general");
      }
    } catch (error) {
      const errorMessage =
        error instanceof DOMException && error.name === "AbortError"
          ? "The request took too long. Please try again."
          : error instanceof Error
            ? error.message
            : "Live AI unavailable right now. Please retry.";

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

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
      await clear();
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(40,72,18,0.08)] sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">
              <Sparkles className="h-4 w-4" />
              FarmEase Assistant
            </div>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Talk to your farm operations copilot.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Fast, clean chat using your location {effectiveLocation} and profile — personalized for {profile?.primary_crop || "your crops"}.
            </p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-lime-50 hover:bg-lime-100 border border-lime-200 rounded-2xl transition-colors text-lime-700 font-semibold"
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </section>

      <div className="mt-6 flex gap-4 flex-1 min-h-0">
        {/* Chat Area */}
        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-lime-100 bg-white/95 shadow-sm">
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
                  {message.role === "assistant" && shouldUseStructuredCards(message.intent, message.structured) ? (
                    <div className="w-full max-w-[95%] space-y-3 rounded-[1.75rem] border border-lime-100 bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Sparkles className="h-4 w-4 text-lime-700" />
                        Structured advisory
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          {
                            label: "Weather",
                            key: "weather",
                            icon: CloudRain,
                            accent: "border-sky-100 bg-sky-50 text-sky-800",
                          },
                          {
                            label: "Crops",
                            key: "crops",
                            icon: Leaf,
                            accent: "border-lime-100 bg-lime-50 text-lime-800",
                          },
                          {
                            label: "Market",
                            key: "market",
                            icon: BarChart3,
                            accent: "border-violet-100 bg-violet-50 text-violet-800",
                          },
                          {
                            label: "Finance",
                            key: "finance",
                            icon: DollarSign,
                            accent: "border-amber-100 bg-amber-50 text-amber-800",
                          },
                        ].map((card) => {
                          const Icon = card.icon;
                          const payload = message.structured?.[card.key as keyof StructuredCards];

                          if (!payload || !hasRenderableFields(payload)) {
                            return null;
                          }

                          return (
                            <article
                              key={card.key}
                              className={`rounded-[1.5rem] border p-4 shadow-sm ${card.accent}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{card.label}</p>
                                  <p className="text-xs text-slate-500">Live advisory summary</p>
                                </div>
                              </div>

                              <div className="mt-4 space-y-2">
                                {renderSectionRows(payload).map(([entryLabel, value]) => (
                                  <div
                                    key={entryLabel}
                                    className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2"
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      {entryLabel}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-800">{value}</p>
                                  </div>
                                ))}
                              </div>
                            </article>
                          );
                        }).filter(Boolean)}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-[2rem] px-4 py-3 text-sm leading-6 shadow-sm ${
                        message.role === "user"
                          ? "bg-lime-700 text-white"
                          : "border border-lime-100 bg-white text-slate-800"
                      }`}
                    >
                      {message.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-lime-100 bg-white px-4 py-4 sm:px-6"
          >
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about crops, weather, markets, or finance..."
                disabled={loading}
                className="flex-1 rounded-[2rem] border border-lime-200 bg-lime-50 px-5 py-3 text-sm outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-200 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-2 rounded-[2rem] bg-lime-700 px-4 py-3 text-white font-semibold hover:bg-lime-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SendHorizonal className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </form>
        </section>

        {/* Chat History Sidebar */}
        {showHistory && (
          <section className="hidden sm:flex w-80 flex-col rounded-[2rem] border border-lime-100 bg-white/95 shadow-sm overflow-hidden">
            <div className="border-b border-lime-100 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
              📋 Chat History ({history.length})
            </div>

            <div className="flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No chat history yet. Start chatting!
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {history.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-lime-100 bg-lime-50 p-3 hover:bg-lime-100 transition-colors cursor-pointer group"
                      title={msg.query}
                    >
                      <p className="text-xs font-semibold text-lime-700 uppercase tracking-[0.1em] mb-1">
                        {msg.agent_type}
                      </p>
                      <p className="text-sm text-slate-700 line-clamp-2">{msg.query}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-lime-100 bg-white px-4 py-3">
              <button
                onClick={handleClearHistory}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Clear History
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
