import Link from "next/link";
import { ColorBar, GdgLogo, schools } from "@/components/brand";
import { GuideTabs } from "@/components/guide-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { event } from "@/data/guide";

const summary = [
  { label: "일시", value: event.date },
  { label: "운영 시간", value: event.hours },
  { label: "체크인", value: event.checkIn },
  { label: "장소", value: event.venue },
];

export default function Home() {
  return (
    <main className="min-h-svh overflow-x-clip bg-page text-fg">
      {/* Hero, laid out like the design guide's cover: the color bar keeps the same margin on
          three sides (top, left, bottom; top, left, right on phones) and the text sits beside it. */}
      <section aria-labelledby="hero-title" className="p-4 sm:p-8 lg:p-[45px]">
        <div className="flex flex-col gap-4 sm:gap-8 lg:flex-row lg:gap-[45px]">
          <ColorBar variant="wide" className="h-28 sm:h-40 lg:hidden" />
          <ColorBar className="hidden aspect-square w-[min(42vw,34rem)] shrink-0 lg:flex" />

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-8">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-bold sm:text-base">
                <GdgLogo className="h-3 w-6" />
                {event.series}
              </p>
              <div className="flex items-center gap-3">
                <ThemeToggle className="h-11 w-11" />
                <Link
                  href="/onfestival"
                  className="group inline-flex h-11 items-center gap-2 bg-fg px-5 font-bold text-page transition hover:opacity-85"
                >
                  입장하기
                  <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </div>
            </div>

            <div>
              <h1
                id="hero-title"
                className="text-[clamp(2.75rem,7vw,6.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-fg"
              >
                {event.theme}
              </h1>
              <p className="mt-3 text-base font-bold text-fg/70 sm:text-lg">{event.title}</p>

              {/* At-a-glance info */}
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-fg/15 pt-5 xl:grid-cols-4">
                {summary.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs text-fg/55">{s.label}</dt>
                    <dd className="mt-1 text-sm font-bold sm:text-base">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Guide tabs */}
      <section aria-label="행사 안내">
        <GuideTabs />
      </section>

      <footer className="mt-8 border-t border-fg/10 bg-page">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-fg/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <GdgLogo className="h-3 w-6 text-fg/70" />
            {event.series} · {event.theme}
          </span>
          <span className="flex items-center gap-2">
            <span className="flex h-3 w-12" aria-hidden="true">
              {schools.map((s) => (
                <span key={s.key} className="flex-1" style={{ background: s.main }} />
              ))}
            </span>
            고려대 · 연세대 · 성균관대 · KAIST · GDG on Campus 연합 DevFest 참가자 안내 페이지
          </span>
        </div>
      </footer>
    </main>
  );
}
