import { listDrafts, PLATFORM_LABELS, readDraftStatuses } from "@toolhub/collector";
import Link from "next/link";
import { DATA_DIR, DRAFTS_DIR } from "../../../lib/data";
import { DraftTable } from "./draft-table";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const [drafts, statuses] = await Promise.all([listDrafts(DRAFTS_DIR), readDraftStatuses(DATA_DIR)]);

  return (
    <main>
      <header>
        <h1>
          초안 <small>{drafts.length}개 · 줄을 누르면 상태를 바꾸고 지식iN 답변을 준비해요</small>
        </h1>
        <Link className="button" href="/blog/schedule">
          예약 발행 시간
        </Link>
      </header>

      {drafts.length === 0 ? (
        <p className="notice">
          아직 초안이 없습니다. Claude 데스크톱 앱에서 &ldquo;○○ 키워드로 티스토리 글 써서 저장해줘&rdquo;라고 하거나, Claude
          Code에서 <code>/blog-draft 키워드 플랫폼</code>을 실행하면 이곳에 쌓입니다.
        </p>
      ) : (
        <DraftTable
          rows={drafts.map((d) => ({ ...d, platform: d.platform ? PLATFORM_LABELS[d.platform] : null }))}
          statuses={statuses}
        />
      )}
    </main>
  );
}
