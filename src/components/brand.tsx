export type School = {
  key: string;
  name: string;
  word: string;
  main: string;
  // Text color that reads on `main`
  on: string;
};

// The four schools in the event's order. Only each school's main color is used.
export const schools: School[] = [
  { key: "ku", name: "Korea University", word: "KOREA", main: "var(--ku-main)", on: "var(--white)" },
  { key: "yu", name: "Yonsei University", word: "YONSEI", main: "var(--yu-main)", on: "var(--white)" },
  { key: "skku", name: "Sungkyunkwan University", word: "SKKU", main: "var(--skku-main)", on: "var(--black)" },
  { key: "kaist", name: "KAIST", word: "KAIST", main: "var(--kaist-main)", on: "var(--black)" },
];

// GDG logo (from gdg.svg). Uses currentColor so it follows the theme.
export function GdgLogo({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 60 29"
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g transform="matrix(0.786084 0 0 0.786085 -1429.936697 -780.717217)">
        <path d="M1862.369,996.148C1864.012,993.304 1867.655,992.327 1870.5,993.97L1892.024,1006.397C1894.869,1008.039 1895.845,1011.682 1894.202,1014.527C1892.56,1017.372 1888.917,1018.348 1886.072,1016.706L1864.548,1004.279C1861.703,1002.637 1860.727,998.993 1862.369,996.148Z" />
        <path d="M1826.767,1003.667L1843.563,993.97C1846.407,992.327 1850.051,993.304 1851.693,996.148C1853.336,998.993 1852.359,1002.637 1849.515,1004.279L1839.013,1010.342L1828.925,1004.517C1828.234,1004.118 1827.507,1003.837 1826.767,1003.667Z" />
        <path d="M1851.693,1026.693C1850.051,1029.538 1846.407,1030.514 1843.563,1028.871L1822.039,1016.445C1819.194,1014.802 1818.218,1011.159 1819.86,1008.314C1821.503,1005.469 1825.146,1004.493 1827.991,1006.135L1849.515,1018.562C1852.359,1020.205 1853.336,1023.848 1851.693,1026.693Z" />
        <path d="M1887.295,1019.175L1870.5,1028.871C1867.655,1030.514 1864.012,1029.538 1862.369,1026.693C1860.727,1023.848 1861.703,1020.205 1864.548,1018.562L1875.049,1012.499L1885.138,1018.324C1885.829,1018.723 1886.556,1019.005 1887.295,1019.175Z" />
      </g>
    </svg>
  );
}

// A thin strip of the four school colors, e.g. along the bottom of a screen.
export function SchoolBar({ className = "", vertical = false }: { className?: string; vertical?: boolean }) {
  return (
    <div className={`flex ${vertical ? "flex-col" : "flex-row"} ${className}`} aria-hidden="true">
      {schools.map((s) => (
        <span key={s.key} className="flex-1" style={{ background: s.main }} />
      ))}
    </div>
  );
}

// Home hero frame: bars in the four school colors come in from the left and right
// edges (four rows a side, mirrored) and frame the centered headline. They slide in
// one after another on load (.edge-bar in globals.css). Hidden on phones, where they
// would cover the text; nothing is written on the colors.
const EDGE_LEFT = [6, 3, 9, 4.5]; // vw, top to bottom
const EDGE_RIGHT = [4.5, 9, 3, 6];

export function EdgeFrame() {
  const side = (left: boolean) => {
    const widths = left ? EDGE_LEFT : EDGE_RIGHT;
    const order = left ? schools : [...schools].reverse();
    return (
      <div className={`absolute inset-y-0 flex flex-col ${left ? "left-0" : "right-0 items-end"}`}>
        {order.map((s, i) => (
          <span
            key={s.key}
            className="edge-bar flex-1"
            style={
              {
                width: `${widths[i]}vw`,
                background: s.main,
                "--i": i + (left ? 0 : 0.5),
                "--dir": left ? -1 : 1,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    );
  };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
      {side(true)}
      {side(false)}
    </div>
  );
}

// 2×2 mark of the four school colors, used in the content-wise header bar.
export function SchoolMark({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 grid-rows-2 ${className}`} aria-hidden="true">
      {schools.map((s) => (
        <span key={s.key} style={{ background: s.main }} />
      ))}
    </div>
  );
}
