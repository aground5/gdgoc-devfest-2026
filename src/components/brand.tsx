export type School = {
  key: string;
  name: string;
  word: string;
  dark: string;
  light: string;
  // Vertical positions (%) of each letter in the stripe
  letters: number[];
};

// Darker tone sits on the left of each pair, as in the banner.
export const schools: School[] = [
  { key: "ku", name: "Korea University", word: "KOREA", dark: "var(--ku-main)", light: "var(--ku-tint)", letters: [4, 22, 40, 58, 76] },
  { key: "yu", name: "Yonsei University", word: "YONSEI", dark: "var(--yu-main)", light: "var(--yu-tint)", letters: [10, 25, 40, 55, 70, 85] },
  { key: "skku", name: "Sungkyunkwan University", word: "SKKU", dark: "var(--skku-tint)", light: "var(--skku-main)", letters: [18, 38, 58, 78] },
  { key: "kaist", name: "KAIST", word: "KAIST", dark: "var(--kaist-tint)", light: "var(--kaist-main)", letters: [6, 24, 42, 60, 78] },
];

const googleColors = ["var(--g-red)", "var(--g-yellow)", "var(--g-blue)", "var(--g-green)"];

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

export function GoogleBar({ className = "", horizontal = false }: { className?: string; horizontal?: boolean }) {
  return (
    <div className={`flex ${horizontal ? "flex-row" : "flex-col"} ${className}`} aria-hidden="true">
      {googleColors.map((c) => (
        <span key={c} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  );
}

export function LetterStripes() {
  return (
    <div className="grid h-full grid-cols-8" aria-hidden="true">
      {schools.map((s) => (
        <div key={s.key} className="col-span-2 grid grid-cols-2">
          <div style={{ background: s.dark }} />
          <div className="relative" style={{ background: s.light }}>
            {s.word.split("").map((ch, i) => (
              <span
                key={i}
                className="absolute left-[0.15em] text-[clamp(0.7rem,1.3vw,1.15rem)] font-medium leading-none"
                style={{ top: `${s.letters[i]}%`, color: s.dark }}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Banner variant with folds and sawtooth notches.
export function FoldStripes({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-8 ${className}`} aria-hidden="true">
      {schools.map((s, si) => (
        <div key={s.key} className="col-span-2 grid grid-cols-2">
          <div className="relative" style={{ background: s.dark }}>
            {si === 1 && <div className="teeth absolute right-0 top-1/4 h-1/2 w-1/2" style={{ background: "var(--yu-tint)" }} />}
          </div>
          <div className="relative overflow-hidden" style={{ background: s.light }}>
            {si % 2 === 0 ? (
              <div className="fold absolute bottom-0 left-0 h-1/3 w-full" style={{ background: s.dark }} />
            ) : (
              <div className="fold absolute left-0 top-0 h-1/3 w-full rotate-180" style={{ background: s.dark }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
