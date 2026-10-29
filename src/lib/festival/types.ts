// Shapes the festival screens render. Loaded per role from Supabase (src/lib/festival/load.ts);
// what a participant receives is already limited by RLS.

export type SchoolKey = "ku" | "yu" | "skku" | "kaist";

// Teams can mix schools, so school is tracked per participant.
export type Participant = {
  id: string;
  name: string;
  school: SchoolKey;
  teamId: string | null; // assigned by staff
  checkedIn: boolean; // participants only know their own; others read as false
};

export type Team = {
  id: string;
  name: string;
  table: string;
  project: string;
  desc: string;
};

// Confirmed investments: participantId -> teamId -> amount.
// A participant who confirmed an empty allocation maps to {}; one who never confirmed is absent.
export type Investments = Record<string, Record<string, number>>;

// One published investment status ("tick"). Participants only ever see published ticks.
export type Snapshot = {
  at: number;
  totals: Record<string, number>; // teamId -> amount
  investors: Record<string, number>; // teamId -> number of investors
};

export type FestivalState = {
  participants: Participant[];
  teams: Team[];
  investments: Investments; // participant view: own only
  budgets: Record<string, number>; // overrides only; participant view: own only
  ticks: Snapshot[]; // every publish, oldest first
  defaultBudget: number;
  investStep: number;
};

// Extra data only staff load.
export type StaffExtras = {
  attendanceCode: string;
  // participantId -> public login id, and whether a code has been issued (the code itself is never stored)
  logins: Record<string, { loginId: string; issued: boolean }>;
};

/* ---------- Demo Market ---------- */

export type MarketAsset = {
  id: string;
  kind: "image" | "file";
  bucket: "demo-images" | "demo-files";
  path: string;
  fileName: string;
  mime: string;
  size: number;
  caption: string;
  url: string | null; // short-lived signed URL
};

export type MarketEntry = {
  id: string;
  teamId: string;
  status: "draft" | "published";
  title: string;
  description: string;
  testInstructions: string;
  liveUrl: string | null;
  repoUrl: string | null;
  videoUrl: string | null;
  hidden: boolean;
  hiddenReason: string | null;
  publishedAt: number | null;
  updatedAt: number;
  credentials: string | null; // test account info, if the team added any
  images: MarketAsset[];
  files: MarketAsset[];
};
