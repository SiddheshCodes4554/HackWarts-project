import { BottomNav } from "../../components/bottom-nav";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ecf8df_0%,#f8fbf4_42%,#eef5e4_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
