"use client";

import { useRouter } from "next/navigation";

export function DateSelect({ dates, value, today }: { dates: string[]; value: string; today: string }) {
  const router = useRouter();
  const options = dates.includes(today) ? dates : [today, ...dates];

  return (
    <select
      value={value}
      onChange={(e) => router.push(e.target.value === today ? "/history" : `/history?date=${e.target.value}`)}
    >
      {options.map((d) => (
        <option key={d} value={d}>
          {d === today ? `${d} (오늘)` : d}
        </option>
      ))}
    </select>
  );
}
