"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { SEASONS } from "@/lib/types";

const CURRENT_SEASON = SEASONS[0];

export default function SeasonSelect() {
  const t = useTranslations("Dashboard.activeMembers");
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("season") ?? CURRENT_SEASON;

  function onSelect(value: string) {
    router.push(`/dashboard/active-members?season=${value}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onSelect(e.target.value)}
      aria-label={t("filter.label")}
      className="border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink"
    >
      {SEASONS.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
    </select>
  );
}