import { listDrafts, PLATFORM_LABELS } from "@toolhub/collector";
import Link from "next/link";
import { DRAFTS_DIR } from "../../lib/data";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const drafts = await listDrafts(DRAFTS_DIR);

  return (
    <main>
      <header>
        <h1>
          초안 <small>{drafts.length}개</small>
        </h1>
      </header>

      {drafts.length === 0 ? (
        <p className="notice">
          아직 초안이 없습니다. Claude 데스크톱 앱에서 &ldquo;○○ 키워드로 티스토리 글 써서 저장해줘&rdquo;라고 하거나, Claude
          Code에서 <code>/blog-draft 키워드 플랫폼</code>을 실행하면 이곳에 쌓입니다.
        </p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>키워드</th>
                <th>플랫폼</th>
                <th>작성일</th>
                <th>마지막 수정</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.file}>
                  <td className="keyword">
                    <Link href={`/drafts/view?file=${encodeURIComponent(d.file)}`}>{d.keyword}</Link>
                  </td>
                  <td>{d.platform ? PLATFORM_LABELS[d.platform] : "-"}</td>
                  <td>{d.date ?? "-"}</td>
                  <td>{new Date(d.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
