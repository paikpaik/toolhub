"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 페이지를 먼저 보여주고, 검색량을 모르는 키워드는 뒤에서 채운다.
 * 검색광고 API는 호출 한도 때문에 요청 사이에 1초씩 쉬어야 해서, 렌더링에서 기다리면 첫 화면이 수 초씩 늦어진다.
 * 한 묶음 채울 때마다 표를 새로 그려 숫자가 차례로 채워진다.
 */
export function StatsEnricher({ date, missing }: { date: string; missing: number }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(missing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (missing === 0) return;
    let cancelled = false;
    (async () => {
      for (let round = 0; round < 10 && !cancelled; round++) {
        const res = await fetch("/api/stats/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        }).catch(() => null);
        const result = (await res?.json().catch(() => null)) as { remaining?: number; error?: string | null } | null;
        if (cancelled) return;
        router.refresh();
        if (!result || result.error) {
          setError(result?.error ?? "검색량 조회 요청에 실패했습니다.");
          return;
        }
        setRemaining(result.remaining ?? 0);
        if (!result.remaining) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, missing, router]);

  if (error) return <p className="notice error">검색량 조회 실패: {error}</p>;
  if (missing === 0 || remaining === 0) return null;
  return (
    <p className="notice loading">
      <span className="spinner" aria-hidden /> 검색량을 조회하고 있어요 (남은 키워드 {remaining}개). 호출 한도 때문에 5개씩 차례로 채워집니다.
    </p>
  );
}
