"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { foysMatchUrl, SEASONS } from "@/lib/types";
import SeasonSelect from "@/components/season-select";
import { useApiData } from "@/lib/use-api";
import type { TasksResponse } from "@/lib/types";

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

  const { data: tasks, error, loading } = useApiData<TasksResponse>(
    `/api/tasks?season=${season}`,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <SeasonSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: tasks?.length ?? 0 })}
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
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.task")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.assigned")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {tasks?.map((task) => {
              const awayLabel = task.awayOrganisationName
                ? `${task.awayOrganisationName} - ${task.awayTeamName}`
                : task.awayTeamName ?? "—";

              return (
                <tr key={task.id} className="border-b border-line/50">
                  <td className="py-3 pr-4">
                    <a
                      href={foysMatchUrl(task.foysMatchId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-ink-muted transition-colors hover:text-accent"
                      aria-label={t("openInFoys")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-ink">{task.matchDate}</td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {task.matchStartTime?.slice(0, 5) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-ink">{task.homeTeam ?? "—"}</td>
                  <td className="py-3 pr-4 text-ink-muted">{awayLabel}</td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {t(`taskTypes.${task.taskType}`)}
                    {task.isDouble && " •2"}
                  </td>
                  <td className="py-3 text-ink">
                    {task.userName || task.nbbNumber || task.userEmail || "—"}
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