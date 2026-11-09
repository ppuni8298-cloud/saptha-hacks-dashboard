import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { TeamForm } from "@/components/team-form";

export const Route = createFileRoute("/_authenticated/teams/new")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Add team — Assessor" }, { name: "description", content: "Register a new team." }, { property: "og:title", content: "Add team — Assessor" }, { property: "og:description", content: "Register a new team." }] }),
  component: () => (
    <>
      <PageHeader title="Add team" desc="Register a team, its members and project evidence." />
      <TeamForm />
    </>
  ),
});
