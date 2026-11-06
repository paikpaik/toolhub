/**
 * 썸네일 랜덤 색 조합 (배경·글자·강조). 누를 때마다 새로 뽑고, 마음에 들면 그대로 쓴다.
 * 아무 색이나 섞으면 글자가 안 읽혀서, 색상환에서 어울리는 관계(보색·분할 보색·삼각·유사색)로 강조색을 고르고
 * 대비(WCAG)를 재서 글자는 배경과 7:1, 강조는 3:1 이상만 쓴다
 */

export interface RandomColors {
  bg: string;
  text: string;
  accent: string;
}

/** 배경 분위기: 밝은 파스텔, 어두운 색, 선명한 색 */
const MOODS = [
  { s: [25, 60], l: [90, 97] },
  { s: [25, 55], l: [10, 22] },
  { s: [55, 85], l: [40, 55] },
] as const;

/** 배경 색상에서 강조색까지의 색상 각도 (보색 180, 분할 보색 150·210, 삼각 120·240, 유사색 30·330) */
const ACCENT_SHIFTS = [180, 150, 210, 120, 240, 30, 330];

const MIN_TEXT_CONTRAST = 7;
const MIN_ACCENT_CONTRAST = 3;

const between = (random: () => number, [min, max]: readonly [number, number]) => min + random() * (max - min);

export function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[channel(0), channel(8), channel(4)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 대비 (1~21) */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** 한 번 뽑기. 대비가 모자라면 null */
function attempt(random: () => number): RandomColors | null {
  const hue = random() * 360;
  const mood = MOODS[Math.floor(random() * MOODS.length)]!;
  const bg = hslToHex(hue, between(random, mood.s), between(random, mood.l));
  const darkBg = luminance(bg) < 0.18;
  // 글자는 배경 색을 살짝 머금은 거의 흰색·검은색
  const text = hslToHex(hue, between(random, [10, 30]), darkBg ? between(random, [95, 99]) : between(random, [6, 14]));
  const accentHue = (hue + ACCENT_SHIFTS[Math.floor(random() * ACCENT_SHIFTS.length)]!) % 360;
  const accent = hslToHex(accentHue, between(random, [70, 95]), darkBg ? between(random, [60, 75]) : between(random, [30, 45]));
  return contrast(text, bg) >= MIN_TEXT_CONTRAST && contrast(accent, bg) >= MIN_ACCENT_CONTRAST ? { bg, text, accent } : null;
}

/** 읽히는 조합이 나올 때까지 뽑는다 (거의 몇 번 안에 나온다. 끝내 안 나오면 기본 조합) */
export function randomColors(random: () => number = Math.random): RandomColors {
  for (let i = 0; i < 50; i++) {
    const colors = attempt(random);
    if (colors) return colors;
  }
  return { bg: "#1e2a44", text: "#ffffff", accent: "#ffd166" };
}
