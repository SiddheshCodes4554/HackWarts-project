"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, MessageCircle, UserCircle2 } from "lucide-react";

const tabs = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/assistant", label: "Assistant", icon: MessageCircle },
  { href: "/market", label: "Market", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-lime-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto grid max-w-5xl grid-cols-4 gap-2 px-3 py-3 sm:px-6">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition active:scale-[0.98] ${
                isActive
                  ? "bg-lime-700 text-white shadow-lg shadow-lime-700/20"
                  : "text-slate-500 hover:bg-lime-50 hover:text-lime-800"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
