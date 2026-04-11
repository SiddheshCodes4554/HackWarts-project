"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, BadgeIndianRupee, CheckCircle2, Loader2, Sprout } from "lucide-react";
import { useLocation } from "../../context/LocationContext";
import { useUser, type UserProfile } from "@/context/UserContext";

type GovernmentScheme = {
  name: string;
  benefit: string;
  eligibility: string[];
  documents: string[];
  apply_steps: string[];
};

type FinancialAdviceResponse = {
  schemes: GovernmentScheme[];
  advice: string;
  steps: string[];
  language: "English" | "Hindi";
  fetched_at: string;
  data_source: string;
  api_live: boolean;
  profile: {
    landOwned: boolean;
    cropType: string;
    location: string;
    incomeLevel: string;
  };
};

type FinancialFormState = {
  landOwned: boolean;
  cropType: string;
  location: string;
  incomeLevel: string;
  landArea?: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

function deriveIncomeLevel(landArea: number): string {
  if (landArea <= 2) {
    return "low";
  }

  if (landArea <= 5) {
    return "medium";
  }

  return "high";
}

function buildFormState(profile: UserProfile | null, placeName: string): FinancialFormState {
  if (!profile) {
    return {
      landOwned: false,
      cropType: "",
      location: placeName,
      incomeLevel: "medium",
      landArea: undefined,
    };
  }

  return {
    landOwned: profile.land_area > 0,
    cropType: profile.primary_crop || "",
    location: profile.location_name || placeName,
    incomeLevel: deriveIncomeLevel(profile.land_area),
    landArea: profile.land_area,
  };
}

export default function FinancePage() {
  const { placeName } = useLocation();
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user || !profile) {
      router.push(user ? "/onboarding" : "/login");
    }
  }, [user, profile, userLoading, router]);

  const [landOwned, setLandOwned] = useState(true);
  const [cropType, setCropType] = useState("");
  const [incomeLevel, setIncomeLevel] = useState("medium");
  const [language, setLanguage] = useState<"English" | "Hindi">("English");
  const [advice, setAdvice] = useState<FinancialAdviceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAutoFetched, setHasAutoFetched] = useState(false);

  const fetchAdvice = async (profileOverride?: FinancialFormState) => {
    const payloadProfile = profileOverride ?? {
      landOwned,
      cropType,
      location: placeName,
      incomeLevel,
    };

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/financial-advice?_ts=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({
          ...payloadProfile,
          landArea: profileOverride?.landArea,
          language,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as FinancialAdviceResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to fetch financial advice");
      }

      setAdvice(data as FinancialAdviceResponse);
    } catch {
      setError("Unable to load financial advice right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) {
      return;
    }

    const formState = buildFormState(profile, placeName);
    setLandOwned(formState.landOwned);
    setCropType(formState.cropType);
    setIncomeLevel(formState.incomeLevel);

    if (!hasAutoFetched) {
      setHasAutoFetched(true);
      void fetchAdvice(formState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, placeName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchAdvice({
      landOwned,
      cropType,
      location: placeName,
      incomeLevel,
    });
  };

  const topSchemes = advice?.schemes.slice(0, 3) ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef9e3_0%,#f8fcf5_40%,#f1f6ec_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm font-semibold text-lime-800">
                <BadgeIndianRupee className="h-5 w-5" />
                Financial Services
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Simple scheme advice for your farm.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Choose a few details below to see real government schemes, why they matter, and how to apply step by step.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100">
              <span className="block text-xs uppercase tracking-[0.24em] text-lime-600">Location</span>
              <span className="mt-1 inline-flex items-center gap-2 text-lg">
                <Sprout className="h-4 w-4" />
                {placeName}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Personalize the advice</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use these answers to filter the schemes that fit your farm better.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Land ownership
                <select
                  value={landOwned ? "yes" : "no"}
                  onChange={(event) => setLandOwned(event.target.value === "yes")}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                >
                  <option value="yes">Yes, I own land</option>
                  <option value="no">No, I lease or work on shared land</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Crop type
                <input
                  value={cropType}
                  onChange={(event) => setCropType(event.target.value)}
                  placeholder="Example: wheat, tomato, soybean"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Income level
                <select
                  value={incomeLevel}
                  onChange={(event) => setIncomeLevel(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Language
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as "English" | "Hindi")}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime-700 px-4 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-lime-400"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Refresh advice
            </button>

            {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          </form>

          <div className="space-y-5">
            <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Top schemes</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Best matches for your profile</h2>
                </div>
                <span className="rounded-full bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-800">
                  {advice ? `${advice.schemes.length} eligible` : "Loading"}
                </span>
              </div>
              {advice ? (
                <p className="mt-2 text-xs text-slate-500">
                  Source: {advice.data_source} | Updated: {new Date(advice.fetched_at).toLocaleString()} | Live API: {advice.api_live ? "Yes" : "No"}
                </p>
              ) : null}

              <div className="mt-5 space-y-4">
                {topSchemes.map((scheme) => (
                  <article key={scheme.name} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {scheme.name}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-amber-700">{scheme.benefit}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                        Apply now
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Why it fits</p>
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                          {scheme.eligibility.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documents needed</p>
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                          {scheme.documents.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Apply now steps
                      </p>
                      <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {scheme.apply_steps.map((step, index) => (
                          <li key={step}>
                            {index + 1}. {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </article>
                ))}

                {!loading && topSchemes.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-lime-200 bg-lime-50/60 p-5 text-sm text-slate-600">
                    No schemes matched this profile yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[2rem] border border-sky-100 bg-white/95 p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-sky-600" />
                Farmer-friendly guidance
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                {advice?.advice ?? "Refresh the advice to see the best schemes for your current profile."}
              </p>
              {advice?.steps?.length ? (
                <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next steps</p>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {advice.steps.map((step, index) => (
                      <li key={step}>
                        {index + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Quick note</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Always verify on the official scheme website or nearest office.</h2>
            </div>
            <Link
              href="/home"
              className="inline-flex items-center gap-2 rounded-2xl bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100 transition hover:bg-lime-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
