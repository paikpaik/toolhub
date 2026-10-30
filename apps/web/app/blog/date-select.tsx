"use client";

import { useRouter } from "next/navigation";

/** 기준 날짜 선택. 여러 날 보기(range)는 유지한 채 날짜만 바꾼다 */
export function DateSelect({ dates, value, today, range = 1 }: { dates: string[]; value: string; today: string; range?: number }) {
  const router = useRouter();
  const options = dates.includes(today) ? dates : [today, ...dates];

  const go = (date: string) => {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (range !== 1) params.set("range", String(range));
    const query = params.toString();
    router.push(query ? `/blog/history?${query}` : "/blog/history");
  };

  return (
    <select value={value} onChange={(e) => go(e.target.value)} title={range === 1 ? "날짜" : `기준 날짜 (이 날까지 ${range}일)`}>
      {options.map((d) => (
        <option key={d} value={d}>
          {d === today ? `${d} (오늘)` : d}
        </option>
      ))}
    </select>
  );
}
