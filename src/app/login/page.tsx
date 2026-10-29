import type { Metadata } from "next";
import { ColorBar } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인 · GDG DevFest 2026",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/onfestival", error } = await searchParams;
  return (
    <main className="min-h-svh bg-page p-4 text-fg sm:p-8 lg:p-[45px]">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_24rem] lg:items-end lg:gap-[45px]">
        <ColorBar variant="wide" className="h-32 sm:h-48 lg:h-80" />
        <div>
          <p className="text-sm font-bold text-fg/60">GDG DevFest 2026</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">로그인</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg/60">
            참가자는 운영진에게 받은 코드로, 운영진은 등록된 Google 계정으로 로그인합니다.
          </p>
          <LoginForm next={next} staff={next.startsWith("/organize")} staffError={error === "staff"} />
        </div>
      </div>
    </main>
  );
}
