// Guide page content. Sample values — replace with confirmed details.

export type Track = "공통" | "AI" | "Web" | "Mobile" | "Cloud";

export const tracks: Track[] = ["공통", "AI", "Web", "Mobile", "Cloud"];

export const trackColor: Record<Track, string> = {
  공통: "var(--fg)",
  AI: "var(--g-red)",
  Web: "var(--g-blue)",
  Mobile: "var(--g-green)",
  Cloud: "var(--g-yellow)",
};

export const event = {
  series: "GDG DevFest 2026",
  theme: "Tell the Vision.",
  date: "2026. 11. 06 (금)",
  hours: "10:00 – 18:00",
  checkIn: "09:30부터",
  venue: "Gangnam Google Campus",
  registerUrl: "#",
};

export type Notice = { date: string; title: string; tag?: string };

export const notices: Notice[] = [
  { date: "10.28", title: "세션 라인업 1차 공개", tag: "NEW" },
  { date: "10.20", title: "참가 신청 오픈 안내" },
  { date: "10.14", title: "스태프 · 자원봉사자 모집 마감" },
];

export type ScheduleItem = {
  time: string;
  end: string;
  title: string;
  track: Track;
  room: string;
  speaker?: string;
  desc?: string;
};

export const schedule: ScheduleItem[] = [
  { time: "09:30", end: "10:00", title: "체크인 & 웰컴 굿즈 수령", track: "공통", room: "로비" },
  { time: "10:00", end: "10:40", title: "Keynote — Tell the Vision", track: "공통", room: "Hall A", speaker: "TBA" },
  { time: "11:00", end: "11:40", title: "Gemini로 만드는 멀티모달 앱", track: "AI", room: "Hall A", speaker: "TBA", desc: "Gemini API로 이미지·텍스트를 함께 다루는 앱을 만듭니다." },
  { time: "11:00", end: "11:40", title: "Modern Web Platform 2026", track: "Web", room: "Room B", speaker: "TBA", desc: "최신 브라우저 기능과 웹 성능 개선 사례." },
  { time: "11:50", end: "12:30", title: "Compose Multiplatform 실전", track: "Mobile", room: "Room C", speaker: "TBA", desc: "하나의 코드로 Android와 iOS를 함께 운영하기." },
  { time: "11:50", end: "12:30", title: "Cloud Run으로 시작하는 서버리스", track: "Cloud", room: "Room B", speaker: "TBA", desc: "배포부터 모니터링까지 한 번에." },
  { time: "12:30", end: "13:30", title: "점심 & 네트워킹", track: "공통", room: "라운지" },
  { time: "13:30", end: "14:10", title: "온디바이스 AI와 Gemma", track: "AI", room: "Hall A", speaker: "TBA", desc: "작은 모델을 기기에서 직접 돌리는 방법." },
  { time: "13:30", end: "14:10", title: "Flutter로 디자인 시스템 만들기", track: "Mobile", room: "Room C", speaker: "TBA", desc: "토큰부터 컴포넌트까지." },
  { time: "14:30", end: "16:30", title: "핸즈온 코드랩", track: "Web", room: "Room B", speaker: "GDG 운영진", desc: "노트북을 지참해 주세요." },
  { time: "14:30", end: "16:30", title: "Firebase Genkit 코드랩", track: "Cloud", room: "Room C", speaker: "GDG 운영진", desc: "AI 기능을 서비스에 붙이는 실습." },
  { time: "17:00", end: "18:00", title: "클로징 · 경품 추첨 · 단체 사진", track: "공통", room: "Hall A" },
];

export type Faq = { q: string; a: string };

export const faqs: Faq[] = [
  { q: "참가비가 있나요?", a: "참가비 정책은 신청 페이지에서 안내됩니다." },
  { q: "체크인은 어떻게 하나요?", a: "신청 완료 메일의 QR 코드를 로비 체크인 데스크에 보여주세요. 09:30부터 가능합니다." },
  { q: "노트북이 필요한가요?", a: "코드랩 세션에 참여하신다면 노트북과 충전기를 지참해 주세요." },
  { q: "세션 자료는 공유되나요?", a: "발표자 동의 후 행사 종료 뒤 공지사항으로 공유됩니다." },
  { q: "주차가 가능한가요?", a: "주차 지원은 제공되지 않습니다. 대중교통 이용을 권장합니다." },
];

export const venueInfo = [
  { label: "장소", value: "Gangnam Google Campus" },
  { label: "주소", value: "상세 주소는 추후 공지됩니다" },
  { label: "지하철", value: "가까운 역과 출구는 추후 공지됩니다" },
  { label: "주차", value: "주차 지원 없음 · 대중교통 권장" },
  { label: "문의", value: "GDG on Campus 운영진" },
];

// Live (대회중) screen mock data — replace with real team data.

export type SchoolKey = "ku" | "yu" | "skku" | "kaist";

// Teams can mix schools, so school is tracked per member.
export type Member = { name: string; school: SchoolKey };

export type Team = {
  id: string;
  name: string;
  table: string;
  project: string;
  desc: string;
  members: Member[];
  checkedIn: boolean;
};

const m = (name: string, school: SchoolKey): Member => ({ name, school });

export const teams: Team[] = [
  { id: "t01", name: "Vision Makers", table: "A-01", project: "SightLine", desc: "시각장애인을 위한 Gemini 기반 길 안내 앱", members: [m("김민준", "ku"), m("이서연", "yu"), m("박도윤", "kaist"), m("최하은", "ku")], checkedIn: true },
  { id: "t02", name: "Blue Byte", table: "A-02", project: "StudyMate", desc: "강의 녹음을 요약해 주는 학습 도우미", members: [m("정지호", "yu"), m("강수아", "yu"), m("윤시우", "yu")], checkedIn: true },
  { id: "t03", name: "Green Light", table: "A-03", project: "EcoRoute", desc: "탄소 배출이 가장 적은 경로 추천", members: [m("조예준", "skku"), m("한지민", "ku"), m("오서준", "kaist"), m("신유나", "skku")], checkedIn: false },
  { id: "t04", name: "Sky Lab", table: "B-01", project: "LabNote", desc: "실험 노트를 자동으로 정리하는 AI", members: [m("임건우", "kaist"), m("서하린", "kaist"), m("황준서", "skku")], checkedIn: true },
  { id: "t05", name: "Crimson Code", table: "B-02", project: "CampusEats", desc: "학식 메뉴와 혼잡도를 한눈에", members: [m("송지안", "ku"), m("문채원", "ku"), m("배현우", "ku")], checkedIn: false },
  { id: "t06", name: "Eagle Eye", table: "B-03", project: "SafeWalk", desc: "야간 귀갓길 안심 동행 서비스", members: [m("권도현", "yu"), m("유소율", "skku"), m("장민서", "ku"), m("노은우", "kaist")], checkedIn: true },
  { id: "t07", name: "Sprout", table: "C-01", project: "PlantPal", desc: "사진 한 장으로 식물 상태 진단", members: [m("홍예린", "skku"), m("전시윤", "skku"), m("고태윤", "yu")], checkedIn: true },
  { id: "t08", name: "Orbit", table: "C-02", project: "SpaceQuiz", desc: "우주 과학 퀴즈로 배우는 물리", members: [m("남지우", "kaist"), m("심하준", "ku"), m("류다인", "kaist")], checkedIn: false },
];

export const myTeamId = "t03";

// Mock attendance code shown to staff at the venue.
export const ATTENDANCE_CODE = "1106";

// Mock investment rules: each participant splits a virtual budget across other teams' projects.
export const INVEST_BUDGET = 1_000_000;
export const INVEST_STEP = 50_000;
