import {
  backgroundUrl,
  DEFAULT_THUMBNAIL_STYLE,
  parseDraft,
  pickBackground,
  readAccounts,
  readDraftFile,
  readDraftStatuses,
  thumbnailText,
  hasThumbnailSlot,
  type ThumbnailStyle,
} from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "./data";

export interface DraftThumbnailInfo {
  file: string;
  /** 초안 계정 (없으면 기본 스타일) */
  account: { id: string; name: string } | null;
  style: ThumbnailStyle;
  /** 그릴 문구 (줄바꿈 \n, *강조*) */
  text: string;
  /** 고친 문구가 없을 때의 문구 (대표 썸네일 표시의 문구 → 추천 제목) */
  autoText: string;
  /** 계정 배경 이미지 이름들 */
  backgrounds: string[];
  /** 자동으로 고른 배경 이름 (없으면 단색) */
  autoBackground: string | null;
  /** 초안에서 고친 문구 (없으면 null, 자동) */
  savedText: string | null;
  /** 초안에서 고른 배경 (없으면 null, 자동) */
  savedBackground: string | null;
  /** 그릴 배경 이미지 주소, 단색이면 null */
  background: string | null;
  /** 본문에 대표 썸네일 자리가 있는지 */
  slot: boolean;
}

/** 초안의 썸네일: 계정 스타일 + 문구(고친 문구 → 대표 썸네일 표시의 문구 → 추천 제목) + 배경(고른 배경 → 계정 배경 자동). 초안이 없으면 null */
export async function draftThumbnail(file: string): Promise<DraftThumbnailInfo | null> {
  const [content, statuses, accounts] = await Promise.all([readDraftFile(DRAFTS_DIR, file), readDraftStatuses(DATA_DIR), readAccounts(DATA_DIR)]);
  if (content === null) return null;
  const draft = parseDraft(content);
  const entry = statuses[file];
  const account = accounts.find((a) => a.id === entry?.account) ?? null;
  const style = account?.thumbnail ?? DEFAULT_THUMBNAIL_STYLE;
  const title = draft.titles.find((t) => t.recommended)?.text ?? draft.titles[0]?.text ?? "";
  const name = account ? pickBackground(style.backgrounds, file, entry?.thumbnail?.background) : null;
  return {
    file,
    account: account && { id: account.id, name: account.name },
    style,
    text: thumbnailText(draft.markers, title, entry?.thumbnail?.text),
    autoText: thumbnailText(draft.markers, title),
    backgrounds: account ? style.backgrounds : [],
    autoBackground: account ? pickBackground(style.backgrounds, file) : null,
    savedText: entry?.thumbnail?.text ?? null,
    savedBackground: entry?.thumbnail?.background ?? null,
    background: account && name ? backgroundUrl(account.id, name) : null,
    slot: hasThumbnailSlot(draft.markers),
  };
}
