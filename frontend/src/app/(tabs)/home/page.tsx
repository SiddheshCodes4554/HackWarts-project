"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CloudRain,
  DollarSign,
  Leaf,
  Loader2,
  MapPin,
} from "lucide-react";
import { LocationModal } from "../../../components/LocationModal";
import { useLocation } from "../../../context/LocationContext";
import { useUser } from "@/context/UserContext";

type WeatherResponse = {
  temperature: number;
  rainfall: number;
  advice: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

const features = [
  {
    title: "Crop Help",
    description: "Tailored guidance for your field and crop cycle.",
    href: "/crop-advisory",
    icon: Leaf,
  },
  {
    title: "Market Prices",
    description: "Check latest mandi rates across Nagpur.",
    href: "/market",
    icon: BarChart3,
  },
  {
    title: "Finance",
    description: "Plan loans, subsidies, and cash flow with confidence.",
    href: "/finance",
    icon: DollarSign,
  },
  {
    title: "Weather",
    description: "Get hourly weather alerts for irrigation planning.",
    href: "/weather",
    icon: CloudRain,
  },
];

export default function HomePage() {
  const { latitude, longitude, placeName, isDetecting } = useLocation();
  const { profile } = useUser();
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  // Use user's stored location if available
  const effectiveLatitude = profile?.latitude && profile.latitude !== 0 ? profile.latitude : latitude;
  const effectiveLongitude = profile?.longitude && profile.longitude !== 0 ? profile.longitude : longitude;
  const effectivePlaceName = profile?.location_name || placeName;

  useEffect(() => {
    if (!Number.isFinite(effectiveLatitude) || !Number.isFinite(effectiveLongitude)) {
      return;
    }

    const controller = new AbortController();

    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/weather?latitude=${effectiveLatitude}&longitude=${effectiveLongitude}`,
          { signal: controller.signal },
        );
        const data = (await response.json().catch(() => ({}))) as
          | WeatherResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error((data as { error?: string }).error ?? "Unable to fetch weather");
        }

        setWeather(data as WeatherResponse);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setWeatherError("Unable to load live weather right now.");
      } finally {
        setWeatherLoading(false);
      }
    };

    void fetchWeather();

    return () => {
      controller.abort();
    };
  }, [effectiveLatitude, effectiveLongitude]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
        <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-700">
                Namaste 👋
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Welcome back, {profile?.name || "farmer"}!
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Your personalized dashboard for {profile?.primary_crop || "your crop"} farming — weather, market pricing, crop support, and finance insights.
              </p>
              {profile && (
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-semibold uppercase text-lime-700">Your Crop</span>
                    <p className="font-semibold text-slate-900">{profile.primary_crop || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-lime-700">Land Area</span>
                    <p className="font-semibold text-slate-900">{profile.land_area} acres</p>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-[1.75rem] bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100">
              <span className="block text-xs uppercase tracking-[0.24em] text-lime-600">Your Location</span>
              <span className="mt-1 inline-flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                {isDetecting ? "Detecting..." : effectivePlaceName}
              </span>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="mt-3 inline-flex rounded-full border border-lime-200 bg-white px-3 py-1 text-xs font-semibold text-lime-800 transition hover:bg-lime-100"
              >
                Change Location
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-sky-100 bg-white/95 p-6 shadow-[0_16px_40px_rgba(20,74,116,0.08)] sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-900">
              <CloudRain className="h-5 w-5 text-sky-700" />
              Weather Card
            </h2>
            {(weatherLoading || isDetecting) && (
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating
              </span>
            )}
          </div>

          {weatherError ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {weatherError}
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-700">
                    Temperature
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {weather ? `${weather.temperature}°C` : "--"}
                  </p>
                </article>
                <article className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-700">
                    Rainfall
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {weather ? `${weather.rainfall} mm` : "--"}
                  </p>
                </article>
              </div>

              <article className="mt-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-700">
                  Advice
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">
                  {weather
                    ? weather.advice
                    : "Weather advice will appear automatically based on your selected location."}
                </p>
              </article>
            </>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <article className="rounded-[2rem] border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(40,72,18,0.08)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-3xl bg-lime-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-lime-700">
                Today&apos;s Recommendation
              </span>
              <span className="inline-flex items-center rounded-3xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                🌧️ Weather alert
              </span>
            </div>
            <h2 className="mt-6 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Rain expected — delay irrigation and monitor soil moisture.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Fresh data from local mandi weather stations recommends holding off on irrigation
              today to protect the young crop and improve nutrient uptake.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-lime-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-lime-900/15">
              <ArrowRight className="h-4 w-4" />
              Review weather details
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group flex flex-col justify-between rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-[0_18px_50px_rgba(48,83,23,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(48,83,23,0.14)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-lime-50 text-lime-800 transition group-hover:bg-lime-100">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-5">
                    <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lime-700">
                    Open <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-[0_16px_40px_rgba(48,83,23,0.07)] sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Quick Insights</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Fast farm signals for today</h2>
            </div>
            <span className="rounded-full bg-lime-50 px-3 py-2 text-sm font-semibold text-lime-800 ring-1 ring-lime-100">
              Updated now
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-[1.75rem] bg-lime-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-700">
                Top mandi price today
              </p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">₹24,200 / quintal</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Tomato rate in Nagpur mandi</p>
            </article>
            <article className="rounded-[1.75rem] bg-slate-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Best crop suggestion
              </p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">Soybean</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Recommended for the current monsoon window.</p>
            </article>
          </div>
        </section>

        <LocationModal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
      </div>
    </main>
  );
}
