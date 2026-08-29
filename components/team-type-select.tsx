"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { TEAM_TYPES } from "@/lib/types";

export default function TeamTypeSelect() {
  const t = useTranslations("Dashboard.members");
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("team_type") ?? "";

  function onSelect(value: string) {
    router.push(
      value ? `/dashboard/members?team_type=${value}` : "/dashboard/members",
    );
  }

  return (
    <select
      value={current}
      onChange={(e) => onSelect(e.target.value)}
      aria-label={t("filter.label")}
      className="border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink"
    >
      <option value="">{t("filter.all")}</option>
      {TEAM_TYPES.map((teamType) => (
        <option key={teamType} value={teamType}>
          {teamType}
        </option>
      ))}
    </select>
  );
}