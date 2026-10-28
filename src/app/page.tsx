import { GdgLogo, FoldStripes, GoogleBar, LetterStripes } from "@/components/brand";
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
      {/* Compact hero */}
      <section aria-labelledby="hero-title">
        <div id="hero-band" className="h-28 sm:h-36 lg:h-44">
          <LetterStripes />
        </div>
        <div className="flex">
          <div className="flex-1">
            <div className="bg-surface">
              <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-fg/70 sm:text-base">
                    <GdgLogo className="h-3 w-6" />
                    {event.series}
                  </p>
                  <h1
                    id="hero-title"
                    className="mt-2 text-[clamp(2.75rem,8vw,7rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-fg"
                  >
                    {event.theme}
                  </h1>
                </div>
                <div className="flex flex-col gap-4 lg:items-end">
                  <div className="flex items-center gap-3">
                    <ThemeToggle className="h-11 w-11" />
                  </div>
                </div>
              </div>
            </div>

            {/* At-a-glance info */}
            <div className="bg-contrast text-on-contrast">
              <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-8 lg:grid-cols-4">
                {summary.map((s) => (
                  <div key={s.label} className="py-4 pr-4 sm:py-5">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-on-contrast/55">{s.label}</dt>
                    <dd className="mt-1 text-sm font-semibold sm:text-base">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <GoogleBar className="w-1.5 sm:w-2.5" />
        </div>
      </section>

      {/* Guide tabs */}
      <section aria-label="행사 안내">
        <GuideTabs />
      </section>

      <FoldStripes className="mt-8 h-20 sm:h-28" />

      <footer className="bg-page">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-fg/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <GdgLogo className="h-3 w-6 text-fg/70" />
            {event.series} · {event.theme}
          </span>
          <span>고려대 · 연세대 · 성균관대 · KAIST · GDG on Campus 연합 DevFest 참가자 안내 페이지</span>
        </div>
      </footer>
    </main>
  );
}
