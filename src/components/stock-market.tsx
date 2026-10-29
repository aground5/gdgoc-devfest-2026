"use client";

// Experimental 주식 tab on /onfestival: each team's project trades as a stock.
// The order book and the trade tape are public market data; everything else here
// (cash, holdings, open orders, fills) is only the viewer's own.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Participant, Team } from "@/data/guide";
import { clockLabel, updateFestival, won, type FestivalState } from "@/lib/festival-store";
import {
  IPO,
  IPO_PRICE,
  SHARES,
  STOCK_CASH,
  TICK,
  availableCash,
  availableShares,
  avgCost,
  cancelOrder,
  candles,
  cashOf,
  lastPrice,
  orderBook,
  placeOrder,
  sharesOf,
  volumeOf,
  withListings,
  type Candle,
  type Market,
  type Side,
} from "@/lib/stock-engine";
import { Label, smallBtn } from "./festival-ui";

const num = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;

// Korean market convention: rising = red, falling = blue
const UP = "var(--g-red)";
const DOWN = "var(--g-blue)";
const dirColor = (d: number) => (d > 0 ? UP : d < 0 ? DOWN : "var(--fg)");
const arrow = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "–");

const ids = (teams: Team[]) => teams.map((t) => t.id);

export function StockPanel({ state, me }: { state: FestivalState; me: Participant }) {
  const teams = state.teams;
  // IPO listings for teams staff added later are filled in on the fly
  const market = useMemo(() => withListings(state.market, ids(teams), 0), [state.market, teams]);
  const tradable = teams.filter((t) => t.id !== me.teamId);
  const [picked, setPicked] = useState<string | null>(null);
  const sel = teams.find((t) => t.id === picked) ?? tradable[0] ?? teams[0];

  // Order form state lives here so the order book can prefill it
  const [side, setSide] = useState<Side>("buy");
  const [price, setPrice] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!sel) return <p className="text-fg/60">상장된 프로젝트가 없습니다.</p>;
  const last = lastPrice(market, sel.id);
  const orderPrice = price ?? last;

  function select(id: string) {
    setPicked(id);
    setPrice(null);
    setQty(1);
    setResult(null);
  }

  function submit() {
    const now = Date.now();
    let outcome: ReturnType<typeof placeOrder> | null = null;
    updateFestival((s) => {
      const base = withListings(s.market, ids(s.teams), 0);
      outcome = placeOrder(base, { teamId: sel.id, side, price: orderPrice, qty, owner: me.id }, now);
      return "market" in outcome ? { ...s, market: outcome.market } : s;
    });
    const r = outcome as ReturnType<typeof placeOrder> | null;
    if (!r) return;
    if ("error" in r) return setResult({ ok: false, text: r.error });
    const filled = r.trades.reduce((n, t) => n + t.qty, 0);
    const left = qty - filled;
    const avg = filled ? Math.round(r.trades.reduce((n, t) => n + t.qty * t.price, 0) / filled) : 0;
    setResult({
      ok: true,
      text:
        filled === 0
          ? `${num(qty)}주 주문이 호가창에 등록되었습니다.`
          : `${num(filled)}주 체결 (평균 ${num(avg)}원)${left ? ` · ${num(left)}주는 대기 중` : ""}`,
    });
  }

  return (
    <div className="grid gap-6">
      <p className="flex flex-wrap items-center gap-2 border border-dashed border-fg/25 px-4 py-2.5 text-sm text-fg/70">
        <span className="bg-fg px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-page">BETA</span>
        실험 기능입니다. 각 프로젝트가 {SHARES}주씩 공모가 {num(IPO_PRICE)}원에 상장되어 있고, 지정가로 사고팔 수 있습니다. 투자 탭과는 별개의 모의 거래입니다.
      </p>

      <Portfolio market={market} me={me} teams={teams} />

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_19rem]">
        <StockList market={market} teams={teams} sel={sel.id} me={me} onSelect={select} />

        <div className="grid min-w-0 content-start gap-6">
          <StockHeader market={market} team={sel} />
          <CandleChart market={market} teamId={sel.id} />
          <Activity market={market} me={me.id} teams={teams} sel={sel} />
        </div>

        <div className="grid content-start gap-6">
          <OrderBook
            market={market}
            teamId={sel.id}
            me={me.id}
            onPick={(p, s) => {
              setPrice(p);
              setSide(s);
              setResult(null);
            }}
          />
          {sel.id === me.teamId ? (
            <p className="border border-fg/15 p-4 text-sm text-fg/60">본인 팀 주식은 거래할 수 없습니다.</p>
          ) : (
            <OrderForm
              market={market}
              me={me.id}
              teamId={sel.id}
              side={side}
              price={orderPrice}
              qty={qty}
              result={result}
              onSide={(s) => {
                setSide(s);
                setResult(null);
              }}
              onPrice={setPrice}
              onQty={setQty}
              onSubmit={submit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Portfolio ---------- */

function Portfolio({ market, me, teams }: { market: Market; me: Participant; teams: Team[] }) {
  const cash = cashOf(market, me.id);
  const free = availableCash(market, me.id);
  const value = teams.reduce((sum, t) => sum + sharesOf(market, me.id, t.id) * lastPrice(market, t.id), 0);
  const total = cash + value;
  const gain = total - STOCK_CASH;

  return (
    <dl className="grid grid-cols-2 gap-px border border-fg/10 bg-fg/10 sm:grid-cols-4">
      <Stat label="총 자산" value={won(total)} sub={<span style={{ color: dirColor(gain) }}>{arrow(gain)} {pct(gain / STOCK_CASH)}</span>} />
      <Stat label="주식 평가액" value={won(value)} />
      <Stat label="보유 현금" value={won(cash)} />
      <Stat label="주문 가능" value={won(free)} sub={cash !== free ? `${won(cash - free)} 주문 대기` : undefined} />
    </dl>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-page px-4 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg/50">{label}</dt>
      <dd className="mt-1 truncate font-mono text-lg font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="font-mono text-xs font-semibold tabular-nums text-fg/60">{sub}</dd>}
    </div>
  );
}

/* ---------- Stock list ---------- */

function StockList({
  market,
  teams,
  sel,
  me,
  onSelect,
}: {
  market: Market;
  teams: Team[];
  sel: string;
  me: Participant;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-labelledby="stock-list">
      <Label id="stock-list">종목</Label>
      <ul className="mt-3 border-t border-fg/10">
        {teams.map((t) => {
          const p = lastPrice(market, t.id);
          const d = p - IPO_PRICE;
          const on = t.id === sel;
          const held = sharesOf(market, me.id, t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(t.id)}
                className={`flex w-full items-center justify-between gap-2 border-b border-fg/10 px-2 py-2.5 text-left transition hover:bg-fg/[0.05] ${on ? "bg-fg/[0.08]" : ""}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate text-sm ${on ? "font-semibold" : ""}`}>{t.project || t.name}</span>
                    {t.id === me.teamId && <span className="shrink-0 bg-fg px-1 py-px text-[9px] font-bold text-page">MY</span>}
                  </span>
                  <span className="block truncate text-[11px] text-fg/50">
                    {t.name}
                    {held > 0 && ` · ${held}주 보유`}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono tabular-nums">
                  <span className="block text-sm font-semibold">{num(p)}</span>
                  <span className="block text-[11px]">
                    <span style={{ color: dirColor(d) }} aria-hidden="true">
                      {arrow(d)}
                    </span>{" "}
                    <span className="text-fg/60">{pct(d / IPO_PRICE)}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Header ---------- */

function StockHeader({ market, team }: { market: Market; team: Team }) {
  const p = lastPrice(market, team.id);
  const d = p - IPO_PRICE;
  const ipoLeft = market.orders
    .filter((o) => o.owner === IPO && o.teamId === team.id && o.status === "open")
    .reduce((n, o) => n + o.qty - o.filled, 0);

  return (
    <section aria-labelledby="stock-head" className="border border-fg/15 p-5">
      <p className="font-mono text-xs text-fg/50">
        {team.table} · {team.name}
      </p>
      <h2 id="stock-head" className="mt-1 text-2xl font-semibold tracking-tight">
        {team.project || team.name}
      </h2>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-4xl font-semibold tabular-nums" style={{ color: dirColor(d) }}>
          {num(p)}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: dirColor(d) }}>
          {arrow(d)} {num(Math.abs(d))} ({pct(d / IPO_PRICE)})
        </span>
        <span className="text-xs text-fg/50">공모가 {num(IPO_PRICE)}원 대비</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-fg/50">거래량</dt>
          <dd className="font-mono tabular-nums">{num(volumeOf(market, team.id))}주</dd>
        </div>
        <div>
          <dt className="text-xs text-fg/50">시가총액</dt>
          <dd className="font-mono tabular-nums">{num((p * SHARES) / 10_000)}만원</dd>
        </div>
        <div>
          <dt className="text-xs text-fg/50">공모 잔량</dt>
          <dd className="font-mono tabular-nums">
            {ipoLeft}/{SHARES}주
          </dd>
        </div>
      </dl>
    </section>
  );
}

/* ---------- Candle chart (TradingView Lightweight Charts) ---------- */

const BUCKETS = [
  { ms: 5 * 60_000, label: "5분" },
  { ms: 10 * 60_000, label: "10분" },
  { ms: 30 * 60_000, label: "30분" },
];
const CH = 300;

// The chart draws on a canvas, so theme colors are read from the CSS variables
// as concrete values and re-applied when the theme changes.
type ChartColors = { up: string; down: string; flat: string; text: string; grid: string; line: string; page: string; font: string };

function alpha(color: string, a: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function readColors(): ChartColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const fg = v("--fg");
  return {
    up: v("--g-red"),
    down: v("--g-blue"),
    flat: alpha(fg, 0.45),
    text: alpha(fg, 0.55),
    grid: alpha(fg, 0.07),
    line: alpha(fg, 0.35),
    page: v("--page"),
    font: getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace",
  };
}

function onThemeChange(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("themechange", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("themechange", cb);
  };
}

const toTime = (ms: number) => (ms / 1000) as UTCTimestamp;
const fromTime = (t: Time) => (t as number) * 1000;

type Hover = { c: Candle; x: number; w: number };

function CandleChart({ market, teamId }: { market: Market; teamId: string }) {
  const [bucket, setBucket] = useState(BUCKETS[1].ms);
  const [hover, setHover] = useState<Hover | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<{
    chart: IChartApi;
    candle: ISeriesApi<"Candlestick">;
    volume: ISeriesApi<"Histogram">;
    ipo: IPriceLine;
    colors: ChartColors;
    byTime: Map<number, Candle>;
  } | null>(null);

  const data = useMemo(
    () =>
      candles(
        market.trades.filter((t) => t.teamId === teamId),
        bucket,
      ),
    [market.trades, teamId, bucket],
  );
  const last = lastPrice(market, teamId);
  // Latest rows for the chart callbacks
  const dataRef = useRef(data);
  const paintRef = useRef<() => void>(() => {});

  // Create the chart once
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const colors = readColors();
    const chart = createChart(el, {
      autoSize: true,
      localization: {
        locale: "ko-KR",
        timeFormatter: (t: Time) => clockLabel(fromTime(t)),
        priceFormatter: (p: number) => num(Math.round(p)),
      },
      timeScale: {
        timeVisible: true,
        barSpacing: 10,
        rightOffset: 2,
        tickMarkFormatter: (t: Time) => clockLabel(fromTime(t)),
      },
      rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.28 } },
      crosshair: { mode: CrosshairMode.Normal },
      // Let the page scroll vertically on touch screens
      handleScroll: { vertTouchDrag: false },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      priceFormat: { type: "price", precision: 0, minMove: TICK },
      borderVisible: false,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const ipo = candle.createPriceLine({
      price: IPO_PRICE,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: false,
      title: "공모가",
    });
    api.current = { chart, candle, volume, ipo, colors, byTime: new Map() };

    function paint() {
      const a = api.current;
      if (!a) return;
      const c = (a.colors = readColors());
      chart.applyOptions({
        layout: { background: { type: ColorType.Solid, color: c.page }, textColor: c.text, fontFamily: c.font, fontSize: 10 },
        grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
        rightPriceScale: { borderColor: c.grid },
        timeScale: { borderColor: c.grid },
        crosshair: {
          vertLine: { color: c.line, labelBackgroundColor: c.text },
          horzLine: { color: c.line, labelBackgroundColor: c.text },
        },
      });
      candle.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down });
      ipo.applyOptions({ color: c.line, axisLabelColor: c.line });
      setSeries();
    }

    function setSeries() {
      const a = api.current;
      if (!a) return;
      const { up, down, flat } = a.colors;
      const rows = dataRef.current;
      a.byTime = new Map(rows.map((r) => [r.t, r]));
      a.candle.setData(
        rows.map((r) => {
          // A flat candle (보합) is neutral
          const color = r.c > r.o ? up : r.c < r.o ? down : flat;
          return { time: toTime(r.t), open: r.o, high: r.h, low: r.l, close: r.c, color, wickColor: color };
        }),
      );
      a.volume.setData(
        rows.map((r) => ({
          time: toTime(r.t),
          value: r.v,
          color: alpha(r.c > r.o ? up : r.c < r.o ? down : flat, 0.35),
        })),
      );
    }
    paintRef.current = setSeries;

    chart.subscribeCrosshairMove((p) => {
      const a = api.current;
      const c = p.time !== undefined && p.point ? a?.byTime.get(fromTime(p.time)) : undefined;
      setHover(c && p.point ? { c, x: p.point.x, w: el.clientWidth } : null);
    });

    paint();
    const off = onThemeChange(paint);
    return () => {
      off();
      chart.remove();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    dataRef.current = data;
    paintRef.current();
  }, [data]);

  // A new stock or interval starts from a full view; live updates keep the user's zoom
  useEffect(() => {
    api.current?.chart.timeScale().fitContent();
  }, [teamId, bucket]);

  return (
    <section aria-labelledby="chart-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label id="chart-title">차트</Label>
        <div className="flex gap-1" role="group" aria-label="캔들 간격">
          {BUCKETS.map((b) => (
            <button
              key={b.ms}
              type="button"
              aria-pressed={bucket === b.ms}
              onClick={() => setBucket(b.ms)}
              className={`border px-2.5 py-1 text-xs font-semibold transition ${bucket === b.ms ? "border-fg bg-fg text-page" : "border-fg/20 text-fg/70 hover:border-fg/50"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative border border-fg/10">
        <div ref={box} style={{ height: CH }} role="img" aria-label={`가격 차트, 현재가 ${num(last)}원`} />

        {data.length === 0 && (
          <div className="absolute inset-0 grid place-items-center bg-page px-4 text-center text-sm text-fg/60">
            아직 체결이 없습니다. 공모가 {num(IPO_PRICE)}원에 첫 거래를 기다리고 있습니다.
          </div>
        )}

        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 w-44 border border-fg/15 bg-page px-3 py-2 font-mono text-xs shadow-lg"
            style={hover.x > hover.w / 2 ? { left: Math.max(4, hover.x - 188) } : { left: Math.min(hover.w - 180, hover.x + 12) }}
          >
            <p className="mb-1 text-[11px] text-fg/50">{clockLabel(hover.c.t)}</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: dirColor(hover.c.c - hover.c.o) }}>
              {num(hover.c.c)}원
            </p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 tabular-nums text-fg/70">
              <dt>시가</dt>
              <dd className="text-right">{num(hover.c.o)}</dd>
              <dt>고가</dt>
              <dd className="text-right">{num(hover.c.h)}</dd>
              <dt>저가</dt>
              <dd className="text-right">{num(hover.c.l)}</dd>
              <dt>거래량</dt>
              <dd className="text-right">{num(hover.c.v)}주</dd>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Order book ---------- */

const DEPTH = 5;

function OrderBook({
  market,
  teamId,
  me,
  onPick,
}: {
  market: Market;
  teamId: string;
  me: string;
  onPick: (price: number, side: Side) => void;
}) {
  const { asks, bids } = orderBook(market, teamId, DEPTH, me);
  const last = lastPrice(market, teamId);
  const max = Math.max(1, ...asks.map((l) => l.qty), ...bids.map((l) => l.qty));
  const ipoAt = (p: number) =>
    market.orders.some((o) => o.owner === IPO && o.teamId === teamId && o.status === "open" && o.price === p);
  const totalAsk = orderBook(market, teamId, 999).asks.reduce((n, l) => n + l.qty, 0);
  const totalBid = orderBook(market, teamId, 999).bids.reduce((n, l) => n + l.qty, 0);

  // Pad to a fixed number of rows so the price column doesn't jump
  const askRows = [...asks].reverse();
  const askPad = DEPTH - askRows.length;
  const bidPad = DEPTH - bids.length;

  const row = (l: { price: number; qty: number; mine: number }, side: "ask" | "bid") => {
    const d = l.price - IPO_PRICE;
    return (
      <li key={`${side}${l.price}`}>
        <button
          type="button"
          onClick={() => onPick(l.price, side === "ask" ? "buy" : "sell")}
          title={side === "ask" ? "이 가격으로 매수" : "이 가격으로 매도"}
          className={`grid h-8 w-full grid-cols-[1fr_6.5rem_1fr] items-center text-xs transition hover:bg-fg/[0.06] ${l.price === last ? "outline outline-1 -outline-offset-1 outline-fg/50" : ""}`}
        >
          {/* 매도 잔량 (left) */}
          <span className="relative flex h-full items-center justify-end pr-2 font-mono tabular-nums">
            {side === "ask" && (
              <>
                <span className="absolute inset-y-1 right-0" style={{ width: `${(l.qty / max) * 100}%`, background: DOWN, opacity: 0.14 }} />
                <span className="relative">
                  {l.mine > 0 && <span className="mr-1 text-[10px] text-fg/50">내 {l.mine}</span>}
                  {num(l.qty)}
                </span>
              </>
            )}
          </span>
          <span className={`text-center font-mono font-semibold tabular-nums ${side === "ask" ? "bg-[var(--g-blue)]/[0.06]" : "bg-[var(--g-red)]/[0.06]"} flex h-full items-center justify-center gap-1`}>
            <span style={{ color: dirColor(d) }}>{num(l.price)}</span>
            {ipoAt(l.price) && side === "ask" && <span className="text-[9px] font-bold text-fg/50">공모</span>}
          </span>
          {/* 매수 잔량 (right) */}
          <span className="relative flex h-full items-center pl-2 font-mono tabular-nums">
            {side === "bid" && (
              <>
                <span className="absolute inset-y-1 left-0" style={{ width: `${(l.qty / max) * 100}%`, background: UP, opacity: 0.14 }} />
                <span className="relative">
                  {num(l.qty)}
                  {l.mine > 0 && <span className="ml-1 text-[10px] text-fg/50">내 {l.mine}</span>}
                </span>
              </>
            )}
          </span>
        </button>
      </li>
    );
  };

  const empty = (k: string) => <li key={k} className="h-8" aria-hidden="true" />;

  return (
    <section aria-labelledby="book-title">
      <div className="mb-2 flex items-baseline justify-between">
        <Label id="book-title">호가</Label>
        <span className="text-[11px] text-fg/40">호가를 누르면 주문 가격에 들어갑니다</span>
      </div>
      <div className="border border-fg/15">
        <div className="grid grid-cols-[1fr_6.5rem_1fr] border-b border-fg/10 py-1.5 text-center text-[11px] text-fg/50">
          <span className="pr-2 text-right">매도잔량</span>
          <span>가격</span>
          <span className="pl-2 text-left">매수잔량</span>
        </div>
        <ol aria-label="매도 호가">
          {Array.from({ length: askPad }, (_, i) => empty(`ap${i}`))}
          {askRows.map((l) => row(l, "ask"))}
        </ol>
        <ol aria-label="매수 호가" className="border-t border-fg/15">
          {bids.map((l) => row(l, "bid"))}
          {Array.from({ length: bidPad }, (_, i) => empty(`bp${i}`))}
        </ol>
        <div className="grid grid-cols-[1fr_6.5rem_1fr] border-t border-fg/10 py-1.5 font-mono text-[11px] tabular-nums text-fg/60">
          <span className="pr-2 text-right">{num(totalAsk)}</span>
          <span className="text-center text-fg/40">총 잔량</span>
          <span className="pl-2">{num(totalBid)}</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- Order form ---------- */

function OrderForm({
  market,
  me,
  teamId,
  side,
  price,
  qty,
  result,
  onSide,
  onPrice,
  onQty,
  onSubmit,
}: {
  market: Market;
  me: string;
  teamId: string;
  side: Side;
  price: number;
  qty: number;
  result: { ok: boolean; text: string } | null;
  onSide: (s: Side) => void;
  onPrice: (p: number) => void;
  onQty: (q: number) => void;
  onSubmit: () => void;
}) {
  const free = availableCash(market, me);
  const shares = availableShares(market, me, teamId);
  const maxQty = side === "buy" ? Math.floor(free / Math.max(TICK, price)) : shares;
  const total = price * qty;
  const bad = qty < 1 || qty > maxQty || price < TICK;
  const color = side === "buy" ? UP : DOWN;
  const stepBtn = "grid h-10 w-10 shrink-0 place-items-center border border-fg/20 transition hover:bg-fg/10 disabled:opacity-25";

  function send(e: FormEvent) {
    e.preventDefault();
    if (!bad) onSubmit();
  }

  return (
    <form onSubmit={send} className="border border-fg/15" noValidate>
      <div className="grid grid-cols-2" role="group" aria-label="주문 종류">
        {(
          [
            ["buy", "매수"],
            ["sell", "매도"],
          ] as const
        ).map(([s, l]) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => onSide(s)}
            className={`py-2.5 text-sm font-semibold transition ${side === s ? "text-white" : "text-fg/60 hover:bg-fg/[0.05]"}`}
            style={side === s ? { background: s === "buy" ? UP : DOWN } : undefined}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-3 p-4">
        <div>
          <label htmlFor="ord-price" className="text-xs text-fg/60">
            가격 (지정가 · {num(TICK)}원 단위)
          </label>
          <div className="mt-1.5 flex">
            <button type="button" aria-label="가격 내리기" onClick={() => onPrice(Math.max(TICK, price - TICK))} className={stepBtn}>
              −
            </button>
            <input
              id="ord-price"
              inputMode="numeric"
              autoComplete="off"
              value={num(price)}
              onChange={(e) => onPrice(Number(e.target.value.replace(/\D/g, "")) || 0)}
              onBlur={() => onPrice(Math.max(TICK, Math.round(price / TICK) * TICK))}
              className="h-10 min-w-0 flex-1 border-y border-fg/20 bg-fg/[0.04] px-3 text-right font-mono tabular-nums text-fg outline-none focus:border-fg/60"
            />
            <button type="button" aria-label="가격 올리기" onClick={() => onPrice(price + TICK)} className={stepBtn}>
              +
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="ord-qty" className="text-xs text-fg/60">
            수량 (주)
          </label>
          <div className="mt-1.5 flex">
            <button type="button" aria-label="수량 줄이기" onClick={() => onQty(Math.max(1, qty - 1))} className={stepBtn}>
              −
            </button>
            <input
              id="ord-qty"
              inputMode="numeric"
              autoComplete="off"
              value={qty}
              onChange={(e) => onQty(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="h-10 min-w-0 flex-1 border-y border-fg/20 bg-fg/[0.04] px-3 text-right font-mono tabular-nums text-fg outline-none focus:border-fg/60"
            />
            <button type="button" aria-label="수량 늘리기" onClick={() => onQty(qty + 1)} className={stepBtn}>
              +
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {[0.1, 0.25, 0.5, 1].map((f) => (
              <button
                key={f}
                type="button"
                disabled={maxQty < 1}
                onClick={() => onQty(Math.max(1, Math.floor(maxQty * f)))}
                className={`${smallBtn} px-0 py-1 text-xs`}
              >
                {f === 1 ? "최대" : `${f * 100}%`}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid gap-1 border-t border-fg/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg/60">주문 금액</dt>
            <dd className="font-mono font-semibold tabular-nums">{won(total)}</dd>
          </div>
          <div className="flex justify-between text-xs">
            <dt className="text-fg/50">{side === "buy" ? "주문 가능 금액" : "매도 가능 수량"}</dt>
            <dd className="font-mono tabular-nums text-fg/70">{side === "buy" ? won(free) : `${num(shares)}주`}</dd>
          </div>
          <div className="flex justify-between text-xs">
            <dt className="text-fg/50">최대 주문</dt>
            <dd className="font-mono tabular-nums text-fg/70">{num(Math.max(0, maxQty))}주</dd>
          </div>
        </dl>

        <button
          type="submit"
          disabled={bad}
          className="py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-30"
          style={{ background: color }}
        >
          {side === "buy" ? "매수 주문" : "매도 주문"}
        </button>
        {qty > maxQty && maxQty >= 0 && (
          <p className="text-xs text-fg/60">
            {side === "buy" ? "주문 가능 금액을 넘었습니다." : "보유 수량을 넘었습니다."} 최대 {num(Math.max(0, maxQty))}주
          </p>
        )}
        {result && (
          <p role="status" className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-2 w-2 shrink-0" style={{ background: result.ok ? "var(--g-green)" : "var(--g-red)" }} aria-hidden="true" />
            {result.text}
          </p>
        )}
      </div>
    </form>
  );
}

/* ---------- My activity ---------- */

const ACT_TABS = [
  { id: "holdings", label: "보유 주식" },
  { id: "open", label: "미체결" },
  { id: "fills", label: "내 체결" },
  { id: "tape", label: "실시간 체결" },
] as const;

function Activity({ market, me, teams, sel }: { market: Market; me: string; teams: Team[]; sel: Team }) {
  const [tab, setTab] = useState<(typeof ACT_TABS)[number]["id"]>("holdings");
  const nameOf = (id: string) => {
    const t = teams.find((x) => x.id === id);
    return t ? t.project || t.name : "삭제된 팀";
  };
  const open = market.orders.filter((o) => o.owner === me && o.status === "open").sort((a, b) => b.at - a.at);
  const fills = market.trades.filter((t) => t.buyer === me || t.seller === me).sort((a, b) => b.at - a.at);
  const tape = market.trades.filter((t) => t.teamId === sel.id).slice(-20).reverse();
  const held = teams.filter((t) => sharesOf(market, me, t.id) > 0);

  return (
    <section aria-label="내 거래" className="min-w-0">
      <div className="flex gap-1 border-b border-fg/10" role="group" aria-label="거래 내역 종류">
        {ACT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? "text-fg" : "text-fg/50 hover:text-fg/80"}`}
          >
            {t.label}
            {t.id === "open" && open.length > 0 && <span className="ml-1 font-mono text-xs text-fg/50">{open.length}</span>}
            {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-fg" />}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {tab === "holdings" &&
          (held.length === 0 ? (
            <Empty text="보유한 주식이 없습니다." />
          ) : (
            <Table head={["종목", "보유", "평균 매수가", "현재가", "평가액", "평가손익"]} left={1}>
              {held.map((t) => {
                const q = sharesOf(market, me, t.id);
                const avg = avgCost(market, me, t.id);
                const p = lastPrice(market, t.id);
                const gain = (p - avg) * q;
                return (
                  <tr key={t.id} className="border-b border-fg/10">
                    <td className="py-2.5 pr-3 font-semibold">{nameOf(t.id)}</td>
                    <Num>{num(q)}주</Num>
                    <Num>{num(Math.round(avg))}</Num>
                    <Num>{num(p)}</Num>
                    <Num>{won(p * q)}</Num>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      <span style={{ color: dirColor(gain) }} aria-hidden="true">
                        {arrow(gain)}
                      </span>{" "}
                      {won(Math.round(Math.abs(gain)))} <span className="text-fg/50">({pct(avg ? (p - avg) / avg : 0)})</span>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ))}

        {tab === "open" &&
          (open.length === 0 ? (
            <Empty text="대기 중인 주문이 없습니다." />
          ) : (
            <Table head={["시각", "종목", "구분", "가격", "체결/주문", ""]} left={3}>
              {open.map((o) => (
                <tr key={o.id} className="border-b border-fg/10">
                  <td className="py-2.5 pr-3 font-mono text-xs text-fg/60">{clockLabel(o.at)}</td>
                  <td className="py-2.5 pr-3 font-semibold">{nameOf(o.teamId)}</td>
                  <td className="py-2.5 pr-3 font-semibold" style={{ color: o.side === "buy" ? UP : DOWN }}>
                    {o.side === "buy" ? "매수" : "매도"}
                  </td>
                  <Num>{num(o.price)}</Num>
                  <Num>
                    {num(o.filled)}/{num(o.qty)}주
                  </Num>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => updateFestival((s) => ({ ...s, market: cancelOrder(s.market, o.id, me) }))}
                      className={`${smallBtn} px-2 py-1 text-xs`}
                    >
                      취소
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ))}

        {tab === "fills" &&
          (fills.length === 0 ? (
            <Empty text="체결된 거래가 없습니다." />
          ) : (
            <Table head={["시각", "종목", "구분", "체결가", "수량", "금액"]} left={3}>
              {fills.map((t) => {
                const buy = t.buyer === me;
                return (
                  <tr key={t.id} className="border-b border-fg/10">
                    <td className="py-2.5 pr-3 font-mono text-xs text-fg/60">{clockLabel(t.at)}</td>
                    <td className="py-2.5 pr-3 font-semibold">{nameOf(t.teamId)}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: buy ? UP : DOWN }}>
                      {buy ? "매수" : "매도"}
                    </td>
                    <Num>{num(t.price)}</Num>
                    <Num>{num(t.qty)}주</Num>
                    <Num>{won(t.price * t.qty)}</Num>
                  </tr>
                );
              })}
            </Table>
          ))}

        {tab === "tape" &&
          (tape.length === 0 ? (
            <Empty text={`${sel.project || sel.name}의 체결이 아직 없습니다.`} />
          ) : (
            <Table head={["시각", "체결가", "수량", ""]} left={1}>
              {tape.map((t, i) => {
                const prev = tape[i + 1]?.price ?? IPO_PRICE;
                const d = t.price - prev;
                return (
                  <tr key={t.id} className="border-b border-fg/10">
                    <td className="py-2 pr-3 font-mono text-xs text-fg/60">{clockLabel(t.at)}</td>
                    <Num>
                      <span style={{ color: dirColor(d) }}>{num(t.price)}</span>
                    </Num>
                    <Num>{num(t.qty)}주</Num>
                    <td className="py-2 text-right text-xs text-fg/40">
                      {t.buyer === me ? "내 매수" : t.seller === me ? "내 매도" : t.seller === IPO ? "공모" : ""}
                    </td>
                  </tr>
                );
              })}
            </Table>
          ))}
      </div>
      <p className="mt-2 text-xs text-fg/40">
        시작 자금 {won(STOCK_CASH)} · 주문은 대기 중인 동안 금액(매수)이나 수량(매도)이 묶이고, 취소하면 풀립니다.
      </p>
    </section>
  );
}

// `left` = how many leading columns are left-aligned text; the rest are right-aligned numbers
function Table({ head, left, children }: { head: string[]; left: number; children: React.ReactNode }) {
  return (
    <table className="w-full min-w-[34rem] text-left text-sm">
      <thead className="text-xs text-fg/50">
        <tr className="border-b border-fg/15">
          {head.map((h, i) => (
            <th key={i} className={`py-2 pr-3 font-medium last:pr-0 ${i < left ? "" : "text-right"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <td className="py-2.5 pr-3 text-right font-mono tabular-nums last:pr-0">{children}</td>
);

const Empty = ({ text }: { text: string }) => <p className="py-6 text-sm text-fg/50">{text}</p>;
