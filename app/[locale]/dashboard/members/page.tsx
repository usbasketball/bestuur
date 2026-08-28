import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Activity, Disc, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { foysMemberUrl } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.members");

  const users = await db.orm.public.User.select(
    "id",
    "email",
    "firstName",
    "lastNamePrefix",
    "lastName",
    "nbbNumber",
    "refereeLevel",
    "foysUserId",
    "memberSince",
  )
    .include("memberships", (m) =>
      m
        .where((x) => x.season.eq("2026-2027"))
        .select("membershipType"),
    )
    .orderBy([(u) => u.lastName.asc(), (u) => u.firstName.asc()])
    .all();

  const formatDate = (d: Temporal.PlainDateTime | null | undefined) =>
    d ? d.toPlainDate().toString() : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: users.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.membershipType")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.email")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.nbb")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.refereeLevel")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.memberSince")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const membershipType = user.memberships[0]?.membershipType ?? null;
              return (
                <tr key={user.id} className="border-b border-line/50">
                  <td className="py-3 pr-4">
                    {user.foysUserId && (
                      <a
                        href={foysMemberUrl(user.foysUserId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-ink-muted transition-colors hover:text-accent"
                        aria-label={t("openInFoys")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {membershipType === "COMPETITION" && (
                      <span title={t("membershipTypes.COMPETITION")}>
                        <Disc
                          className="h-4 w-4 text-accent"
                          aria-label={t("membershipTypes.COMPETITION")}
                        />
                      </span>
                    )}
                    {membershipType === "RECREATIONAL" && (
                      <span title={t("membershipTypes.RECREATIONAL")}>
                        <Activity
                          className="h-4 w-4 text-ink-muted"
                          aria-label={t("membershipTypes.RECREATIONAL")}
                        />
                      </span>
                    )}
                    {!membershipType && <span aria-hidden="true">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-ink">
                    {[user.firstName, user.lastNamePrefix, user.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{user.email}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                    {user.nbbNumber ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {user.refereeLevel ?? "—"}
                  </td>
                  <td className="py-3 text-ink-muted">
                    {formatDate(user.memberSince) ?? "—"}
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
