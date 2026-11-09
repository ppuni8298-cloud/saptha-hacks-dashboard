import { describe, expect, it } from "vitest";
import { isAllowedAccount, submissionSchema, validatePdf } from "./submission";
const valid = { name: "Demo", email: "demo@example.com", project_title: "Demo project", project_description: "A demo project", github_url: "https://github.com/org/repo", website_url: "https://example.com" };
describe("Submission requirements", () => {
  for (const key of Object.keys(valid)) it(`requires ${key}`, () => {
    expect(submissionSchema.safeParse({ ...valid, [key]: " " }).success).toBe(false);
  });
  it("requires a PDF", () => expect(() => validatePdf(null)).toThrow());
  it("allows exactly 3 MB", () => expect(() => validatePdf({ name: "project.pdf", type: "application/pdf", size: 3 * 1024 * 1024 })).not.toThrow());
  it("rejects more than 3 MB", () => expect(() => validatePdf({ name: "project.pdf", type: "application/pdf", size: 3 * 1024 * 1024 + 1 })).toThrow());
  it("allows only the designated account", () => {
    expect(isAllowedAccount("TeamInoSap26@gmail.com")).toBe(true);
    expect(isAllowedAccount("other@example.com")).toBe(false);
  });
});