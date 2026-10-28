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
