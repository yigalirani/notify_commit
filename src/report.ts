import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";

type Kind = "ctx" | "add" | "del" | "none" | "hunk";

interface FileStat {
  add: number;
  del: number;
  path: string;
}

interface Cell {
  n: number;
  t: string;
  k: Kind;
}

interface Row {
  l: Cell;
  r: Cell;
}

interface FileDiff {
  path: string;
  rows: Row[];
}

const exec = promisify(execFile);

const empty: Cell = { n: 0, t: "", k: "none" };

const esc_map: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const css = `
  body { font: 16px system-ui, sans-serif; max-width: 1200px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { margin-bottom: .25rem; }
  .meta { color: #666; margin-bottom: 1.5rem; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
  pre { background: #f7f7f7; padding: 1rem; border-radius: 8px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; }
  .add { color: #1a7f37; } .del { color: #cf222e; }
  .diff { table-layout: fixed; font: 12px ui-monospace, monospace; border: 1px solid #ddd; }
  .diff col.n { width: 3rem; }
  .diff td { padding: 1px 6px; border: 0; vertical-align: top; }
  .code { white-space: pre-wrap; word-break: break-all; }
  .num { color: #888; text-align: right; user-select: none; }
  .c-del { background: #ffebe9; }
  .c-add { background: #e6ffec; }
  .c-none { background: #f6f6f6; }
  .hunk { background: #ddf4ff; color: #555; }
`;

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => esc_map[c] ?? c);

const git = async (args: string[]): Promise<string> => {
  const { stdout } = await exec("git", args, { maxBuffer: 64 * 1024 * 1024 });
  const ans = stdout.trim();
  return ans;
};

const parse_stats = (raw: string): FileStat[] => {
  const ans: FileStat[] = [];
  for (const line of raw.split("\n")) {
    const [a, d, path] = line.split("\t");
    if (a === undefined || d === undefined || path === undefined) continue;
    ans.push({ add: Number(a) || 0, del: Number(d) || 0, path });
  }
  return ans;
};

const parse_diff = (raw: string): FileDiff[] => {
  const ans: FileDiff[] = [];
  let cur: FileDiff | undefined;
  let in_hunk = false;
  let dels: Cell[] = [];
  let adds: Cell[] = [];
  let ln = 0;
  let rn = 0;

  const flush = (): void => {
    if (!cur) return;
    const { rows } = cur;
    const len = Math.max(dels.length, adds.length);
    for (let i = 0; i < len; i++) {
      rows.push({ l: dels[i] ?? empty, r: adds[i] ?? empty });
    }
    dels = [];
    adds = [];
  };

  for (const line of raw.split("\n")) {
    if (line.startsWith("diff --git")) {
      flush();
      in_hunk = false;
      cur = { path: line.split(" b/")[1] ?? "", rows: [] };
      ans.push(cur);
      continue;
    }
    if (!cur) continue;
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (m) {
      flush();
      in_hunk = true;
      ln = Number(m[1]);
      rn = Number(m[2]);
      const { rows } = cur;
      rows.push({ l: { n: 0, t: line, k: "hunk" }, r: empty });
      continue;
    }
    if (!in_hunk) continue;
    const t = line.slice(1);
    if (line.startsWith("-")) {
      dels.push({ n: ln++, t, k: "del" });
      continue;
    }
    if (line.startsWith("+")) {
      adds.push({ n: rn++, t, k: "add" });
      continue;
    }
    if (line.startsWith(" ")) {
      flush();
      const { rows } = cur;
      rows.push({ l: { n: ln++, t, k: "ctx" }, r: { n: rn++, t, k: "ctx" } });
    }
  }
  flush();
  return ans;
};

const render_cell = (c: Cell): string => {
  const { n, t, k } = c;
  const ans = `<td class="num c-${k}">${n || ""}</td><td class="code c-${k}">${esc(t)}</td>`;
  return ans;
};

const render_diff = (d: FileDiff): string => {
  const { path, rows } = d;
  let body = "";
  for (const { l, r } of rows) {
    const { k, t } = l;
    body +=
      k === "hunk"
        ? `<tr><td class="hunk" colspan="4">${esc(t)}</td></tr>`
        : `<tr>${render_cell(l)}${render_cell(r)}</tr>`;
  }
  const ans = `<h3>${esc(path)}</h3>
<table class="diff"><colgroup><col class="n"><col><col class="n"><col></colgroup>${body}</table>`;
  return ans;
};

const build_html = (meta: string[], files: FileStat[], diffs: FileDiff[])=> {
  const [hash = "", name = "", mail = "", date = "", subj = "", body = ""] = meta;
  let rows = "";
  let add = 0;
  let del = 0;
  for (const f of files) {
    add += f.add;
    del += f.del;
    rows += `<tr><td>${esc(f.path)}</td><td class="add">+${f.add}</td><td class="del">-${f.del}</td></tr>`;
  }
  let diff_html = "";
  for (const d of diffs) {
    if (d.rows.length > 0) diff_html += render_diff(d);
  }
  const description=esc(subj)
  const content = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(subj)}</title><style>${css}</style></head>
<body>
  <h3>description</h3>
  ${description}
  <div class="meta">
    <code>${esc(hash.slice(0, 8))}</code> by ${esc(name)} &lt;${esc(mail)}&gt;
    on ${esc(new Date(date).toLocaleString())}
  </div>
  ${body ? `<pre>${esc(body)}</pre>` : ""}
  <h3>${files.length} files changed, <span class="add">+${add}</span> <span class="del">-${del}</span></h3>
  <table><tr><th>File</th><th>Added</th><th>Removed</th></tr>${rows}</table>
  <h3>Diff</h3>
  ${diff_html}
</body></html>`;
return {content,description}
};

export const run_report = async ()=> {
  const [meta, stat, diff] = await Promise.all([
    git(["log", "-1", "--format=%H%x00%an%x00%ae%x00%aI%x00%s%x00%b"]),
    git(["show", "--numstat", "--format=", "HEAD"]),
    git(["show", "-U2", "--format=", "HEAD"]),
  ]);
  const ans = build_html(meta.split("\0"), parse_stats(stat), parse_diff(diff));
  await writeFile("report.html", ans.content);
  console.log("Wrote report.html");
  return ans
};

/*main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
*/