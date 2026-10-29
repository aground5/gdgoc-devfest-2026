// Bulk edit of teams and participants by file (/organize → 일괄 수정).
// Staff download the current data as a template (.xlsx with two sheets, or two
// .csv files), edit it, and upload it back. The file is parsed and checked in
// the browser, a preview shows what will change, and bulk_import() applies it
// in one transaction.

import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import type { Participant, SchoolKey, Team } from "@/data/guide";

export const TEAM_COLS = ["테이블", "팀명", "프로젝트", "소개"] as const;
// No access code column: codes are generated on the server, and existing
// participants are matched by name + school so their codes stay the same
export const PEOPLE_COLS = ["이름", "학교", "팀 테이블"] as const;
const TEAM_SHEET = "팀";
const PEOPLE_SHEET = "참가자";

export type TeamRow = { table: string; name: string; project: string; desc: string };
export type PersonRow = { name: string; school: SchoolKey; table: string };

const personKey = (x: { name: string; school: string }) => `${x.name.trim()}|${x.school}`;

// School as written in the file: key, English or Korean name, any case
const SCHOOL_NAMES: Record<string, SchoolKey> = {
  ku: "ku",
  korea: "ku",
  "korea university": "ku",
  고려대: "ku",
  고려대학교: "ku",
  yu: "yu",
  yonsei: "yu",
  "yonsei university": "yu",
  연세대: "yu",
  연세대학교: "yu",
  skku: "skku",
  "sungkyunkwan university": "skku",
  성균관대: "skku",
  성균관대학교: "skku",
  kaist: "kaist",
  카이스트: "kaist",
};
const SCHOOL_LABEL: Record<SchoolKey, string> = { ku: "고려대", yu: "연세대", skku: "성균관대", kaist: "KAIST" };

/* ---------- Template ---------- */

function teamRows(teams: Team[]): string[][] {
  return teams.map((t) => [t.table, t.name, t.project, t.desc]);
}

function peopleRows(people: Participant[], teams: Team[]): string[][] {
  const tableOf = (id: string | null) => teams.find((t) => t.id === id)?.table ?? "";
  return people.map((p) => [p.name, SCHOOL_LABEL[p.school], tableOf(p.teamId)]);
}

export async function downloadXlsx(people: Participant[], teams: Team[]) {
  const sheet = (header: readonly string[], rows: string[][]) => [
    header.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...rows.map((r) => r.map((v) => ({ value: v, type: String }))),
  ];
  await writeXlsxFile([
    { sheet: TEAM_SHEET, data: sheet(TEAM_COLS, teamRows(teams)), columns: [{ width: 10 }, { width: 18 }, { width: 18 }, { width: 40 }] },
    {
      sheet: PEOPLE_SHEET,
      data: sheet(PEOPLE_COLS, peopleRows(people, teams)),
      columns: [{ width: 12 }, { width: 10 }, { width: 10 }],
    },
  ]).toFile("devfest-teams-participants.xlsx");
}

export function downloadCsv(kind: "teams" | "people", people: Participant[], teams: Team[]) {
  const csv =
    kind === "teams"
      ? Papa.unparse({ fields: [...TEAM_COLS], data: teamRows(teams) })
      : Papa.unparse({ fields: [...PEOPLE_COLS], data: peopleRows(people, teams) });
  // BOM so Excel opens the Korean text correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = kind === "teams" ? "devfest-teams.csv" : "devfest-participants.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Parsing ---------- */

type Table = string[][]; // header row first
const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

async function readTables(files: File[]): Promise<Table[]> {
  const out: Table[] = [];
  for (const f of files) {
    if (/\.xlsx$/i.test(f.name)) {
      const sheets = await readXlsxFile(f);
      for (const s of sheets) out.push(s.data.map((r) => r.map(cell)));
    } else if (/\.csv$/i.test(f.name)) {
      const text = (await f.text()).replace(/^﻿/, "");
      const r = Papa.parse<string[]>(text, { skipEmptyLines: true });
      out.push(r.data.map((row) => row.map(cell)));
    } else {
      throw new Error(`${f.name}: .xlsx 또는 .csv 파일만 올릴 수 있습니다.`);
    }
  }
  return out;
}

// Which template a table is, by its header row
function kindOf(t: Table): "teams" | "people" | null {
  const h = (t[0] ?? []).map((x) => x.replace(/\s+/g, ""));
  const has = (cols: readonly string[]) => cols.every((c) => h.includes(c.replace(/\s+/g, "")));
  if (has(PEOPLE_COLS)) return "people";
  if (has(TEAM_COLS)) return "teams";
  return null;
}

function rowsOf(t: Table, cols: readonly string[]) {
  const h = t[0].map((x) => x.replace(/\s+/g, ""));
  const idx = cols.map((c) => h.indexOf(c.replace(/\s+/g, "")));
  return t
    .slice(1)
    .map((r, i) => ({ line: i + 2, v: idx.map((k) => r[k] ?? "") }))
    .filter((r) => r.v.some(Boolean)); // skip blank rows
}

export type Parsed = {
  teams: TeamRow[] | null; // null = no team sheet/file uploaded (teams stay as they are)
  people: PersonRow[] | null;
  errors: string[];
};

export async function parseFiles(files: File[]): Promise<Parsed> {
  const tables = await readTables(files);
  const errors: string[] = [];
  let teams: TeamRow[] | null = null;
  let people: PersonRow[] | null = null;

  for (const t of tables) {
    const kind = kindOf(t);
    if (kind === "teams") {
      teams = rowsOf(t, TEAM_COLS).map(({ line, v: [table, name, project, desc] }) => {
        if (!table) errors.push(`팀 ${line}행: 테이블이 비어 있습니다.`);
        if (!name) errors.push(`팀 ${line}행: 팀명이 비어 있습니다.`);
        return { table, name, project, desc };
      });
    } else if (kind === "people") {
      people = rowsOf(t, PEOPLE_COLS).map(({ line, v: [name, schoolText, table] }) => {
        const school = SCHOOL_NAMES[schoolText.toLowerCase()];
        if (!name) errors.push(`참가자 ${line}행: 이름이 비어 있습니다.`);
        if (!school) errors.push(`참가자 ${line}행: 학교 "${schoolText}"을(를) 알 수 없습니다. (고려대·연세대·성균관대·KAIST)`);
        return { name, school: school ?? "ku", table };
      });
    }
  }
  if (!teams && !people) errors.push("팀 또는 참가자 양식을 찾지 못했습니다. 내려받은 양식의 머리글을 그대로 두세요.");

  const dup = <T>(list: T[], key: (x: T) => string) => {
    const seen = new Set<string>();
    return [...new Set(list.map(key).filter((k) => k && (seen.has(k) || !seen.add(k))))];
  };
  if (teams) for (const t of dup(teams, (x) => x.table)) errors.push(`팀 테이블 "${t}"이(가) 두 번 이상 나옵니다.`);
  if (people)
    for (const k of dup(people, personKey))
      errors.push(
        `참가자 "${k.split("|")[0]}"(${SCHOOL_LABEL[k.split("|")[1] as SchoolKey]})이(가) 두 번 이상 나옵니다. 같은 학교의 동명이인은 파일로 올릴 수 없으니, 한 명만 남기고 나머지는 참가자 탭에서 추가해 주세요. (이름을 바꾸면 그 이름으로 로그인해야 합니다.)`,
      );

  return { teams, people, errors };
}

/* ---------- Preview ---------- */

export type Plan = {
  teams: TeamRow[];
  people: PersonRow[];
  team: { added: TeamRow[]; updated: TeamRow[]; same: number; deleted: Team[] };
  person: { added: PersonRow[]; updated: PersonRow[]; same: number; deleted: Participant[] };
  errors: string[];
};

// Fill in what wasn't uploaded from the current data, compare with it, and check team references
export function plan(parsed: Parsed, people: Participant[], teams: Team[], deleteMissing: boolean): Plan {
  const tableOf = (id: string | null) => teams.find((t) => t.id === id)?.table ?? "";
  const fileTeams = parsed.teams ?? teams.map((t) => ({ table: t.table, name: t.name, project: t.project, desc: t.desc }));
  const filePeople = parsed.people ?? people.map((p) => ({ name: p.name, school: p.school, table: tableOf(p.teamId) }));
  const errors = [...parsed.errors];

  const team: Plan["team"] = { added: [], updated: [], same: 0, deleted: [] };
  for (const r of fileTeams) {
    const cur = teams.find((t) => t.table === r.table);
    if (!cur) team.added.push(r);
    else if (cur.name !== r.name || cur.project !== r.project || cur.desc !== r.desc) team.updated.push(r);
    else team.same++;
  }
  if (deleteMissing) team.deleted = teams.filter((t) => !fileTeams.some((r) => r.table === t.table));

  const known = new Set([...fileTeams.map((t) => t.table), ...(deleteMissing ? [] : teams.map((t) => t.table))]);
  const person: Plan["person"] = { added: [], updated: [], same: 0, deleted: [] };
  for (const r of filePeople) {
    if (r.table && !known.has(r.table)) errors.push(`참가자 "${r.name}"의 팀 테이블 "${r.table}"이(가) 팀 목록에 없습니다.`);
    const same = people.filter((p) => personKey(p) === personKey(r));
    if (same.length > 1)
      errors.push(
        `"${r.name}"(${SCHOOL_LABEL[r.school]}) 이름의 참가자가 이미 ${same.length}명 있어 누구인지 알 수 없습니다. 이 사람은 파일에서 빼고 참가자 탭에서 직접 수정해 주세요.`,
      );
    const cur = same.length === 1 ? same[0] : undefined;
    if (!cur) person.added.push(r);
    else if (tableOf(cur.teamId) !== r.table) person.updated.push(r);
    else person.same++;
  }
  if (deleteMissing) person.deleted = people.filter((p) => !filePeople.some((r) => personKey(r) === personKey(p)));

  return { teams: fileTeams, people: filePeople, team, person, errors };
}
