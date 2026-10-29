// Guide page content, from the organizer meetings (latest decision: 10/23).
// Items still marked "추후 공지" are not decided yet.

export const event = {
  series: "GDG DevFest 2026",
  theme: "Tell the Vision.",
  title: "GDG Demo Day — 개발자와 투자자 사이",
  concept:
    "Google 기술로 현실의 문제를 해결하는 프로젝트를 만들고, 참가자 모두가 개발자이자 투자자가 되어 서로의 프로젝트에 모의 투자합니다.",
  date: "2026. 11. 06 (금)",
  hours: "16:30 – 21:15",
  checkIn: "16:30부터",
  venue: "Google for Startups Campus",
  registerUrl: "#",
};

export type Notice = { date: string; title: string; tag?: string };

export const notices: Notice[] = [
  { date: "10.27", title: "팀 매칭 진행 중 · 결과는 10/30 온라인 OT에서 발표", tag: "NEW" },
  { date: "10.30", title: "온라인 OT 19:00 – 20:00 · 팀별 디스코드 채널 오픈" },
  { date: "11.06", title: "오프라인 Demo Day · Google for Startups Campus" },
];

// Road to Demo Day: sign-up → matching → online OT → one week of building → Demo Day
export type Step = { date: string; title: string; desc: string };

export const steps: Step[] = [
  { date: "~10.28", title: "참가 신청", desc: "희망 키워드 1~3지망을 골라 신청합니다. 수요일에 1차 취합해 키워드별 수요를 조정합니다." },
  { date: "10.27–29", title: "팀 매칭", desc: "지망 키워드를 바탕으로 팀당 5~6명, 여러 학교가 섞이도록 팀을 구성합니다." },
  { date: "10.30 (금)", title: "온라인 OT · 팀 발표", desc: "행사 소개와 진행 안내, 연사 세션, 팀별 아이스브레이킹. 이후 디스코드에서 소통합니다." },
  { date: "10.31–11.05", title: "팀별 개발 1주", desc: "2일 차 기획서·BM → 4일 차 데모·프로토타입 → 6일 차 발표자료. 팀 첫 회의는 Google Meet으로 진행합니다." },
  { date: "11.06 (금)", title: "오프라인 Demo Day", desc: "Google for Startups Campus에서 Demo Market, 팀별 발표, 모의 투자, 시상을 진행합니다." },
];

export type Day = { id: string; label: string; date: string; where: string };

export const days: Day[] = [
  { id: "ot", label: "온라인 OT", date: "10. 30 (금)", where: "온라인" },
  { id: "demo", label: "Demo Day", date: "11. 06 (금)", where: "Google for Startups Campus" },
];

export type ScheduleItem = {
  day: string; // Day.id
  time: string;
  end: string;
  title: string;
  desc?: string;
};

export const schedule: ScheduleItem[] = [
  {
    day: "ot",
    time: "19:00",
    end: "20:00",
    title: "온라인 OT",
    desc: "GDG 및 행사 소개 → 프로젝트 진행 안내 → 연사 세션 → 팀별 아이스브레이킹(팀당 약 5분)",
  },
  { day: "demo", time: "16:30", end: "17:30", title: "개회 · 체크인 · Demo Market", desc: "도착하면 체크인 후 팀별 데모를 둘러봅니다." },
  { day: "demo", time: "17:30", end: "18:00", title: "저녁 식사" },
  { day: "demo", time: "18:00", end: "20:30", title: "팀별 발표 · 질의응답", desc: "팀당 발표 8분, 질의응답 4분" },
  { day: "demo", time: "20:30", end: "21:15", title: "투표 마감 · 시상 · 단체 사진" },
];

// Teams form around broad keywords (no fixed tracks). Keywords may be merged or dropped by demand.
export const keywords = ["교통", "주거", "일자리", "교육", "소통", "매체", "예술", "환경", "건강", "경제", "사회복지", "국제", "안전"];

export const investRules = [
  "참가자 모두에게 가상 투자금이 지급되고, 마음에 드는 프로젝트에 나눠 투자합니다.",
  "참가자 투자(개미)와 심사위원 투자(큰손)를 합쳐 결과를 정합니다.",
  "본인 팀 프로젝트에는 투자할 수 없습니다.",
  "투자 한도와 현황 공개 방식은 추후 안내됩니다.",
];

export const criteria = [
  { name: "현실성", desc: "실제 문제를 풀 수 있는가" },
  { name: "차별성", desc: "기존 서비스와 무엇이 다른가" },
  { name: "기술력", desc: "구현 완성도와 Google 기술 활용" },
  { name: "설득력", desc: "발표와 비즈니스 모델이 납득되는가" },
  { name: "미래 지향성", desc: "확장 가능성" },
];

export const awards = ["대상", "최우수상", "우수상", "장려상", "인기상"];

export type Faq = { q: string; a: string };

export const faqs: Faq[] = [
  {
    q: "어떤 행사인가요?",
    a: "일주일 동안 팀별로 Google 기술을 활용한 프로젝트를 만들고, 11월 6일 Demo Day에서 발표합니다. 참가자 모두가 가상 투자금으로 다른 팀 프로젝트에 투자합니다.",
  },
  {
    q: "팀은 어떻게 정해지나요?",
    a: "신청할 때 고른 키워드 1~3지망을 바탕으로 운영진이 팀당 5~6명으로 구성합니다. 여러 학교가 함께하도록 섞어서 배정하며, 결과는 10/30 온라인 OT에서 발표합니다.",
  },
  {
    q: "꼭 Google 기술을 써야 하나요?",
    a: "기술 스택에 제한은 없습니다. 다만 Google 기술을 활용하면 심사에서 가산점이 있습니다.",
  },
  { q: "팀 소통은 어디서 하나요?", a: "10/30 OT 이후 팀별 디스코드 채널을 열어 드립니다. 팀 첫 회의는 Google Meet으로 진행합니다." },
  { q: "Demo Day에 식사가 제공되나요?", a: "17:30에 저녁 식사가 제공됩니다." },
  { q: "참가비가 있나요?", a: "참가비 정책은 신청 페이지에서 안내됩니다." },
  { q: "시상 내역은요?", a: "대상·최우수상·우수상·장려상·인기상(개미 투자를 가장 많이 받은 팀)을 계획하고 있으며, 상세 내역은 추후 공지됩니다." },
];

export const venueInfo = [
  { label: "장소", value: "Google for Startups Campus" },
  { label: "주소", value: "상세 주소는 추후 공지됩니다" },
  { label: "운영 시간", value: "16:30 – 21:15 · 22:00 이전 퇴실" },
  { label: "소통", value: "팀별 디스코드 채널 (10/30 오픈)" },
  { label: "문의", value: "GDG on Campus 운영진" },
];

// Types for the festival screens (/onfestival, /organize). The data itself is in
// Supabase; supabase/seed.sql has the sample teams and participants.

export type SchoolKey = "ku" | "yu" | "skku" | "kaist";

// Teams can mix schools, so school is tracked per participant.
export type Participant = {
  id: string;
  name: string;
  school: SchoolKey;
  teamId: string | null; // assigned by staff
  checkedIn: boolean; // checked in today (staff see everyone's, a participant only their own)
  accessCode?: string; // personal login code; only loaded for staff
  budget?: number | null; // staff-set investment budget; null = default. Staff see everyone's, a participant only their own
};

export type Team = {
  id: string;
  name: string;
  table: string;
  project: string;
  desc: string;
};

