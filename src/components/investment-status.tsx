"use client";

// Published investment status on /onfestival: every published tick as a line chart,
// plus a ranking that doubles as the legend. Only published ticks are shown here —
// participants never see live totals.

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Team } from "@/data/guide";
import { clockLabel, timeLabel, won, type FestivalState, type Snapshot } from "@/lib/festival-store";
import { Label } from "./festival-ui";

// Compact Korean money: 2,150,000 -> 215만원
const man = (n: number) =>
  Math.abs(n) >= 10_000 ? `${(n / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원` : won(n);

const signed = (n: number) => (n > 0 ? `+${man(n)}` : n < 0 ? `−${man(-n)}` : "±0");

// Round up to a clean axis maximum (in 만원 steps of 1/2/5 × 10^k)
function niceMax(v: number) {
  if (v <= 0) return 100_000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

type Row = { team: Team; total: number; prev: number; rank: number; prevRank: number | null };

function ranking(teams: Team[], ticks: Snapshot[]): Row[] {
  const last = ticks[ticks.length - 1];
  const before = ticks[ticks.length - 2];
  const order = (t: Snapshot) =>
    [...teams].sort((a, b) => (t.totals[b.id] ?? 0) - (t.totals[a.id] ?? 0)).map((x) => x.id);
  const now = order(last);
  const then = before ? order(before) : null;
  return now.map((id, i) => {
    const team = teams.find((t) => t.id === id) as Team;
    return {
      team,
      total: last.totals[id] ?? 0,
      prev: before?.totals[id] ?? 0,
      rank: i + 1,
      prevRank: then ? then.indexOf(id) + 1 : null,
    };
  });
}

// `admin` renders the same view on /organize, so staff see exactly what participants see.
export function PublishedStatus({
  state,
  myTeamId,
  admin = false,
}: {
  state: FestivalState;
  myTeamId?: string;
  admin?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const ticks = state.ticks;
  const teams = state.teams;

  if (ticks.length === 0) {
    return (
      <section aria-labelledby="published" className="border-t border-fg/15 pt-8">
        <Label id="published">{admin ? "참가자 화면 투자 현황" : "투자 현황"}</Label>
        <p className="mt-3 text-fg/60">
          {admin
            ? "아직 발행한 틱이 없습니다. 틱을 발행하면 참가자 화면에 이 그래프가 표시됩니다."
            : "아직 발행된 투자 현황이 없습니다. 운영진이 발행하면 여기에 표시됩니다."}
        </p>
      </section>
    );
  }

  const rows = ranking(teams, ticks);
  const last = ticks[ticks.length - 1];
  const hasPrev = ticks.length > 1;
  const mover = hasPrev ? [...rows].sort((a, b) => b.total - b.prev - (a.total - a.prev))[0] : null;
  const mine = rows.find((r) => r.team.id === myTeamId);
  const sumNow = rows.reduce((acc, r) => acc + r.total, 0);
  const sumPrev = rows.reduce((acc, r) => acc + r.prev, 0);
  const focus = picked ?? myTeamId ?? rows[0]?.team.id ?? null;

  return (
    <section aria-labelledby="published" className="border-t border-fg/15 pt-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <Label id="published">{admin ? "참가자 화면 투자 현황" : "투자 현황"}</Label>
        <div className="flex gap-1" role="group" aria-label="보기 방식">
          {(
            [
              [false, "그래프"],
              [true, "표"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={l}
              type="button"
              aria-pressed={asTable === v}
              onClick={() => setAsTable(v)}
              className={`border px-3 py-1 text-xs font-bold transition ${asTable === v ? "border-fg bg-fg text-page" : "border-fg/20 text-fg/70 hover:border-fg/50"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 text-sm text-fg/60">
        틱 {ticks.length}개 · 최근 {timeLabel(last.at)} 발행 기준
      </p>

      {/* Headline tiles */}
      <dl className="mb-6 grid gap-px border border-fg/10 bg-fg/10 sm:grid-cols-3">
        <Tile label="1위" value={rows[0].team.project} sub={man(rows[0].total)} />
        <Tile
          label="이번 틱 최대 상승"
          value={mover && mover.total - mover.prev > 0 ? mover.team.project : "—"}
          sub={mover && mover.total - mover.prev > 0 ? signed(mover.total - mover.prev) : "첫 틱"}
        />
        {admin ? (
          <Tile label="최근 틱 총액" value={man(sumNow)} sub={hasPrev ? `이전 틱 대비 ${signed(sumNow - sumPrev)}` : "첫 틱"} />
        ) : (
          <Tile
            label="내 팀 순위"
            value={mine ? `${mine.rank}위` : "—"}
            sub={mine ? `${man(mine.total)}${hasPrev ? ` · ${signed(mine.total - mine.prev)}` : ""}` : "팀 미배정"}
          />
        )}
      </dl>

      {asTable ? (
        <TickTable teams={rows.map((r) => r.team)} ticks={ticks} myTeamId={myTeamId} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <TickChart ticks={ticks} teams={teams} focus={focus} myTeamId={myTeamId} />
          <RankList rows={rows} focus={focus} myTeamId={myTeamId} hasPrev={hasPrev} onPick={setPicked} picked={picked} />
        </div>
      )}
      <p className="mt-4 text-xs text-fg/40">
        {admin
          ? "참가자에게 보이는 것과 같은 화면입니다. 발행한 틱만 표시되며, 실시간 현황은 아래에서 확인하세요."
          : "운영진이 발행한 틱만 표시되며, 실시간으로 바뀌지 않습니다."}
      </p>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 bg-page px-4 py-3">
      <dt className="tabular-nums text-[11px] uppercase tracking-[0.15em] text-fg/50">{label}</dt>
      <dd className="mt-1 truncate text-xl font-bold">{value}</dd>
      <dd className="text-xs tabular-nums text-fg/60">{sub}</dd>
    </div>
  );
}

/* ---------- Line chart ---------- */

const H = 300;
const M = { top: 16, right: 16, bottom: 28, left: 52 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function TickChart({
  ticks,
  teams,
  focus,
  myTeamId,
}: {
  ticks: Snapshot[];
  teams: Team[];
  focus: string | null;
  myTeamId?: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = ticks.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const yMax = niceMax(Math.max(0, ...ticks.flatMap((t) => Object.values(t.totals))));
  const x = (i: number) => M.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));

  // Draw order: context lines, then my team, then the focused team on top
  const order = [...teams].sort((a, b) => rankOf(a.id) - rankOf(b.id));
  function rankOf(id: string) {
    if (id === focus) return 2;
    if (id === myTeamId) return 1;
    return 0;
  }
  const stroke = (id: string) => (id === focus ? "var(--g-blue)" : "var(--fg)");
  const opacity = (id: string) => (id === focus ? 1 : id === myTeamId ? 0.75 : 0.18);

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const i = n === 1 ? 0 : Math.round((px / box.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const cur = hover ?? n - 1;
    setHover(Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowRight" ? 1 : -1))));
  }

  const hi = hover ?? null;
  const tipRows =
    hi === null
      ? []
      : [...teams]
          .map((t) => ({ t, v: ticks[hi].totals[t.id] ?? 0 }))
          .sort((a, b) => b.v - a.v);
  const focusTeam = teams.find((t) => t.id === focus);
  const lastTick = ticks[n - 1];

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
      aria-label={`틱별 투자금 추이 그래프. 틱 ${n}개. 좌우 화살표로 틱을 이동할 수 있습니다.${
        focusTeam ? ` 강조: ${focusTeam.project} ${man(lastTick.totals[focusTeam.id] ?? 0)}.` : ""
      }`}
      className="relative min-w-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg/40"
    >
      {width > 0 && (
        <svg width={width} height={H} className="block text-fg" role="img" aria-hidden="true">
          {/* Grid + y axis */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.3 : 0.08} />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-current tabular-nums text-[10px]" fillOpacity={0.5}>
                {v === 0 ? "0" : man(v)}
              </text>
            </g>
          ))}

          {/* X axis: tick times */}
          {ticks.map((t, i) =>
            i % every === 0 || i === n - 1 ? (
              <text
                key={t.at + "-" + i}
                x={x(i)}
                y={H - 8}
                textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="fill-current tabular-nums text-[10px]"
                fillOpacity={hi === i ? 0.9 : 0.5}
              >
                {clockLabel(t.at)}
              </text>
            ) : null,
          )}

          {/* Crosshair */}
          {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={M.top} y2={M.top + innerH} stroke="currentColor" strokeOpacity={0.3} />}

          {/* Series */}
          {order.map((t) => {
            const pts = ticks.map((tk, i) => [x(i), y(tk.totals[t.id] ?? 0)] as const);
            const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
            const strong = t.id === focus || t.id === myTeamId;
            const [ex, ey] = pts[pts.length - 1];
            return (
              <g key={t.id}>
                {n > 1 && (
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke(t.id)}
                    strokeOpacity={opacity(t.id)}
                    strokeWidth={t.id === focus ? 2.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {(strong || n === 1) && (
                  <circle cx={ex} cy={ey} r={strong ? 4.5 : 3} fill={stroke(t.id)} fillOpacity={strong ? 1 : 0.35} stroke="var(--page)" strokeWidth={2} />
                )}
                {hi !== null && (
                  <circle
                    cx={x(hi)}
                    cy={y(ticks[hi].totals[t.id] ?? 0)}
                    r={strong ? 4.5 : 2.5}
                    fill={stroke(t.id)}
                    fillOpacity={strong ? 1 : 0.4}
                    stroke="var(--page)"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {/* Hit area for hover */}
          <rect
            x={M.left - 8}
            y={M.top}
            width={innerW + 16}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {width === 0 && <div style={{ height: H }} />}

      {/* Tooltip: every series at the hovered tick, values first */}
      {hi !== null && width > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 w-56 border border-fg/15 bg-page px-3 py-2 text-xs"
          style={x(hi) > width / 2 ? { left: Math.max(0, x(hi) - 232) } : { left: Math.min(width - 224, x(hi) + 12) }}
        >
          <p className="mb-1.5 tabular-nums text-[11px] text-fg/50">
            틱 {hi + 1} · {clockLabel(ticks[hi].at)}
          </p>
          <ul className="grid gap-1">
            {tipRows.map(({ t, v }) => {
              const strong = t.id === focus || t.id === myTeamId;
              return (
                <li key={t.id} className="flex items-center gap-2">
                  <span
                    className="h-0.5 w-3 shrink-0"
                    style={{ background: stroke(t.id), opacity: strong ? 1 : 0.35 }}
                    aria-hidden="true"
                  />
                  <span className={`w-16 shrink-0 text-right  tabular-nums ${strong ? "font-bold text-fg" : "text-fg/70"}`}>
                    {man(v)}
                  </span>
                  <span className={`truncate ${strong ? "font-bold text-fg" : "text-fg/60"}`}>{t.project}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Key for the two emphasized lines (identity is never color-alone) */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg/60">
        {focusTeam && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[var(--g-blue)]" aria-hidden="true" />
            {focusTeam.project}
          </span>
        )}
        {myTeamId && myTeamId !== focus && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-fg/75" aria-hidden="true" />
            내 팀
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-fg/20" aria-hidden="true" />
          다른 프로젝트
        </span>
      </div>
    </div>
  );
}

/* ---------- Ranking (legend) ---------- */

function RankList({
  rows,
  focus,
  picked,
  myTeamId,
  hasPrev,
  onPick,
}: {
  rows: Row[];
  focus: string | null;
  picked: string | null;
  myTeamId?: string;
  hasPrev: boolean;
  onPick: (id: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-fg/50">프로젝트를 누르면 그래프에서 강조됩니다.</p>
      <ol className="border-t border-fg/10">
        {rows.map((r) => {
          const on = r.team.id === focus;
          const mine = r.team.id === myTeamId;
          const move = r.prevRank === null ? 0 : r.prevRank - r.rank;
          const delta = r.total - r.prev;
          return (
            <li key={r.team.id}>
              <button
                type="button"
                aria-pressed={picked === r.team.id}
                onClick={() => onPick(picked === r.team.id ? null : r.team.id)}
                className={`grid w-full grid-cols-[1.5rem_2rem_1fr_auto] items-center gap-2 border-b border-fg/10 px-2 py-2.5 text-left transition hover:bg-fg/[0.05] ${on ? "bg-fg/[0.07]" : ""}`}
              >
                <span className="tabular-nums text-sm font-bold text-fg/60">{r.rank}</span>
                <span className="text-[11px] tabular-nums text-fg/60">
                  {!hasPrev || move === 0 ? (
                    <span className="text-fg/30">–</span>
                  ) : move > 0 ? (
                    <>
                      <span className="text-[var(--g-green)]" aria-hidden="true">
                        ▲
                      </span>
                      <span className="sr-only">순위 상승</span>
                      {move}
                    </>
                  ) : (
                    <>
                      <span className="text-[var(--g-red)]" aria-hidden="true">
                        ▼
                      </span>
                      <span className="sr-only">순위 하락</span>
                      {-move}
                    </>
                  )}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-0.5 w-3 shrink-0"
                    style={{ background: on ? "var(--g-blue)" : "var(--fg)", opacity: on ? 1 : mine ? 0.75 : 0.2 }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className={`truncate text-sm ${on || mine ? "font-bold" : ""}`}>{r.team.project || r.team.name}</span>
                      {mine && <span className="shrink-0 bg-fg px-1 py-px text-[9px] font-bold text-page">MY</span>}
                    </span>
                    <span className="block truncate text-[11px] text-fg/50">{r.team.name}</span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold tabular-nums">{man(r.total)}</span>
                  {hasPrev && <span className="block text-[11px] tabular-nums text-fg/50">{signed(delta)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- Table view ---------- */

function TickTable({ teams, ticks, myTeamId }: { teams: Team[]; ticks: Snapshot[]; myTeamId?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-t border-fg/15 text-left text-sm">
        <thead className="text-xs text-fg/50">
          <tr className="border-b border-fg/15">
            <th className="sticky left-0 bg-page py-2 pr-3 font-normal">프로젝트</th>
            {ticks.map((t, i) => (
              <th key={t.at + "-" + i} className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-normal">
                {clockLabel(t.at)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id} className={`border-b border-fg/10 ${team.id === myTeamId ? "font-bold" : ""}`}>
              <td className="sticky left-0 whitespace-nowrap bg-page py-2.5 pr-3">
                {team.project || team.name}
                {team.id === myTeamId && <span className="ml-2 bg-fg px-1.5 py-0.5 text-[10px] font-bold text-page">MY</span>}
              </td>
              {ticks.map((t, i) => (
                <td key={t.at + "-" + i} className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-fg/80">
                  {man(t.totals[team.id] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
