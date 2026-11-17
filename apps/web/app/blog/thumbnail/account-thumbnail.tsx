"use client";

import { ACCOUNT_THUMBNAIL_SIZE, type ThumbnailStyle } from "@toolhub/collector/thumbnail-style";
import { useEffect, useRef } from "react";
import { drawThumbnail, TEMPLATES, type TemplateId } from "./draw";
import type { ThumbnailFont } from "./fonts";

const images = new Map<string, Promise<HTMLImageElement>>();

/** 배경 이미지를 한 번만 받아 둔다 */
function loadImage(url: string) {
  let image = images.get(url);
  if (!image) {
    const img = new Image();
    img.src = url;
    image = img.decode().then(() => img);
    image.catch(() => images.delete(url));
    images.set(url, image);
  }
  return image;
}

/** 계정 스타일로 썸네일을 그린다 (1080×1080). 글꼴은 쓰인 글자만 불러온 뒤 그린다 */
export async function renderAccountThumbnail(canvas: HTMLCanvasElement, fonts: ThumbnailFont[], input: { style: ThumbnailStyle; text: string; background: string | null }) {
  const { style, text, background } = input;
  const font = fonts.find((f) => f.id === style.fontId) ?? fonts[0]!;
  const template = (TEMPLATES.some((t) => t.id === style.template) ? style.template : "center") as TemplateId;
  const chars = [text, style.label, style.blogName].join("");
  const [image] = await Promise.all([
    background ? loadImage(background) : Promise.resolve(null),
    document.fonts.load(`${font.titleWeight} 64px ${font.family}`, chars).catch(() => {}),
    document.fonts.load(`${font.bodyWeight} 32px ${font.family}`, chars).catch(() => {}),
  ]);
  canvas.width = ACCOUNT_THUMBNAIL_SIZE;
  canvas.height = ACCOUNT_THUMBNAIL_SIZE;
  drawThumbnail(canvas.getContext("2d")!, {
    width: ACCOUNT_THUMBNAIL_SIZE,
    height: ACCOUNT_THUMBNAIL_SIZE,
    template,
    colors: style.colors,
    family: font.family,
    titleWeight: font.titleWeight,
    bodyWeight: font.bodyWeight,
    title: text,
    subtitle: "",
    label: style.label,
    blogName: style.blogName,
    background: image && { image, width: image.naturalWidth, height: image.naturalHeight },
    overlay: style.overlay,
  });
}

/** next/font의 @font-face가 페이지에 포함되도록 각 글꼴을 한 번씩 쓴다 */
export function FontWarmup({ fonts }: { fonts: ThumbnailFont[] }) {
  return (
    <div aria-hidden className="font-warmup">
      {fonts.map((f) => (
        <span key={f.id} className={f.className}>
          가
        </span>
      ))}
    </div>
  );
}

/** 미리보기 캔버스: 값이 바뀔 때마다 다시 그린다 */
export function AccountThumbnailCanvas({
  fonts,
  style,
  text,
  background,
  className,
  onError,
}: {
  fonts: ThumbnailFont[];
  style: ThumbnailStyle;
  text: string;
  background: string | null;
  className?: string;
  onError?: (message: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderAccountThumbnail(ref.current, fonts, { style, text, background }).catch((e) => onError?.(`썸네일을 그리지 못했어요: ${e.message ?? e}`));
  }, [fonts, style, text, background]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <canvas ref={ref} className={className ?? "account-thumbnail"} width={ACCOUNT_THUMBNAIL_SIZE} height={ACCOUNT_THUMBNAIL_SIZE} />
      <FontWarmup fonts={fonts} />
    </>
  );
}
