import { describe, it, expect } from "vitest";
import { runFastPlagiarismCheck, calculateSimilarity } from "./plagiarism";
import { type TeamRow } from "./queries";

describe("Plagiarism & Originality Detection", () => {
  it("computes text token similarity accurately using Jaccard index", () => {
    const textA = "AI powered agricultural yield prediction system using satellite imagery and IoT sensors.";
    const textB = "AI powered agricultural crop yield prediction platform utilizing satellite imagery and IoT sensors.";
    const sim = calculateSimilarity(textA, textB);

    expect(sim).toBeGreaterThan(50);
  });

  it("detects identical GitHub repository URLs across different teams", () => {
    const mockTeams: TeamRow[] = [
      {
        id: "team-1",
        name: "Alpha Innovators",
        project_title: "Smart Irrigation",
        github_url: "https://github.com/example/smart-irrigation",
        project_description: "An automated watering system based on soil moisture.",
        final_status: "pending",
        evals: {},
        missing: [],
      } as any,
      {
        id: "team-2",
        name: "Beta Innovators",
        project_title: "Automated Watering",
        github_url: "https://github.com/example/smart-irrigation", // identical repo!
        project_description: "An automated watering system based on soil moisture and temperature.",
        final_status: "pending",
        evals: {},
        missing: [],
      } as any,
    ];

    const results = runFastPlagiarismCheck(mockTeams);
    const team1Result = results.get("team-1");
    const team2Result = results.get("team-2");

    expect(team1Result?.isFlagged).toBe(true);
    expect(team1Result?.severity).toBe("high");
    expect(team1Result?.matchedWith.some((m) => m.teamName === "Beta Innovators")).toBe(true);
    expect(team2Result?.isFlagged).toBe(true);
  });
});
