import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";

export default function FinancePage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef9e3_0%,_#f8fcf5_40%,_#f1f6ec_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                <section className="rounded-[2rem] border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] sm:p-8">
                    <div className="flex items-center gap-3 text-sm font-semibold text-lime-800">
                        <DollarSign className="h-5 w-5" />
                        Finance
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold text-slate-900">Strengthen farm finances with confidence.</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        Manage credit, subsidy options, and cash-flow planning so you can invest in the right crop season.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
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
