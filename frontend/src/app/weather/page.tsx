"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    ArrowLeft,
    CloudRain,
    Droplets,
    Loader2,
    MapPin,
    ThermometerSun,
} from "lucide-react";
import { LocationModal } from "../../components/LocationModal";
import { useLocation } from "../../context/LocationContext";
import { useUser } from "@/context/UserContext";

type WeatherResponse = {
    temperature: number;
    rainfall: number;
    advice: string;
};

const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
).replace(/\/$/, "");

export default function WeatherPage() {
    const { latitude, longitude, placeName, isDetecting } = useLocation();
        const router = useRouter();
        const { user, profile } = useUser();
    
        // Protect route
        useEffect(() => {
            if (!user || !profile) {
                router.push(user ? '/onboarding' : '/login');
            }
        }, [user, profile, router]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [weather, setWeather] = useState<WeatherResponse | null>(null);
    const [locationModalOpen, setLocationModalOpen] = useState(false);

    useEffect(() => {
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
        }

        const controller = new AbortController();

        const fetchWeather = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await fetch(
                    `${API_BASE_URL}/weather?latitude=${latitude}&longitude=${longitude}`,
                    { signal: controller.signal },
                );
                const data = (await response.json().catch(() => ({}))) as
                    | WeatherResponse
                    | { error?: string };

                if (!response.ok) {
                    throw new Error((data as { error?: string }).error ?? "Unable to fetch weather advisory.");
                }

                setWeather(data as WeatherResponse);
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
                    return;
                }

                setError(
                    fetchError instanceof Error
                        ? fetchError.message
                        : "Unable to fetch weather advisory at the moment.",
                );
            } finally {
                setLoading(false);
            }
        };

        void fetchWeather();

        return () => {
            controller.abort();
        };
    }, [latitude, longitude]);

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f6ff_0%,_#f6fbff_36%,_#edf5fb_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <section className="rounded-[2rem] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(20,74,116,0.08)] sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-sm font-semibold text-sky-800">
                            <CloudRain className="h-5 w-5" />
                            Live Weather Advisory
                        </div>
                        <Link
                            href="/home"
                            className="inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 ring-1 ring-sky-100 transition hover:bg-sky-100"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to dashboard
                        </Link>
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
                        Monitor weather trends for smarter irrigation.
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                        Weather updates are tied to your selected farm location and refresh automatically.
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
                            <MapPin className="h-4 w-4" />
                            {isDetecting ? "Detecting location..." : placeName}
                        </span>
                        <button
                            type="button"
                            onClick={() => setLocationModalOpen(true)}
                            className="rounded-full border border-sky-200 bg-white px-3 py-1 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                        >
                            Change Location
                        </button>
                    </div>
                </section>

                {error ? (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </p>
                ) : null}

                <section className="rounded-[2rem] border border-sky-100 bg-white/95 p-6 shadow-[0_16px_40px_rgba(20,74,116,0.08)] sm:p-8">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold text-slate-900">Weather Card</h2>
                        {(loading || isDetecting) && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Updating
                            </span>
                        )}
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                                <ThermometerSun className="h-4 w-4" />
                                Temperature
                            </div>
                            <p className="mt-3 text-3xl font-semibold text-slate-900">
                                {weather ? `${weather.temperature}°C` : "--"}
                            </p>
                        </article>

                        <article className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                                <Droplets className="h-4 w-4" />
                                Rainfall
                            </div>
                            <p className="mt-3 text-3xl font-semibold text-slate-900">
                                {weather ? `${weather.rainfall} mm` : "--"}
                            </p>
                        </article>
                    </div>

                    <article className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800">
                            Farming advice
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">
                            {weather
                                ? weather.advice
                                : "Weather advice will appear automatically for your selected farm location."}
                        </p>
                    </article>
                </section>

                <LocationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
            </div>
        </main>
    );
}
