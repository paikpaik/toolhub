"use client";

import type { ThumbnailStyle } from "@toolhub/collector/thumbnail-style";
import { useEffect, useRef, useState } from "react";
import { FontWarmup, renderAccountThumbnail } from "../account-thumbnail";
import type { ThumbnailFont } from "../fonts";

/** 그린 PNG(data URL)나 오류를 부모 창(크롬 확장 패널)에 보낸다. 직접 열면 그림만 보인다 */
export function ThumbnailRender({
  file,
  fonts,
  input,
  error,
}: {
  file: string;
  fonts: ThumbnailFont[];
  input: { style: ThumbnailStyle; text: string; background: string | null } | null;
  error: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState(error ?? "그리는 중…");

  useEffect(() => {
    const send = (data: { png?: string; error?: string }) => {
      if (window.parent !== window) window.parent.postMessage({ type: "toolhub-thumbnail", file, ...data }, "*");
    };
    if (!input || !ref.current) return send({ error: error ?? "초안을 찾지 못했어요" });
    renderAccountThumbnail(ref.current, fonts, input).then(
      () => {
        setMessage("");
        send({ png: ref.current!.toDataURL("image/png") });
      },
      (e) => {
        const text = `썸네일을 그리지 못했어요: ${e?.message ?? e}`;
        setMessage(text);
        send({ error: text });
      },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {message && <p className="notice">{message}</p>}
      <canvas ref={ref} className="account-thumbnail" />
      <FontWarmup fonts={fonts} />
    </>
  );
}
