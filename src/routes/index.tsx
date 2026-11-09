import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "INNOVEDGE Assessor — AI Project Evaluation" },
      { name: "description", content: "INNOVEDGE Admin console for evaluating team projects with AI." },
      { property: "og:title", content: "INNOVEDGE Assessor — AI Project Evaluation" },
      { property: "og:description", content: "INNOVEDGE Admin console for evaluating team projects with AI." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
