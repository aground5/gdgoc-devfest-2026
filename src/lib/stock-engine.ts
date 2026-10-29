// Experimental stock market for the festival mockup (/onfestival 주식 tab).
// Pure functions only — no React, no storage — so it can be tested on its own.
//
// Rules
// - Every team issues SHARES (100) shares. The issuer ("ipo") lists all of them
//   as one sell order at the fixed IPO_PRICE (10,000원).
// - Limit orders only, matched by price then time. A trade fills at the resting
//   order's price. An owner's own orders never match each other.
// - Cash and shares tied up in open orders are reserved, so nobody can
//   overspend or oversell.

export const SHARES = 100;
export const IPO_PRICE = 10_000;
export const TICK = 100; // price step (호가 단위)
export const STOCK_CASH = 1_000_000; // starting cash per participant
export const IPO = "ipo";

export type Side = "buy" | "sell";

export type Order = {
  id: string;
  teamId: string;
  side: Side;
  price: number;
  qty: number;
  filled: number;
  owner: string; // participant id, or IPO
  at: number;
  status: "open" | "filled" | "cancelled";
};

export type Trade = {
  id: string;
  teamId: string;
  price: number;
  qty: number;
  buyer: string;
  seller: string;
  at: number;
};

export type Market = {
  orders: Order[];
  trades: Trade[];
  holdings: Record<string, Record<string, number>>; // owner -> teamId -> shares
  cash: Record<string, number>; // owner -> cash; missing = STOCK_CASH
  seq: number; // id counter
};

export const emptyMarket = (): Market => ({ orders: [], trades: [], holdings: {}, cash: {}, seq: 0 });

const remaining = (o: Order) => o.qty - o.filled;

/* ---------- Listing ---------- */

// Adds the IPO sell order for any team that doesn't have one yet (e.g. a team staff just created).
export function withListings(m: Market, teamIds: string[], at: number): Market {
  const listed = new Set(m.orders.filter((o) => o.owner === IPO).map((o) => o.teamId));
  const missing = teamIds.filter((id) => !listed.has(id));
  if (missing.length === 0) return m;
  return {
    ...m,
    orders: [
      ...m.orders,
      ...missing.map<Order>((teamId) => ({
        id: `ipo-${teamId}`,
        teamId,
        side: "sell",
        price: IPO_PRICE,
        qty: SHARES,
        filled: 0,
        owner: IPO,
        at,
        status: "open",
      })),
    ],
  };
}

/* ---------- Balances ---------- */

export const cashOf = (m: Market, owner: string) => m.cash[owner] ?? STOCK_CASH;

export const sharesOf = (m: Market, owner: string, teamId: string) => m.holdings[owner]?.[teamId] ?? 0;

// Cash not tied up in open buy orders
export function availableCash(m: Market, owner: string) {
  const reserved = m.orders
    .filter((o) => o.owner === owner && o.side === "buy" && o.status === "open")
    .reduce((sum, o) => sum + remaining(o) * o.price, 0);
  return cashOf(m, owner) - reserved;
}

// Shares not tied up in open sell orders
export function availableShares(m: Market, owner: string, teamId: string) {
  const reserved = m.orders
    .filter((o) => o.owner === owner && o.teamId === teamId && o.side === "sell" && o.status === "open")
    .reduce((sum, o) => sum + remaining(o), 0);
  return sharesOf(m, owner, teamId) - reserved;
}

/* ---------- Orders ---------- */

export type OrderInput = { teamId: string; side: Side; price: number; qty: number; owner: string };

export type PlaceResult = { market: Market; order: Order; trades: Trade[] } | { error: string };

export function placeOrder(m: Market, input: OrderInput, at: number): PlaceResult {
  const { teamId, side, price, qty, owner } = input;
  if (!Number.isInteger(qty) || qty <= 0) return { error: "수량은 1주 이상이어야 합니다." };
  if (!Number.isInteger(price) || price <= 0 || price % TICK !== 0)
    return { error: `가격은 ${TICK.toLocaleString("ko-KR")}원 단위로 입력해 주세요.` };
  if (owner !== IPO) {
    if (side === "buy" && price * qty > availableCash(m, owner)) return { error: "주문 가능 금액이 부족합니다." };
    if (side === "sell" && qty > availableShares(m, owner, teamId)) return { error: "주문 가능 수량이 부족합니다." };
  }

  const seq = m.seq + 1;
  const order: Order = { id: `o${seq}`, teamId, side, price, qty, filled: 0, owner, at, status: "open" };

  // Opposite resting orders this one crosses, best price first, then oldest
  const book = m.orders
    .filter(
      (o) =>
        o.teamId === teamId &&
        o.status === "open" &&
        o.side !== side &&
        o.owner !== owner &&
        (side === "buy" ? o.price <= price : o.price >= price),
    )
    .sort((a, b) => (side === "buy" ? a.price - b.price : b.price - a.price) || a.at - b.at);

  const updated = new Map<string, Order>();
  const trades: Trade[] = [];
  const holdings = { ...m.holdings };
  const cash = { ...m.cash };
  let tradeSeq = m.trades.length;

  const addShares = (who: string, n: number) => {
    if (who === IPO) return;
    holdings[who] = { ...holdings[who], [teamId]: (holdings[who]?.[teamId] ?? 0) + n };
  };
  const addCash = (who: string, n: number) => {
    if (who === IPO) return;
    cash[who] = (cash[who] ?? STOCK_CASH) + n;
  };

  for (const rest of book) {
    const need = remaining(order);
    if (need === 0) break;
    const q = Math.min(need, remaining(rest));
    const px = rest.price;
    const filledRest = { ...rest, filled: rest.filled + q };
    if (remaining(filledRest) === 0) filledRest.status = "filled";
    updated.set(rest.id, filledRest);
    order.filled += q;

    const buyer = side === "buy" ? owner : rest.owner;
    const seller = side === "sell" ? owner : rest.owner;
    addShares(buyer, q);
    addShares(seller, -q);
    addCash(buyer, -px * q);
    addCash(seller, px * q);
    trades.push({ id: `t${++tradeSeq}`, teamId, price: px, qty: q, buyer, seller, at });
  }
  if (remaining(order) === 0) order.status = "filled";

  return {
    market: {
      orders: [...m.orders.map((o) => updated.get(o.id) ?? o), order],
      trades: [...m.trades, ...trades],
      holdings,
      cash,
      seq,
    },
    order,
    trades,
  };
}

export function cancelOrder(m: Market, orderId: string, owner: string): Market {
  return {
    ...m,
    orders: m.orders.map((o) => (o.id === orderId && o.owner === owner && o.status === "open" ? { ...o, status: "cancelled" } : o)),
  };
}

/* ---------- Market data ---------- */

export const lastPrice = (m: Market, teamId: string) => {
  for (let i = m.trades.length - 1; i >= 0; i--) if (m.trades[i].teamId === teamId) return m.trades[i].price;
  return IPO_PRICE;
};

export const volumeOf = (m: Market, teamId: string) =>
  m.trades.filter((t) => t.teamId === teamId).reduce((sum, t) => sum + t.qty, 0);

export type Level = { price: number; qty: number; mine: number };

// Aggregated order book: asks lowest first, bids highest first
export function orderBook(m: Market, teamId: string, depth: number, viewer?: string) {
  const levels = (side: Side) => {
    const map = new Map<number, Level>();
    for (const o of m.orders) {
      if (o.teamId !== teamId || o.side !== side || o.status !== "open") continue;
      const l = map.get(o.price) ?? { price: o.price, qty: 0, mine: 0 };
      l.qty += remaining(o);
      if (o.owner === viewer) l.mine += remaining(o);
      map.set(o.price, l);
    }
    return [...map.values()].sort((a, b) => (side === "sell" ? a.price - b.price : b.price - a.price)).slice(0, depth);
  };
  return { asks: levels("sell"), bids: levels("buy") };
}

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

// OHLC per time bucket, oldest first
export function candles(trades: Trade[], bucketMs: number): Candle[] {
  const out: Candle[] = [];
  for (const tr of [...trades].sort((a, b) => a.at - b.at)) {
    const t = Math.floor(tr.at / bucketMs) * bucketMs;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, tr.price);
      last.l = Math.min(last.l, tr.price);
      last.c = tr.price;
      last.v += tr.qty;
    } else {
      out.push({ t, o: tr.price, h: tr.price, l: tr.price, c: tr.price, v: tr.qty });
    }
  }
  return out;
}

// Average buy price of current holdings (moving average over the owner's trades)
export function avgCost(m: Market, owner: string, teamId: string) {
  let qty = 0;
  let cost = 0;
  for (const t of m.trades) {
    if (t.teamId !== teamId) continue;
    if (t.buyer === owner) {
      qty += t.qty;
      cost += t.qty * t.price;
    } else if (t.seller === owner && qty > 0) {
      cost -= (cost / qty) * Math.min(t.qty, qty);
      qty -= Math.min(t.qty, qty);
    }
  }
  return qty > 0 ? cost / qty : 0;
}

/* ---------- Seed ---------- */

// Deterministic PRNG so the sample market looks the same on every load
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toTick = (p: number) => Math.max(TICK, Math.round(p / TICK) * TICK);

// Simulates a few hours of trading by other participants, ending just before `now`,
// so the chart and order book aren't empty. Runs through placeOrder, so balances stay consistent.
export function seedMarket(
  teams: { id: string }[],
  people: { id: string; teamId: string | null }[],
  skip: string,
  now: number,
): Market {
  const rnd = mulberry32(2026);
  let m = withListings(emptyMarket(), teams.map((t) => t.id), now - 4 * 3600_000);
  const traders = people.filter((p) => p.id !== skip);
  const steps = 26;
  const span = 3.5 * 3600_000;

  teams.forEach((team, ti) => {
    const pop = 0.4 + rnd() * 0.9; // how popular this team's stock is
    const drift = (rnd() - 0.42) * 0.05;
    const eligible = traders.filter((p) => p.teamId !== team.id);
    const ipoLeft = () =>
      m.orders.filter((o) => o.owner === IPO && o.teamId === team.id && o.status === "open").reduce((n, o) => n + o.qty - o.filled, 0);

    for (let k = 0; k < steps; k++) {
      const at = now - span + Math.round(((k + rnd() * 0.8) / steps) * span) + ti * 1000;
      const who = eligible[Math.floor(rnd() * eligible.length)];
      if (!who) break;
      const last = lastPrice(m, team.id);
      const held = availableShares(m, who.id, team.id);
      const sell = held > 0 && rnd() < 0.45;
      const move = drift + (rnd() - 0.5) * 0.06 + (sell ? -0.01 : 0.015);
      let price = toTick(last * (1 + move));
      // While IPO shares remain, most buyers take them at the fixed price
      if (!sell && ipoLeft() > 0 && rnd() < 0.8) price = Math.max(price, IPO_PRICE);
      const qty = sell ? 1 + Math.floor(rnd() * held) : 1 + Math.floor(rnd() * (2 + pop * 9));
      const r = placeOrder(m, { teamId: team.id, side: sell ? "sell" : "buy", price, qty, owner: who.id }, at);
      if ("market" in r) m = r.market;
    }

    // Leave some resting orders on both sides, outside the current best bid/ask so they don't trade
    for (let k = 1; k <= 4; k++) {
      const book = orderBook(m, team.id, 1);
      const last = lastPrice(m, team.id);
      const bidTop = Math.min(last, book.asks[0]?.price ?? Infinity) - TICK;
      const askBottom = Math.max(last, book.bids[0]?.price ?? 0) + TICK;
      const at = now - 60_000 * (10 - k);

      const buyer = eligible[Math.floor(rnd() * eligible.length)];
      if (buyer) {
        const price = toTick(bidTop - TICK * Math.floor(rnd() * 3));
        const r = placeOrder(m, { teamId: team.id, side: "buy", price, qty: 1 + Math.floor(rnd() * 6), owner: buyer.id }, at);
        if ("market" in r) m = r.market;
      }
      const holders = eligible.filter((p) => availableShares(m, p.id, team.id) > 0);
      const seller = holders[Math.floor(rnd() * holders.length)];
      if (seller) {
        const price = toTick(askBottom + TICK * Math.floor(rnd() * 3));
        const qty = 1 + Math.floor(rnd() * Math.min(5, availableShares(m, seller.id, team.id)));
        const r = placeOrder(m, { teamId: team.id, side: "sell", price, qty, owner: seller.id }, at);
        if ("market" in r) m = r.market;
      }
    }
  });

  return m;
}
