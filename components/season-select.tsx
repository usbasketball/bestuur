"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SEASONS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "2022-2023",
  "2021-2022",
  "2020-2021",
  "2019-2020",
  "2018-2019",
  "2017-2018",
];

export default function SeasonSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("season") ?? SEASONS[0];

  return (
    <select
      value={current}
      onChange={(e) => router.push(`/dashboard/matches?season=${e.target.value}`)}
      className="border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink"
    >
      {SEASONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
