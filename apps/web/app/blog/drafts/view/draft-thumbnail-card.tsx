"use client";

import { backgroundUrl } from "@toolhub/collector/thumbnail-style";
import { useState } from "react";
import type { DraftThumbnailInfo } from "../../../../lib/draft-thumbnail";
import { AccountThumbnailCanvas } from "../../thumbnail/account-thumbnail";
import type { ThumbnailFont } from "../../thumbnail/fonts";
import { saveDraftStatus } from "../status-control";

/**
 * 네이버 초안의 자동 썸네일: 계정 스타일 + 이 초안 문구. 크롬 확장 초안 채우기가 이 그림을 대표 썸네일 자리에 넣는다.
 * 문구·배경을 고치면 이 초안에만 저장된다 (비우면 자동)
 */
export function DraftThumbnailCard({ info, fonts }: { info: DraftThumbnailInfo; fonts: ThumbnailFont[] }) {
  const [text, setText] = useState(info.savedText ?? "");
  const [saved, setSaved] = useState({ text: info.savedText ?? "", background: info.savedBackground ?? "" });
  const [background, setBackground] = useState(info.savedBackground ?? "");
  const [message, setMessage] = useState("");

  const shownText = text.trim() || info.autoText;
  const pick = background === "none" ? null : background || info.autoBackground;
  const url = info.account && pick ? backgroundUrl(info.account.id, pick) : null;

  const save = async (patch: { text?: string; background?: string }) => {
    try {
      await saveDraftStatus(info.file, { thumbnail: patch });
      setSaved((prev) => ({ ...prev, ...patch }));
      setMessage("저장했어요");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setTimeout(() => setMessage(""), 2500);
  };

  return (
    <section className="card draft-thumb">
      <h2>
        자동 썸네일{" "}
        <small>{info.account ? `${info.account.name} 계정 스타일` : "계정이 없어 기본 스타일"} · 확장 초안 채우기 때 대표 썸네일 자리에 들어가요</small>
      </h2>
      <div className="account-thumb">
        <AccountThumbnailCanvas fonts={fonts} style={info.style} text={shownText} background={url} onError={setMessage} />
        <div className="account-thumb-controls">
          <label>
            문구 <small>비우면 자동 · 줄바꿈은 Enter, *강조*</small>
            <textarea
              rows={3}
              value={text}
              placeholder={info.autoText}
              maxLength={80}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => text.trim() !== saved.text && save({ text: text.trim() })}
            />
          </label>
          {info.account && (
            <label>
              배경
              <select
                value={background}
                onChange={(e) => {
                  setBackground(e.target.value);
                  save({ background: e.target.value });
                }}
              >
                <option value="">자동{info.autoBackground ? ` (${info.backgrounds.indexOf(info.autoBackground) + 1}번)` : " (단색)"}</option>
                {info.backgrounds.map((name, i) => (
                  <option key={name} value={name}>
                    배경 {i + 1}번
                  </option>
                ))}
                <option value="none">단색</option>
              </select>
            </label>
          )}
          {!info.slot && <p className="hint-text">본문에 [이미지: 대표 썸네일] 자리가 없어서 초안 채우기 때는 넣지 않아요.</p>}
          {!info.account && <p className="hint-text">초안 목록에서 이 초안의 계정을 정하면 그 계정 배경·색으로 바뀌어요.</p>}
          {message && <small className="status-message">{message}</small>}
        </div>
      </div>
    </section>
  );
}
