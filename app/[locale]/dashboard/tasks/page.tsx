"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useQuery } from "urql";
import { foysMatchUrl, formatFieldType, abbreviateTeamType, SEASONS } from "@/lib/types";
import SeasonSelect from "@/components/season-select";
import { MATCHES_QUERY } from "@/lib/graphql/queries";
import type { MatchesResponse } from "@/lib/types";

export default function TasksPage() {
  return (
    <Suspense>
      <TasksContent />
    </Suspense>
  );
}

function TasksContent() {
  const t = useTranslations("Dashboard.tasks");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSeason = searchParams.get("season");
  const season = SEASONS.includes(rawSeason ?? "") ? rawSeason! : SEASONS[0];

  useEffect(() => {
    if (!rawSeason || !SEASONS.includes(rawSeason)) {
      router.replace(`/dashboard/tasks?season=${SEASONS[0]}`);
    }
  }, [rawSeason, router]);

  const [{ data, error, fetching }] = useQuery<{ matches: MatchesResponse }>({
    query: MATCHES_QUERY,
    variables: { season },
    requestPolicy: "network-only",
  });
  const loading = fetching;
  const matches = data?.matches ?? [];

  const rows = matches
    .filter((m) => m.tasks)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );

  const assigneeName = (
    member: { user?: { firstName?: string | null; lastNamePrefix?: string | null; lastName?: string | null } | null; primaryTeam?: string | null } | null | undefined,
    options?: { isReferee?: boolean; homeTeam?: string | null },
  ): string => {
    if (!member?.user) {
      if (options?.isReferee && ["H1", "H2", "D1"].includes(abbreviateTeamType(options.homeTeam))) {
        return "NBB";
      }
      return "TBD";
    }
    const { user, primaryTeam } = member;
    return `${abbreviateTeamType(primaryTeam)} ${user.firstName}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <SeasonSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: rows.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.date")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.time")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.homeTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.awayTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.field")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.ref1")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.ref2")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.tableScorer")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.tableTimer")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.table24s")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {rows.map((match) => {
              const awayLabel = match.awayTeam?.organisation
                ? `${match.awayTeam.organisation.name} - ${match.awayTeam.name}`
                : (match.awayTeam?.name ?? null);
              return (
                <tr key={match.id} className="border-b border-line/50">
                  <td className="py-3 pr-4">
                    <a
                      href={foysMatchUrl(match.foysMatchId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-ink-muted transition-colors hover:text-accent"
                      aria-label={t("openInFoys")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink">{match.date}</td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {match.startTime?.slice(0, 5) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-ink">{abbreviateTeamType(match.homeTeam) || "—"}</td>
                  <td className="py-3 pr-4 text-ink-muted">{awayLabel ?? "—"}</td>
                  <td className="py-3 pr-4 text-ink-muted">{formatFieldType(match.field)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink">{assigneeName(match.tasks?.referee1, { isReferee: true, homeTeam: match.homeTeam })}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink">{assigneeName(match.tasks?.referee2, { isReferee: true, homeTeam: match.homeTeam })}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">{assigneeName(match.tasks?.scorer)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">{assigneeName(match.tasks?.timer)}</td>
                  <td className="whitespace-nowrap py-3 text-ink-muted">
                    {["D1", "D2", "D3", "H1", "H2", "H3", "H4"].includes(abbreviateTeamType(match.homeTeam))
                      ? assigneeName(match.tasks?.shotClock)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
