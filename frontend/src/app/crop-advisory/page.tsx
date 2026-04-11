"use client";

import Link from "next/link";
import { ArrowLeft, Camera, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";

const treatmentSteps = [
  "Remove affected leaves and dispose of them safely.",
  "Apply a protective fungicide spray every 7 days.",
  "Increase sunlight and air circulation around the crop.",
];

export default function CropAdvisoryPage() {
  const [notes, setNotes] = useState("");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Crop Advisory</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Diagnose crop issues quickly.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Upload an image, describe the symptom, and get a clear advisory card with the likely disease and treatment steps.
              </p>
            </div>
            <Link
              href="/crop-help"
              className="inline-flex items-center gap-2 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900 transition hover:bg-lime-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Upload image</p>
              <label className="grid gap-3 rounded-[1.75rem] border border-dashed border-lime-200 bg-lime-50/80 p-5 text-center transition hover:border-lime-300 hover:bg-lime-100">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-lime-100 text-lime-700">
                  <Camera className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">Upload image</p>
                  <p className="mt-2 text-sm text-slate-600">Select a clear photo of the affected crop area.</p>
                </div>
                <button
                  type="button"
                  className="mx-auto mt-3 inline-flex h-12 items-center justify-center rounded-2xl bg-lime-700 px-5 text-sm font-semibold text-white transition hover:bg-lime-800"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose file
                </button>
                <input type="file" accept="image/*" className="hidden" />
              </label>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Describe the symptoms</p>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Enter what you see: yellow leaves, brown spots, wilting, etc."
                className="min-h-[180px] w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              />
            </div>
          </div>

          <aside className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Result</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Likely diagnosis</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                87% confidence
              </span>
            </div>

            <div className="mt-6 space-y-5 rounded-[1.75rem] bg-lime-50 p-5 text-slate-800 shadow-sm">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Disease name</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">Leaf Blight</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Recommended treatment</p>
                <ol className="space-y-3 text-sm text-slate-700">
                  {treatmentSteps.map((step, index) => (
                    <li key={index} className="rounded-2xl bg-white p-4 shadow-sm">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-lime-700 text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="ml-3">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
