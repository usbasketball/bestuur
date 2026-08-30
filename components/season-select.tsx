"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SEASONS } from "@/lib/types";

const CURRENT_SEASON = SEASONS[0];

export default function SeasonSelect() {
  const t = useTranslations("Dashboard.activeMembers");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("season") ?? CURRENT_SEASON;

  function onSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", value);
    router.push(`${pathname}?${params.toString()}`);
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