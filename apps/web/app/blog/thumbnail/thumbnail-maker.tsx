"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR_PRESETS, drawThumbnail, SIZES, TEMPLATES, type Colors, type SizeId, type TemplateId } from "./draw";
import type { ThumbnailFont } from "./fonts";

/** 블로그 이름·색·글꼴·템플릿·크기는 브라우저에 기억해 썸네일 스타일을 통일한다 */
const BRAND_KEY = "toolhub:thumbnail-brand";

interface Brand {
  blogName: string;
  template: TemplateId;
  size: SizeId;
  colors: Colors;
  fontId: string;
}

const DEFAULT_BRAND: Brand = {
  blogName: "",
  template: "center",
  size: "1200x630",
  colors: COLOR_PRESETS[0]!.colors,
  fontId: "noto",
};

function loadBrand(): Brand {
  try {
    return { ...DEFAULT_BRAND, ...JSON.parse(localStorage.getItem(BRAND_KEY) ?? "{}") };
  } catch {
    return DEFAULT_BRAND;
  }
}

const slugify = (value: string) =>
  value
    .replace(/\*/g, "")
    .replace(/[\\/:*?"<>|\n]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "thumbnail";

export function ThumbnailMaker({
  fonts,
  initial,
}: {
  fonts: ThumbnailFont[];
  initial: { title: string; subtitle: string; label: string };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(initial.title || "썸네일 *제목*을 입력하세요");
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [label, setLabel] = useState(initial.label);
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setBrand(loadBrand());
    setLoaded(true);
  }, []);

  const updateBrand = (patch: Partial<Brand>) => {
    const next = { ...brand, ...patch };
    setBrand(next);
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(next));
    } catch {
      // 저장 못 해도 이번 화면에서는 동작한다
    }
  };

  const font = fonts.find((f) => f.id === brand.fontId) ?? fonts[0]!;
  const size = SIZES.find((s) => s.id === brand.size) ?? SIZES[0];

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const spec = {
      width: size.width,
      height: size.height,
      template: brand.template,
      colors: brand.colors,
      family: font.family,
      titleWeight: font.titleWeight,
      bodyWeight: font.bodyWeight,
      title,
      subtitle,
      label,
      blogName: brand.blogName,
    };
    // 한글 글꼴은 쓰인 글자 범위만 받아 오므로, 그리기 전에 지금 글자들을 불러온다
    const text = [title, subtitle, label, brand.blogName].join("");
    Promise.all([
      document.fonts.load(`${font.titleWeight} 64px ${font.family}`, text),
      document.fonts.load(`${font.bodyWeight} 32px ${font.family}`, text),
    ])
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        canvas.width = size.width;
        canvas.height = size.height;
        drawThumbnail(ctx, spec);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, title, subtitle, label, brand, font, size]);

  const toBlob = () =>
    new Promise<Blob>((resolve, reject) => canvasRef.current?.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 생성 실패"))), "image/png"));

  const download = async () => {
    const url = URL.createObjectURL(await toBlob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `thumbnail-${slugify(title)}-${size.width}x${size.height}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyImage = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob() })]);
      setStatus("이미지를 복사했습니다. 블로그 에디터에 붙여넣으세요.");
    } catch {
      setStatus("이 브라우저에서는 이미지 복사가 안 됩니다. PNG 다운로드를 이용하세요.");
    }
    setTimeout(() => setStatus(""), 3000);
  };

  return (
    <div className="thumbnail-layout">
      <div>
        <canvas ref={canvasRef} className="thumbnail-canvas" width={size.width} height={size.height} aria-label="썸네일 미리보기" />
        <div className="thumbnail-actions">
          <button type="button" className="button primary" onClick={download}>
            PNG 다운로드
          </button>
          <button type="button" className="button" onClick={copyImage}>
            이미지 복사
          </button>
          {status && <small>{status}</small>}
        </div>
        {/* next/font의 @font-face가 페이지에 포함되도록 각 글꼴을 한 번씩 쓴다 */}
        <div aria-hidden className="font-warmup">
          {fonts.map((f) => (
            <span key={f.id} className={f.className}>
              가
            </span>
          ))}
        </div>
      </div>

      <form className="card thumbnail-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          제목 <small>*강조* · 줄바꿈 가능</small>
          <textarea rows={3} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          부제 <small>선택</small>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="예: 2026년 기준 총정리" />
        </label>
        <label>
          라벨 <small>선택</small>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 정보, 리뷰, 맛집" />
        </label>
        <label>
          블로그 이름 <small>기억됨</small>
          <input value={brand.blogName} onChange={(e) => updateBrand({ blogName: e.target.value })} placeholder="예: 생활정보 노트" />
        </label>

        <label>
          템플릿
          <select value={brand.template} onChange={(e) => updateBrand({ template: e.target.value as TemplateId })}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          크기
          <select value={brand.size} onChange={(e) => updateBrand({ size: e.target.value as SizeId })}>
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          글꼴
          <select value={brand.fontId} onChange={(e) => updateBrand({ fontId: e.target.value })}>
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>색 조합</legend>
          <div className="swatches">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="swatch"
                title={p.name}
                aria-label={p.name}
                style={{ background: p.colors.bg, color: p.colors.accent, borderColor: p.colors.text }}
                onClick={() => updateBrand({ colors: p.colors })}
              >
                가
              </button>
            ))}
          </div>
          <div className="color-inputs">
            {(["bg", "text", "accent"] as const).map((key) => (
              <label key={key}>
                <input type="color" value={brand.colors[key]} onChange={(e) => updateBrand({ colors: { ...brand.colors, [key]: e.target.value } })} />
                {{ bg: "배경", text: "글자", accent: "강조" }[key]}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
