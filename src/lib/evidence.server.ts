// Server-only evidence gathering. Never executes student code; only reads public files/pages.
const UA = { "User-Agent": "ProjectEvaluator/1.0" };
const MAX_FILE = 4000;
const MAX_TOTAL = 40000;

async function fetchText(url: string, init?: RequestInit, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "", headers: r.headers, url: r.url };
  } finally {
    clearTimeout(t);
  }
}

export async function gatherGithub(repoUrl: string): Promise<string | null> {
  const m = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  const owner = m[1]!;
  const repo = m[2]!.replace(/\.git$/, "");
  const headers: Record<string, string> = { ...UA, Accept: "application/vnd.github+json" };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const meta = await fetchText(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!meta.ok) throw new Error(meta.status === 403 ? "GitHub rate limit reached (add a GITHUB_TOKEN to raise it)" : `Repository not accessible (HTTP ${meta.status})`);
  const info = JSON.parse(meta.text);
  const branch = info.default_branch;
  const tree = await fetchText(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
  if (!tree.ok) throw new Error(`Could not list repository files (HTTP ${tree.status})`);
  const files: { path: string; size: number }[] = (JSON.parse(tree.text).tree ?? []).filter((f: any) => f.type === "blob");
  const skip = /(node_modules|dist|build|\.next|vendor|\.lock$|lock\.json$|\.min\.|\.(png|jpe?g|gif|svg|ico|woff2?|ttf|pdf|zip|mp4|webp)$)/i;
  const code = /\.(ts|tsx|js|jsx|py|java|go|rs|rb|php|cs|cpp|c|kt|swift|dart|vue|svelte|sql|html|css)$/i;
  const score = (p: string) =>
    (/^readme/i.test(p.split("/").pop()!) ? 100 : 0) +
    (/(package\.json|requirements\.txt|pyproject\.toml|pom\.xml|go\.mod|Cargo\.toml|Dockerfile)$/i.test(p) ? 60 : 0) +
    (/(^|\/)(src|app|lib|server|api|routes|components|pages)\//i.test(p) ? 20 : 0) +
    (/(auth|api|service|controller|model|route|main|index|app)\./i.test(p) ? 15 : 0) -
    p.split("/").length * 2;
  const picked = files
    .filter((f) => !skip.test(f.path) && (code.test(f.path) || score(f.path) >= 60) && f.size < 200000)
    .sort((a, b) => score(b.path) - score(a.path))
    .slice(0, 14);
  let out = `REPOSITORY: ${owner}/${repo}\nDescription: ${info.description ?? "-"}\nLanguage: ${info.language ?? "-"}\nStars: ${info.stargazers_count}\nLast push: ${info.pushed_at}\nTotal files: ${files.length}\n\nFILE TREE (first 150):\n${files.slice(0, 150).map((f) => f.path).join("\n")}\n`;
  for (const f of picked) {
    if (out.length > MAX_TOTAL) break;
    const raw = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`, { headers: UA });
    if (!raw.ok) continue;
    out += `\n===== FILE: ${f.path} =====\n${raw.text.slice(0, MAX_FILE)}${raw.text.length > MAX_FILE ? "\n...[truncated]" : ""}\n`;
  }
  return out.slice(0, MAX_TOTAL + 5000);
}

function strip(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const all = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => strip(m[1] ?? "")).filter(Boolean);

function describePage(url: string, html: string, ms: number, status: number) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
  const viewport = /<meta[^>]+name=["']viewport/i.test(html);
  const headings = all(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi).slice(0, 25);
  const buttons = all(html, /<button[^>]*>([\s\S]*?)<\/button>/gi).slice(0, 25);
  const forms = (html.match(/<form/gi) ?? []).length;
  const inputs = (html.match(/<input/gi) ?? []).length;
  const scripts = (html.match(/<script/gi) ?? []).length;
  const apiHints = [...new Set(html.match(/(fetch\(|axios|supabase|firebase|graphql|\/api\/)/gi) ?? [])].slice(0, 10);
  const text = strip(html).slice(0, 5000);
  return `PAGE ${url} (HTTP ${status}, ${ms}ms, ${html.length} bytes)\nTitle: ${title}\nMeta description: ${desc}\nViewport meta (mobile-ready): ${viewport}\nHeadings: ${headings.join(" | ")}\nButtons: ${buttons.join(" | ")}\nForms: ${forms}, inputs: ${inputs}, scripts: ${scripts}\nBackend/API hints in markup: ${apiHints.join(", ") || "none"}\nVisible text: ${text || "(none — likely a client-rendered app; content requires JavaScript)"}\n`;
}

export async function gatherWebsite(siteUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const t0 = Date.now();
  const home = await fetchText(url.href, { headers: UA });
  const ms = Date.now() - t0;
  if (!home.ok) throw new Error(`Website not reachable (HTTP ${home.status})`);
  let out = `NOTE: Static inspection of public pages only (no login, no JavaScript execution).\nSecure HTTPS: ${home.url.startsWith("https")}\n\n` + describePage(home.url, home.text, ms, home.status);
  const links = [...new Set([...home.text.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]!))]
    .map((h) => { try { return new URL(h, home.url); } catch { return null; } })
    .filter((u): u is URL => !!u && u.origin === new URL(home.url).origin && !/\.(css|js|png|jpe?g|svg|ico|json|xml|webp)$/i.test(u.pathname) && u.pathname !== new URL(home.url).pathname);
  const internal = [...new Map(links.map((l) => [l.pathname, l])).values()].slice(0, 3);
  out += `\nInternal links found: ${links.map((l) => l.pathname).slice(0, 30).join(", ") || "none"}\n`;
  for (const l of internal) {
    try {
      const s = Date.now();
      const p = await fetchText(l.href, { headers: UA }, 8000);
      out += "\n" + (p.ok ? describePage(l.href, p.text, Date.now() - s, p.status).slice(0, 2500) : `PAGE ${l.href}: HTTP ${p.status}\n`);
    } catch {
      out += `\nPAGE ${l.href}: failed to load\n`;
    }
  }
  return out.slice(0, 30000);
}
