import { z } from "zod";

export const ADMIN_EMAIL = "TeamInoSap26@gmail.com";
export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export const isAllowedAccount = (email: string) => email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
const required = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
const httpUrl = required("Website link", 2048).url().refine((s) => /^https?:\/\//i.test(s), "Use an http(s) link");
export const submissionSchema = z.object({
  name: required("Team name", 100),
  email: required("Team email", 255).email("Enter a valid team email"),
  project_title: required("Project title", 200),
  project_description: required("Project description", 10000),
  github_url: required("GitHub repository", 2048).url().refine((s) => /^https:\/\/(www\.)?github\.com\/[^/]+\/[^/?#]+\/?(?:[?#].*)?$/i.test(s), "Enter a GitHub repository link"),
  website_url: httpUrl,
});
export function validatePdf(file: { size: number; type: string; name: string } | null) {
  if (!file) throw new Error("Project PDF is required");
  if (file.size > MAX_PDF_BYTES) throw new Error("PDF must be no larger than 3 MB");
  if (file.size === 0 || !file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) throw new Error("Only PDF files are allowed");
}
export async function checkPdf(file: File) {
  validatePdf(file);
  if (await file.slice(0, 5).text() !== "%PDF-") throw new Error("The file is not a valid PDF");
}