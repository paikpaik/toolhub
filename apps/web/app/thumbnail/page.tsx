import { THUMBNAIL_FONTS } from "./fonts";
import { ThumbnailMaker } from "./thumbnail-maker";

export default async function ThumbnailPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; subtitle?: string; label?: string }>;
}) {
  const { title = "", subtitle = "", label = "" } = await searchParams;

  return (
    <main>
      <header>
        <h1>
          썸네일 <small>블로그 대표 이미지 만들기</small>
        </h1>
      </header>
      <ThumbnailMaker fonts={THUMBNAIL_FONTS} initial={{ title, subtitle, label }} />
    </main>
  );
}
