import Link from "next/link";
import { GdgLogo, SchoolSteps, schools } from "@/components/brand";
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
      {/* Hero: headline and key facts first; the school colors rise as steps along the
          bottom edge as its base (like a conference site's brand band), not as a block of
          their own beside the text. */}
      <section aria-labelledby="hero-title" className="px-4 pt-4 sm:px-8 sm:pt-8 lg:px-[45px] lg:pt-[45px]">
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

        <div className="mt-14 sm:mt-20 lg:mt-24">
          <h1
            id="hero-title"
            className="text-[clamp(3rem,10vw,9.5rem)] font-bold leading-[0.9] tracking-[-0.045em] text-fg"
          >
            {event.theme}
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-bold text-muted sm:mt-6 sm:text-2xl">{event.title}</p>
        </div>

        {/* At-a-glance info, ruled like a program sheet */}
        <dl className="mt-10 grid grid-cols-2 border-y border-fg/20 sm:mt-14 lg:grid-cols-4">
          {summary.map((s, i) => (
            <div
              key={s.label}
              className={`py-4 pr-4 sm:py-5 ${i % 2 === 1 ? "border-l border-fg/20 pl-4" : ""} ${i >= 2 ? "border-t border-fg/20 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:pl-4" : ""}`}
            >
              <dt className="text-xs text-subtle sm:text-sm">{s.label}</dt>
              <dd className="mt-1 text-base font-bold sm:text-lg">{s.value}</dd>
            </div>
          ))}
        </dl>

        <SchoolSteps className="mt-10 h-24 sm:mt-14 sm:h-36 lg:h-48" />
      </section>

      {/* Guide tabs */}
      <section aria-label="행사 안내">
        <GuideTabs />
      </section>

      <footer className="mt-8 border-t border-fg/10 bg-page">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <GdgLogo className="h-3 w-6 text-muted" />
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
