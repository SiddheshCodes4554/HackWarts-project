"use client";

import { useState } from "react";
import { BadgeInfo, Bell, CircleUserRound, Settings2 } from "lucide-react";

const settings = ["Weather alerts", "Market reminders", "Irrigation schedule"];

export default function ProfilePage() {
  const [name, setName] = useState("Ravi Patil");
  const [location, setLocation] = useState("Maharashtra, India");
  const [language, setLanguage] = useState("English");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="rounded-[2rem] border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] sm:p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-3xl bg-lime-700 p-4 text-white shadow-lg shadow-lime-700/20">
              <CircleUserRound className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Farmer Profile</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">Your Profile</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage your personal details and app preferences for a tailored farming experience.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
                placeholder="Enter your location"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Settings2 className="h-5 w-5 text-lime-700" />
            Settings
          </div>
          <div className="mt-6 space-y-4">
            {settings.map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <span>{item}</span>
                <BadgeInfo className="h-4 w-4 text-lime-700" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-lime-100 bg-lime-50/80 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Bell className="h-5 w-5 text-lime-700" />
            Notification Summary
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Your account is set up for timely agronomy updates, market changes, and assistant reminders.
          </p>
        </section>
      </div>
    </main>
  );
}

