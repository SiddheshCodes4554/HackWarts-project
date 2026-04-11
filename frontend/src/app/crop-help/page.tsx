"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Camera, CheckCircle2, Leaf, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CropHelpPage() {
    const [selectedFile, setSelectedFile] = useState<string>("");
    const [cropNote, setCropNote] = useState("");

    const resultSteps = useMemo(
        () => [
            "Remove the most affected leaves and isolate the plant.",
            "Spray a copper-based fungicide in the early morning.",
            "Improve airflow and avoid excess overhead watering.",
        ],
        [],
    );

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFile(file ? file.name : "");
    };

    return (
        <main className="flex min-h-screen flex-col gap-5 bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
            <section className="rounded-[2rem] border border-lime-200/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(48,83,23,0.08)] backdrop-blur-sm sm:p-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-lime-700">
                        <Leaf className="h-4 w-4" />
                        Crop Advisory
                    </div>
                    <Link
                        href="/home"
                        className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-900 ring-1 ring-lime-100 transition hover:bg-lime-100"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Home
                    </Link>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                    Diagnose crop issues in a few taps.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    Upload a crop image and describe what you see. This screen is UI-only for now, designed for
                    quick field use on mobile devices.
                </p>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <article className="rounded-[2rem] border border-lime-100 bg-white/95 p-5 shadow-[0_18px_50px_rgba(48,83,23,0.08)] sm:p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Add crop details</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Use the biggest buttons on the screen so it stays easy to use in the field.
                    </p>

                    <label className="mt-5 flex cursor-pointer items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-lime-200 bg-lime-50 px-5 py-6 text-center transition hover:border-lime-300 hover:bg-lime-100/70 sm:px-6 sm:py-8">
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        <div className="flex flex-col items-center gap-2">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime-700 text-white shadow-lg shadow-lime-700/20">
                                <Camera className="h-6 w-6" />
                            </span>
                            <span className="text-base font-semibold text-slate-900">Upload crop image</span>
                            <span className="text-sm text-slate-600">Tap to choose a photo from your device</span>
                            {selectedFile && (
                                <span className="mt-1 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-lime-800 shadow-sm ring-1 ring-lime-100">
                                    {selectedFile}
                                </span>
                            )}
                        </div>
                    </label>

                    <div className="mt-5">
                        <label htmlFor="crop-note" className="mb-2 block text-sm font-semibold text-slate-800">
                            Describe symptoms
                        </label>
                        <textarea
                            id="crop-note"
                            value={cropNote}
                            onChange={(event) => setCropNote(event.target.value)}
                            placeholder="Example: yellow spots on leaves, curling edges, or early wilt"
                            rows={4}
                            className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
                        />
                    </div>

                    <button
                        type="button"
                        className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-lime-700 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-lime-700/20 transition hover:bg-lime-800 active:scale-[0.99]"
                    >
                        <Upload className="h-5 w-5" />
                        Analyze crop
                    </button>
                </article>

                <article className="rounded-[2rem] border border-lime-100 bg-white/95 p-5 shadow-[0_18px_50px_rgba(48,83,23,0.08)] sm:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-lime-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Result Card
                    </div>
                    <div className="mt-4 rounded-[1.75rem] bg-lime-50 p-5 shadow-sm ring-1 ring-lime-100">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-700">
                            Disease name
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-900">Leaf Blight</h3>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Confidence</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900">92%</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
                                <p className="mt-2 text-lg font-semibold text-emerald-600">High match</p>
                            </div>
                        </div>

                        <div className="mt-5">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                                3 steps treatment
                            </p>
                            <div className="mt-3 space-y-3">
                                {resultSteps.map((step, index) => (
                                    <div
                                        key={step}
                                        className="flex items-start gap-3 rounded-2xl border border-lime-100 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                                    >
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-700 text-xs font-semibold text-white">
                                            {index + 1}
                                        </span>
                                        <span>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 rounded-[1.5rem] border border-dashed border-lime-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                        This result card is ready for future AI prediction data, disease classification, and treatment
                        recommendations.
                    </div>
                </article>
            </section>
        </main>
    );
}
