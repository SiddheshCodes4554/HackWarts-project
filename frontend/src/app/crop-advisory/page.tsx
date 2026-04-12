"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useLocation } from "../../context/LocationContext";
import { useUser } from "@/context/UserContext";

type CropAdvisoryResponse = {
  disease?: string;
  confidence?: number;
  symptoms?: string;
  treatment?: string[];
  prevention?: string[];
  source?: "image" | "text";
  context?: {
    season?: string;
    soil_type?: string;
    weather_summary?: string;
  };
  error?: string;
};

type SelectedImage = {
  previewUrl: string;
  dataUrl: string;
  name: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");
const ANALYZE_TIMEOUT_MS = 30000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;

function toText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "-";
  }

  return String(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => toText(entry)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|\r|;|\d+\)/)
      .map((entry) => entry.replace(/^[-*\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function confidenceTone(confidence?: number): string {
  if (typeof confidence !== "number") {
    return "bg-slate-100 text-slate-700";
  }

  if (confidence >= 80) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (confidence >= 60) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Unable to read image"));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode image"));
    image.src = dataUrl;
  });
}

async function optimizeImageForUpload(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);

  if (file.size <= MAX_UPLOAD_BYTES) {
    return rawDataUrl;
  }

  const image = await loadImage(rawDataUrl);
  const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * ratio));
  const targetHeight = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return rawDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const compressed = canvas.toDataURL("image/jpeg", 0.78);
  return compressed || rawDataUrl;
}

export default function CropAdvisoryPage() {
  const { latitude, longitude, placeName } = useLocation();
  const router = useRouter();
  const { user, profile, loading: userLoading, profileStatus } = useUser();

  const effectiveLatitude = profile?.latitude && profile.latitude !== 0 ? profile.latitude : latitude;
  const effectiveLongitude = profile?.longitude && profile.longitude !== 0 ? profile.longitude : longitude;
  const effectivePlaceName = profile?.location_name || placeName;
  
  // Protect route
  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    if (profileStatus === 'missing') {
      router.replace('/onboarding');
    }
  }, [profileStatus, router, user, userLoading]);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [manualNote, setManualNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CropAdvisoryResponse | null>(null);

  const treatment = useMemo(() => toList(result?.treatment), [result]);
  const prevention = useMemo(() => toList(result?.prevention), [result]);

  const canSubmit = Boolean(selectedImage || manualNote.trim()) && !loading;

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await optimizeImageForUpload(file);
      setSelectedImage({
        previewUrl: dataUrl,
        dataUrl,
        name: file.name,
      });
      setError("");
    } catch {
      setError("Unable to process this image. Try another photo with better lighting.");
    }

    event.target.value = "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: selectedImage?.dataUrl,
          query: manualNote.trim() || undefined,
          location: {
            latitude: effectiveLatitude,
            longitude: effectiveLongitude,
            placeName: effectivePlaceName,
          },
        }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as CropAdvisoryResponse & { error?: string };

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Image is too large. Please upload a smaller or compressed image.");
        }

        if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment and retry.");
        }

        throw new Error(data.error ?? "Could not detect clearly, try again");
      }

      setResult(data);
      setError("");
    } catch (submissionError) {
      const message =
        submissionError instanceof DOMException && submissionError.name === "AbortError"
          ? "Request timed out. Try a clearer image or add a short symptom note."
          : submissionError instanceof Error
            ? submissionError.message
            : "Could not detect clearly, try again";
      setError(message);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <main className="text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
        <section className="rounded-4xl border border-lime-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-700">Crop Advisory</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Scan a crop leaf or describe the symptoms.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                The system uses your image first, then combines weather, soil, and location data to return farmer-friendly disease advice.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 shadow-sm ring-1 ring-lime-100">
              <span className="block text-xs uppercase tracking-[0.24em] text-lime-600">Location</span>
              <span className="mt-1 inline-flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                {effectivePlaceName}
              </span>
              <Link
                href="/home"
                className="mt-3 inline-flex rounded-full border border-lime-200 bg-white px-3 py-1 text-xs font-semibold text-lime-800 transition hover:bg-lime-100"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back home
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8"
          >
            <div className="rounded-[1.75rem] border border-dashed border-lime-200 bg-lime-50/70 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lime-700 shadow-sm">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-700">Image scan</p>
                  <p className="mt-1 text-sm text-slate-600">Upload a photo or use your phone camera.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-lime-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-lime-800"
                >
                  <Upload className="h-4 w-4" />
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-semibold text-lime-900 transition hover:bg-lime-100"
                >
                  <Camera className="h-4 w-4" />
                  Camera capture
                </button>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageSelect}
              />

              {selectedImage ? (
                <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-sm">
                  <Image
                    src={selectedImage.previewUrl}
                    alt="Selected crop preview"
                    width={1200}
                    height={600}
                    className="h-64 w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700">
                    <span className="truncate font-medium">{selectedImage.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex min-h-[16rem] items-center justify-center rounded-[1.5rem] border border-dashed border-lime-200 bg-white/80 px-6 py-8 text-center text-sm text-slate-500">
                  Preview selected image will appear here.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">or describe manually</p>
              <textarea
                value={manualNote}
                onChange={(event) => setManualNote(event.target.value)}
                placeholder="Describe the symptoms if you cannot upload a photo. Example: yellow spots on leaves, curled edges, wilting."
                className="min-h-[160px] w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-14 w-full items-center justify-center rounded-[1.5rem] bg-lime-700 px-5 text-base font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-lime-400"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing crop...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Scan Crop
                </>
              )}
            </button>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </form>

          <aside className="space-y-4 rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Result</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Crop diagnosis</h2>
              </div>
              <span className={`rounded-full px-3 py-2 text-sm font-semibold ${confidenceTone(result?.confidence)}`}>
                {typeof result?.confidence === "number" ? `${result.confidence}% confidence` : "Waiting"}
              </span>
            </div>

            {result ? (
              <div className="space-y-4">
                {selectedImage ? (
                  <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                    <Image
                      src={selectedImage.previewUrl}
                      alt="Uploaded crop"
                      width={1200}
                      height={560}
                      className="h-56 w-full object-cover"
                    />
                  </article>
                ) : null}

                <article className="rounded-[1.75rem] border border-rose-100 bg-rose-50 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Disease name</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {result.disease || "Unknown condition"}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.75rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Symptoms</p>
                      <p className="mt-1 text-sm leading-7 text-slate-700">
                        {result.symptoms || "Could not detect clearly, try again."}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.75rem] border border-lime-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-50 text-lime-700 shadow-sm">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">Treatment</p>
                      <p className="mt-1 text-sm leading-7 text-slate-600">
                        Start with the cheapest step first.
                      </p>
                    </div>
                  </div>
                  <ol className="mt-4 space-y-3">
                    {treatment.length > 0 ? (
                      treatment.slice(0, 3).map((step, index) => (
                        <li key={`${step}-${index}`} className="rounded-2xl border border-lime-100 bg-lime-50/70 p-4">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-lime-700 text-sm font-semibold text-white">
                              {index + 1}
                            </span>
                            <p className="text-sm leading-6 text-slate-700">{step}</p>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="rounded-2xl border border-lime-100 bg-lime-50/70 p-4 text-sm text-slate-700">
                        No treatment steps returned yet.
                      </li>
                    )}
                  </ol>
                </article>

                <article className="rounded-[1.75rem] border border-sky-100 bg-sky-50 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Prevention</p>
                      <p className="mt-1 text-sm leading-7 text-slate-700">
                        Keep watching the crop after the first fix.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {prevention.length > 0 ? (
                      prevention.map((step) => (
                        <div
                          key={step}
                          className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
                        >
                          {step}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                        No prevention tips returned yet.
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Source", result.source ?? "text"],
                      ["Season", result.context?.season],
                      ["Soil type", result.context?.soil_type],
                      ["Weather summary", result.context?.weather_summary],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-800">{toText(value)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-lime-200 bg-lime-50/70 p-6 text-sm leading-7 text-slate-600">
                <p className="font-semibold text-slate-800">No advisory yet.</p>
                <p className="mt-2">
                  Upload a crop image or describe the symptoms manually to get an instant disease-aware plan.
                </p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
