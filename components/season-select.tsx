"use client";

import { SEASONS } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";

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
