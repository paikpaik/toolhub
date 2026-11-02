/**
 * 릴스 대본 점검: 줄마다 말하는 시간을 어림해 초 단위 구성표를 만들고, 편집에서 릴스를 망치는 것들을 짚는다.
 * 한국어는 단어 수가 아니라 음절 수로 말하는 시간을 어림한다.
 *
 * 시간은 어림값이다. 직접 소리 내 읽어 보고 초당 음절 수(기본 6.5)를 맞추면 더 정확해진다.
 * 훅 점검은 "약한 훅을 거르는" 용도다. 글자만으로는 괜찮은 훅 둘 중 어느 쪽이 잘될지 고를 수 없다 (얼굴·편집·음악·노출이 정한다).
 */

/** 릴스 내레이션은 아나운서(초당 5음절 안팎)보다 빠르다. 직접 읽어 보고 맞추는 게 가장 정확하다 */
export const DEFAULT_SYLLABLES_PER_SECOND = 6.5;
/** 이 시간을 넘기면 엄지가 이미 넘긴다 */
export const HOOK_SECONDS = 3;
/** 화면 변화 없이 한 내용에 머무는 최대 시간 */
export const MAX_BEAT_SECONDS = 4;
/** 숫자·구체적인 것 없는 줄이 이만큼 이어지면 지루해진다 */
const ABSTRACT_RUN = 3;

/**
 * 말할 때의 음절 수 어림. 한글은 글자 수, 숫자는 읽는 소리(47 → 사십칠)를 대략 0이 아닌 자릿수 × 1.5,
 * 영어 단어는 2음절, %는 "퍼센트" 3음절로 센다.
 */
export function spokenSyllables(text: string) {
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const numbers = (text.replace(/(?<=\d),(?=\d)/g, "").match(/\d+(?:\.\d+)?/g) ?? []).reduce(
    (sum, n) => sum + Math.max(1, Math.ceil(n.replace(/[0.]/g, "").length * 1.5)),
    0,
  );
  const latin = (text.match(/[A-Za-z]+/g) ?? []).length * 2;
  const percent = (text.match(/%/g) ?? []).length * 3;
  return hangul + numbers + latin + percent;
}

const KOREAN_COUNT = /(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s?(?:가지|번|개|명|살|시간|달|주|해|군데|장)/;
/** 숫자나 셀 수 있는 표현이 있으면 확인할 수 있는 구체적인 말로 본다 */
export const isConcrete = (line: string) => /\d/.test(line) || KOREAN_COUNT.test(line);

export interface Beat {
  text: string;
  start: number;
  seconds: number;
  role: "훅" | "본문" | "마무리";
}

export interface ReelCheck {
  ok: boolean;
  label: string;
  detail: string;
}

/** 한 줄이 한 장면. 너무 긴 줄은 문장 끝에서 나눈다 */
function splitBeats(script: string, sps: number) {
  const beats: string[] = [];
  for (const line of script.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (spokenSyllables(line) / sps <= MAX_BEAT_SECONDS * 1.5) {
      beats.push(line);
      continue;
    }
    let buffer = "";
    for (const sentence of line.split(/(?<=[.!?…])\s+/)) {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (buffer && spokenSyllables(candidate) / sps > MAX_BEAT_SECONDS) {
        beats.push(buffer);
        buffer = sentence;
      } else buffer = candidate;
    }
    if (buffer) beats.push(buffer);
  }
  return beats;
}

const PARTICLES = /(?:에서|으로|이에요|예요|이고|하고|까지|부터|은|는|이|가|을|를|에|로|도|만|의|와|과|요)$/;
const STOP_WORDS = new Set(["이거", "그거", "저거", "오늘", "정말", "진짜", "여러분", "우리", "지금", "그냥", "이렇게", "그래서", "근데"]);
/** 두 글자 이상 한글 낱말의 어간(조사를 대충 떼어 냄)과 단위 붙은 숫자(12월, 47만원). 되감기 판단용 */
const stems = (text: string) =>
  new Set([
    ...(text.match(/[가-힣]{2,}/g) ?? []).map((w) => w.replace(PARTICLES, "")).filter((w) => w.length >= 2 && !STOP_WORDS.has(w)),
    ...(text.replace(/(?<=\d),(?=\d)/g, "").match(/\d+[가-힣%]+/g) ?? []).map((w) => w.replace(PARTICLES, "")),
  ]);

export function beatSheet(script: string, { target, sps = DEFAULT_SYLLABLES_PER_SECOND }: { target?: number; sps?: number } = {}) {
  const lines = splitBeats(script, sps);
  let clock = 0;
  const beats: Beat[] = lines.map((text, i) => {
    const seconds = Math.round((spokenSyllables(text) / sps) * 10) / 10;
    const beat: Beat = { text, start: Math.round(clock * 10) / 10, seconds, role: i === 0 ? "훅" : i === lines.length - 1 ? "마무리" : "본문" };
    clock += seconds;
    return beat;
  });
  const total = Math.round(clock * 10) / 10;

  const checks: ReelCheck[] = [];
  if (!beats.length) return { beats, total, checks };

  const hook = beats[0]!;
  checks.push({
    ok: hook.seconds <= HOOK_SECONDS,
    label: "훅 길이",
    detail: hook.seconds <= HOOK_SECONDS ? `${hook.seconds}초, 3초 안에 끝나요` : `${hook.seconds}초. 3초를 넘기면 이미 넘깁니다. 줄이거나 두 줄로 나누세요`,
  });

  const long = beats.filter((b, i) => i > 0 && b.seconds > MAX_BEAT_SECONDS);
  checks.push({
    ok: long.length === 0,
    label: "장면 길이",
    detail: long.length
      ? `${long.map((b) => `${beats.indexOf(b) + 1}번째 줄 ${b.seconds}초`).join(", ")}. 4초를 넘는 장면은 나누거나 그 사이 화면을 바꾸세요`
      : "모든 장면이 4초 안쪽이에요",
  });

  let run = 0;
  let worst = 0;
  for (const b of beats) {
    run = isConcrete(b.text) ? 0 : run + 1;
    worst = Math.max(worst, run);
  }
  checks.push({
    ok: worst < ABSTRACT_RUN,
    label: "구체성",
    detail: worst < ABSTRACT_RUN ? "숫자·구체적인 말이 고르게 들어 있어요" : `숫자나 구체적인 말 없는 줄이 ${worst}개 이어져요. 금액·기간·개수를 넣으세요`,
  });

  const hookStems = stems(hook.text);
  const loopWord = beats.length > 1 ? [...stems(beats.at(-1)!.text)].find((w) => [...hookStems].some((h) => h.includes(w) || w.includes(h))) : undefined;
  checks.push({
    ok: !!loopWord,
    label: "되감기(루프)",
    detail: loopWord ? `마지막 줄이 훅의 "${loopWord}"를 다시 말해서 다시 보기로 자연스럽게 이어져요` : "마지막 줄에 훅의 낱말을 하나 다시 넣으면 다시 보기가 자연스럽게 이어져요 (다시 보기도 도달에 잡힘)",
  });

  if (target) {
    const diff = Math.round((total - target) * 10) / 10;
    checks.push({
      ok: Math.abs(diff) <= target * 0.15,
      label: "목표 길이",
      detail:
        Math.abs(diff) <= target * 0.15
          ? `${total}초, 목표 ${target}초에 맞아요`
          : diff > 0
            ? `${diff}초 길어요. 장면 하나를 빼는 게 보통 맞습니다`
            : `${-diff}초 짧아요. 짧게 찍는 게 대개 낫습니다`,
    });
  }
  return { beats, total, checks };
}

/** 첫마디로 쓰면 바로 넘겨지는 시작 */
const WEAK_OPENERS: [RegExp, string][] = [
  [/^(?:안녕하세요|여러분\s*안녕|안녕\s*여러분)/, "인사로 시작해요. 인사를 들으러 온 사람은 없습니다"],
  [/^(?:오늘은|이번\s*영상|이번\s*시간|오늘\s*영상)/, "'오늘은/이번 영상' 같은 서론이에요. 본론부터 말하세요"],
  [/(?:스크롤\s*멈|잠깐만요|주목|끝까지\s*봐)/, "주목해 달라고 부탁해요. 부탁한다는 건 아직 관심을 못 얻었다는 뜻입니다"],
  [/(?:구독|팔로우|좋아요)\s*(?:하고|눌러|부탁)/, "시작부터 팔로우를 부탁해요. 요청은 마지막에 한 번"],
];

/** 훅 한 줄 점검. 약한 훅을 거르는 용도 (좋은 훅 둘 중 하나를 고르지는 못한다) */
export function checkHook(line: string, sps = DEFAULT_SYLLABLES_PER_SECOND) {
  const text = line.trim();
  const seconds = Math.round((spokenSyllables(text) / sps) * 10) / 10;
  const weak = WEAK_OPENERS.find(([pattern]) => pattern.test(text));
  const checks: ReelCheck[] = [
    { ok: !weak, label: "시작", detail: weak ? weak[1] : "본론으로 바로 시작해요" },
    { ok: seconds <= HOOK_SECONDS, label: "길이", detail: `말하면 약 ${seconds}초${seconds > HOOK_SECONDS ? ". 3초 안으로 줄이세요" : ""}` },
    { ok: isConcrete(text), label: "구체성", detail: isConcrete(text) ? "숫자·구체적인 말이 있어요" : "숫자가 없어요. 금액·기간·개수를 넣으면 훨씬 세집니다" },
    {
      ok: /(?:분들|라면|이시면|하시는|당신|님)/.test(text) || /[?？]/.test(text) || /(?:마세요|하세요|세요)[.!]?$/.test(text),
      label: "보는 사람",
      detail: "보는 사람을 부르거나(~라면, ~분들), 묻거나, 말을 건네면(~하세요) 내 얘기로 받아들입니다",
    },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const verdict = weak ? "약함" : passed >= 3 ? "좋음" : passed === 2 ? "보통" : "약함";
  return { text, seconds, checks, verdict } as const;
}

const pad = (n: number) => n.toFixed(1).padStart(4, " ");
const timecode = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/** MCP용 텍스트 */
export function formatBeatSheet(result: ReturnType<typeof beatSheet>, target?: number) {
  const lines = [
    `구성표 · ${result.beats.length}장면 · 약 ${result.total}초${target ? ` · 목표 ${target}초` : ""}`,
    "",
    ...result.beats.map((b) => `${timecode(b.start)}  ${pad(b.seconds)}초  ${b.role === "본문" ? "    " : b.role}  ${b.text}`),
    "",
    ...result.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label}: ${c.detail}`),
  ];
  return lines.join("\n");
}
