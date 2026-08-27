import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Activity, Disc, ExternalLink } from "lucide-react";
import { pool } from "@/lib/db";
import { foysMemberUrl } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
};

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name_prefix: string | null;
  last_name: string | null;
  nbb_number: string | null;
  referee_level: string | null;
  foys_user_id: string | null;
  member_since: string | null;
  membership_type: string | null;
};

export default async function MembersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.members");

  const { rows } = await pool.query<User>(
    `SELECT u.id, u.email, u.first_name, u.last_name_prefix, u.last_name, u.nbb_number, u.referee_level, u.foys_user_id,
            to_char(u.member_since, 'YYYY-MM-DD') AS member_since,
            cm.membership_type
     FROM users u
     LEFT JOIN club_memberships cm ON cm.user_id = u.id AND cm.season = '2026-2027'
     ORDER BY u.last_name NULLS LAST, u.first_name NULLS LAST`
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: rows.length })}
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
            {rows.map((user) => (
              <tr key={user.id} className="border-b border-line/50">
                <td className="py-3 pr-4">
                  {user.foys_user_id && (
                    <a
                      href={foysMemberUrl(user.foys_user_id)}
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
                  {user.membership_type === "COMPETITION" && (
                    <span title={t("membershipTypes.COMPETITION")}>
                      <Disc
                        className="h-4 w-4 text-accent"
                        aria-label={t("membershipTypes.COMPETITION")}
                      />
                    </span>
                  )}
                  {user.membership_type === "RECREATIONAL" && (
                    <span title={t("membershipTypes.RECREATIONAL")}>
                      <Activity
                        className="h-4 w-4 text-ink-muted"
                        aria-label={t("membershipTypes.RECREATIONAL")}
                      />
                    </span>
                  )}
                  {!user.membership_type && <span aria-hidden="true">—</span>}
                </td>
                <td className="py-3 pr-4 text-ink">
                  {[user.first_name, user.last_name_prefix, user.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </td>
                <td className="py-3 pr-4 text-ink-muted">{user.email}</td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                  {user.nbb_number ?? "—"}
                </td>
                <td className="py-3 pr-4 text-ink-muted">
                  {user.referee_level ?? "—"}
                </td>
                <td className="py-3 text-ink-muted">{user.member_since ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
