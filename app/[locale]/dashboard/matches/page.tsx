"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useQuery } from "urql";
import { foysMatchUrl, formatFieldType, SEASONS } from "@/lib/types";
import SeasonSelect from "@/components/season-select";
import { MATCHES_QUERY } from "@/lib/graphql/operations";
import type { MatchesResponse } from "@/lib/types";

export default function MatchesPage() {
  return (
    <Suspense>
      <MatchesContent />
    </Suspense>
  );
}

function MatchesContent() {
  const t = useTranslations("Dashboard.matches");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSeason = searchParams.get("season");
  const season = SEASONS.includes(rawSeason ?? "") ? rawSeason! : SEASONS[0];

  useEffect(() => {
    if (!rawSeason || !SEASONS.includes(rawSeason)) {
      router.replace(`/dashboard/matches?season=${SEASONS[0]}`);
    }
  }, [rawSeason, router]);

  const [{ data, error, fetching }] = useQuery<{ matches: MatchesResponse }>({
    query: MATCHES_QUERY,
    variables: { season },
    requestPolicy: "network-only",
  });
  const loading = fetching;
  const matches = data?.matches ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <SeasonSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: matches.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.date")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.time")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.homeTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.awayTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.score")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.status")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.field")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {matches.map((match) => {
              const homeLabel = match.homeTeam ?? "—";
              const awayLabel = match.awayTeam
                ? match.awayTeam.organisation
                  ? `${match.awayTeam.organisation.name} - ${match.awayTeam.name}`
                  : match.awayTeam.name ?? String(match.awayTeam.foysId)
                : "—";
              const score =
                match.homeScore != null
                  ? `${match.homeScore} – ${match.awayScore}`
                  : "—";

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
                  <td className="py-3 pr-4 text-ink">
                    {match.date}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {match.startTime?.slice(0, 5) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-ink">{homeLabel}</td>
                  <td className="py-3 pr-4 text-ink-muted">{awayLabel}</td>
                  <td className="py-3 pr-4 font-mono text-ink">{score}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium ${
                        match.status === "FINAL"
                          ? "bg-green-100 text-green-800"
                          : match.status === "PLANNED"
                            ? "bg-blue-100 text-blue-800"
                            : match.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {match.status}
                    </span>
                  </td>
                  <td className="py-3 text-ink-muted">
                    {formatFieldType(match.field) ?? "—"}
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