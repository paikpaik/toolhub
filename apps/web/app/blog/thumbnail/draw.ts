/** 썸네일 캔버스 그리기 (브라우저 전용, 순수 함수) */

export const TEMPLATES = [
  { id: "center", name: "중앙 정렬" },
  { id: "left", name: "좌측 정렬 + 라벨" },
  { id: "bar", name: "강조 바" },
  { id: "frame", name: "프레임" },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const SIZES = [
  { id: "1200x630", width: 1200, height: 630, name: "1200×630 가로형 (티스토리·Blogger 공유용)" },
  { id: "1080x1080", width: 1080, height: 1080, name: "1080×1080 정사각 (네이버·스레드)" },
  { id: "1280x720", width: 1280, height: 720, name: "1280×720 16:9" },
] as const;

export type SizeId = (typeof SIZES)[number]["id"];

export interface Colors {
  bg: string;
  text: string;
  accent: string;
}

export const COLOR_PRESETS: { id: string; name: string; colors: Colors }[] = [
  { id: "navy", name: "네이비", colors: { bg: "#1e2a44", text: "#ffffff", accent: "#ffd166" } },
  { id: "white", name: "화이트", colors: { bg: "#ffffff", text: "#1a1a1e", accent: "#2f6fed" } },
  { id: "yellow", name: "옐로", colors: { bg: "#ffd84d", text: "#1a1a1e", accent: "#c9302c" } },
  { id: "green", name: "그린", colors: { bg: "#e8f5e9", text: "#1b4332", accent: "#2d8a57" } },
  { id: "coral", name: "코랄", colors: { bg: "#ff6b6b", text: "#ffffff", accent: "#fff3b0" } },
  { id: "black", name: "블랙", colors: { bg: "#111111", text: "#ffffff", accent: "#4cd38a" } },
];

export interface ThumbnailSpec {
  width: number;
  height: number;
  template: TemplateId;
  colors: Colors;
  family: string;
  titleWeight: number;
  bodyWeight: number;
  /** *단어* 로 감싼 부분은 강조색. 줄바꿈(\n)은 그대로 줄을 나눈다 */
  title: string;
  subtitle: string;
  label: string;
  blogName: string;
}

interface Run {
  text: string;
  accent: boolean;
}

/** "*강조*" 구문을 강조 여부가 붙은 조각들로 나눈다 */
export function parseHighlight(text: string): Run[] {
  return text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((part) => (/^\*[^*]+\*$/.test(part) ? { text: part.slice(1, -1), accent: true } : { text: part, accent: false }));
}

const runsWidth = (ctx: CanvasRenderingContext2D, runs: Run[]) => runs.reduce((w, r) => w + ctx.measureText(r.text).width, 0);

/** 조각들을 공백 기준 단어로 나눈다 (단어 안에서 강조가 바뀔 수 있어 단어도 조각 배열) */
function toWords(runs: Run[]): Run[][] {
  const words: Run[][] = [[]];
  for (const run of runs) {
    run.text.split(/(\s+)/).forEach((piece) => {
      if (/^\s+$/.test(piece)) words.push([]);
      else if (piece) words.at(-1)!.push({ text: piece, accent: run.accent });
    });
  }
  return words.filter((w) => w.length > 0);
}

/** 너비에 맞춰 줄바꿈. 한 단어가 너비보다 길면 글자 단위로 끊는다 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): Run[][] {
  const lines: Run[][] = [];
  const space = ctx.measureText(" ").width;

  for (const paragraph of text.split("\n")) {
    let line: Run[] = [];
    let lineWidth = 0;
    const push = () => {
      if (line.length) lines.push(line);
      line = [];
      lineWidth = 0;
    };

    for (const word of toWords(parseHighlight(paragraph))) {
      const wordWidth = runsWidth(ctx, word);
      if (wordWidth > maxWidth) {
        // 긴 단어는 글자 단위로
        push();
        for (const run of word) {
          for (const char of run.text) {
            const w = ctx.measureText(char).width;
            if (lineWidth + w > maxWidth) push();
            line.push({ text: char, accent: run.accent });
            lineWidth += w;
          }
        }
        continue;
      }
      const needed = line.length ? space + wordWidth : wordWidth;
      if (lineWidth + needed > maxWidth) push();
      if (line.length) line.push({ text: " ", accent: false });
      line.push(...word);
      lineWidth += line.length > word.length ? space + wordWidth : wordWidth;
    }
    push();
  }
  return lines;
}

/** 줄 수와 높이 제한 안에 들어갈 때까지 글자 크기를 줄인다 */
function fitTitle(ctx: CanvasRenderingContext2D, spec: ThumbnailSpec, maxWidth: number, maxHeight: number, maxLines: number) {
  const start = Math.round(spec.width * (spec.width === spec.height ? 0.1 : 0.085));
  const min = Math.round(spec.width * 0.035);
  for (let size = start; ; size = Math.round(size * 0.94)) {
    ctx.font = `${spec.titleWeight} ${size}px ${spec.family}`;
    const lines = wrap(ctx, spec.title, maxWidth);
    const lineHeight = size * 1.25;
    if ((lines.length <= maxLines && lines.length * lineHeight <= maxHeight) || size <= min) {
      return { size, lines, lineHeight, height: lines.length * lineHeight };
    }
  }
}

function drawLine(ctx: CanvasRenderingContext2D, line: Run[], x: number, y: number, colors: Colors, align: "left" | "center") {
  const width = runsWidth(ctx, line);
  let cursor = align === "center" ? x - width / 2 : x;
  ctx.textAlign = "left";
  for (const run of line) {
    ctx.fillStyle = run.accent ? colors.accent : colors.text;
    ctx.fillText(run.text, cursor, y);
    cursor += ctx.measureText(run.text).width;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 강조색 바탕의 라벨 (예: "정보", "리뷰") */
function drawLabel(ctx: CanvasRenderingContext2D, spec: ThumbnailSpec, x: number, y: number, align: "left" | "center") {
  const size = Math.round(spec.width * 0.026);
  ctx.font = `${spec.bodyWeight} ${size}px ${spec.family}`;
  const padX = size * 0.8;
  const w = ctx.measureText(spec.label).width + padX * 2;
  const h = size * 1.8;
  const left = align === "center" ? x - w / 2 : x;
  ctx.fillStyle = spec.colors.accent;
  roundRect(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = spec.colors.bg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(spec.label, left + padX, y + h / 2);
  return h;
}

function drawSmall(ctx: CanvasRenderingContext2D, spec: ThumbnailSpec, text: string, x: number, y: number, align: CanvasTextAlign, scale: number, opacity = 1) {
  ctx.font = `${spec.bodyWeight} ${Math.round(spec.width * scale)}px ${spec.family}`;
  ctx.fillStyle = spec.colors.text;
  ctx.globalAlpha = opacity;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

export function drawThumbnail(ctx: CanvasRenderingContext2D, spec: ThumbnailSpec) {
  const { width: W, height: H, colors } = spec;
  const pad = Math.round(W * 0.07);
  const square = W === H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  const subtitleSize = W * 0.032;
  const hasSubtitle = spec.subtitle.trim().length > 0;
  const hasLabel = spec.label.trim().length > 0;
  const center = spec.template === "center" || spec.template === "frame";
  const barOffset = spec.template === "bar" ? Math.round(W * 0.012) + Math.round(W * 0.03) : 0;
  const maxWidth = center ? W - pad * 2.6 : W - pad * 2 - barOffset;
  const maxLines = square ? 4 : 3;

  // 위·아래에 고정으로 놓이는 요소(좌측 정렬의 라벨, 블로그 이름) 자리를 빼고 남은 공간에서 제목 블록을 가운데에 놓는다
  const labelBoxHeight = W * 0.026 * 1.8;
  const topReserve = spec.template === "left" && hasLabel ? pad + labelBoxHeight + W * 0.03 : pad * (spec.template === "frame" ? 0.9 : 0.6);
  const bottomReserve = spec.blogName.trim() ? pad * (spec.template === "frame" ? 0.95 : 0.7) + W * 0.022 * 1.8 : pad * 0.6;
  const available = H - topReserve - bottomReserve;

  const inlineLabelHeight = hasLabel && spec.template !== "left" ? labelBoxHeight + W * 0.025 : 0;
  const subtitleHeight = hasSubtitle ? subtitleSize * 1.6 : 0;
  const title = fitTitle(ctx, spec, maxWidth, Math.min(H * 0.55, available - inlineLabelHeight - subtitleHeight), maxLines);

  if (spec.template === "frame") {
    const inset = pad * 0.5;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = Math.max(4, Math.round(W * 0.006));
    roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, W * 0.02);
    ctx.stroke();
  }

  const blockHeight = inlineLabelHeight + title.height + subtitleHeight;
  let y = topReserve + Math.max(0, (available - blockHeight) / 2);

  const x = center ? W / 2 : pad + barOffset;
  const align = center ? "center" : "left";

  if (hasLabel) {
    if (spec.template === "left") drawLabel(ctx, spec, pad, pad, "left");
    else {
      drawLabel(ctx, spec, x, y, align);
      y += inlineLabelHeight;
    }
  }

  if (spec.template === "bar" && hasSubtitle) {
    // 강조 바 템플릿은 부제를 제목 위에 둔다
    drawSmall(ctx, spec, spec.subtitle, x, y + subtitleSize, "left", 0.032, 0.8);
    y += subtitleHeight;
  }

  if (spec.template === "bar") {
    ctx.fillStyle = colors.accent;
    roundRect(ctx, pad, y, Math.round(W * 0.012), title.height, W * 0.006);
    ctx.fill();
  }

  ctx.font = `${spec.titleWeight} ${title.size}px ${spec.family}`;
  ctx.textBaseline = "middle";
  title.lines.forEach((line, i) => drawLine(ctx, line, x, y + title.lineHeight * (i + 0.5), colors, align));
  y += title.height;

  if (hasSubtitle && spec.template !== "bar") {
    drawSmall(ctx, spec, spec.subtitle, x, y + subtitleSize * 1.3, align, 0.032, 0.8);
  }

  if (spec.blogName.trim()) {
    const bottom = H - pad * (spec.template === "frame" ? 0.95 : 0.7);
    const blogAlign: CanvasTextAlign = center ? "center" : spec.template === "bar" ? "right" : "left";
    const blogX = blogAlign === "center" ? W / 2 : blogAlign === "right" ? W - pad : pad;
    drawSmall(ctx, spec, spec.blogName, blogX, bottom, blogAlign, 0.022, 0.65);
  }
}
