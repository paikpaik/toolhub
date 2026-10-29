/** 네이버 검색광고 API 관련 공용 표시 컴포넌트 */

export function formatSearches(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (value === 0) return "<10";
  return value.toLocaleString();
}

export function CompetitionBadge({ value }: { value: string }) {
  const level = value === "낮음" ? "low" : value === "중간" ? "mid" : value === "높음" ? "high" : "";
  return <span className={`comp ${level}`}>{value}</span>;
}

export function SearchAdNotice({ configured, error }: { configured: boolean; error?: string | null }) {
  if (!configured) {
    return (
      <p className="notice">
        네이버 검색광고 API 키를 <code>apps/web/.env.local</code>에 넣으면 월간 검색량·경쟁도·연관 키워드가 표시됩니다.
        (<code>apps/web/.env.example</code> 참고, 넣은 뒤 서버 재시작)
      </p>
    );
  }
  if (error) return <p className="notice error">검색량 조회 실패: {error}</p>;
  return null;
}
