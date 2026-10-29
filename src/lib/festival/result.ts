// Result type for Server Actions, and Korean copy for database errors (RPCs set a code in HINT).

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type DbError = { message: string; hint?: string | null; code?: string | null };

const messages: Record<string, string> = {
  own_team: "내 팀 프로젝트에는 투자할 수 없습니다.",
  over_budget: "전체 투자금을 넘었습니다. 금액을 줄여 주세요.",
  step: "투자 단위에 맞지 않는 금액이 있습니다.",
  unknown_team: "없어진 팀이 있습니다. 새로고침 후 다시 시도해 주세요.",
  rate_limited: "잘못된 코드를 여러 번 입력했습니다. 10분 뒤에 다시 시도해 주세요.",
  not_participant: "등록된 참가자 계정이 아닙니다. 운영진에게 문의해 주세요.",
  staff_only: "운영진만 할 수 있습니다.",
  unchanged: "마지막 발행 이후 바뀐 투자가 없습니다.",
  invalid_code: "출석 코드는 숫자 4자리입니다.",
  too_many_assets: "업로드할 수 있는 개수를 넘었습니다.",
};

export function fail(error: DbError | null | undefined, fallback = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."): {
  ok: false;
  error: string;
} {
  if (error?.hint && messages[error.hint]) return { ok: false, error: messages[error.hint] };
  if (error?.code === "23505") return { ok: false, error: "이미 등록된 값입니다." };
  if (error?.code === "23514") return { ok: false, error: "입력값을 확인해 주세요." };
  if (error?.code === "42501") return { ok: false, error: "권한이 없습니다." };
  return { ok: false, error: fallback };
}

export const ok = <T,>(data: T): { ok: true; data: T } => ({ ok: true, data });
