import { draftThumbnail } from "../../../../lib/draft-thumbnail";
import { THUMBNAIL_FONTS } from "../fonts";
import { ThumbnailRender } from "./thumbnail-render";

export const dynamic = "force-dynamic";

/**
 * 크롬 확장 초안 채우기가 보이지 않는 iframe으로 여는 화면: 초안의 썸네일을 계정 스타일로 그려 PNG를 확장(부모 창)에 보낸다.
 * 웹 미리보기와 같은 그리기 코드·글꼴을 쓰려고 확장이 직접 그리지 않는다
 */
export default async function ThumbnailRenderPage({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  const { file = "" } = await searchParams;
  const info = file ? await draftThumbnail(file) : null;
  return (
    <main>
      <ThumbnailRender
        file={file}
        fonts={THUMBNAIL_FONTS}
        input={info && { style: info.style, text: info.text, background: info.background }}
        error={info ? null : `초안을 찾지 못했어요: ${file}`}
      />
    </main>
  );
}
