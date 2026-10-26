/**
 * Compare address-search providers on real Udaipur addresses.
 *
 *   npm run geocoder:compare -- data/udaipur-addresses.csv            # run every provider that has a key
 *   npm run geocoder:compare -- data/udaipur-addresses.csv --raw      # also print the first raw answer of each provider
 *   npm run geocoder:compare -- data/udaipur-addresses.csv --reverse  # also look up each row that has lat,lng
 *
 * CSV columns: address (required), lat, lng (optional: the true spot, copied from a Google Maps pin).
 * With lat,lng the report measures how far each provider's best answer is from the truth; without them it lists the answers
 * so a person can judge them. Providers: nominatim (free OpenStreetMap, always on), ola (needs OLA_MAPS_API_KEY),
 * google (needs GOOGLE_MAPS_API_KEY). Keys come from .env and are never printed or saved. About 30-60 calls per provider.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { distanceMeters, insideUdaipurBounds } from "../src/lib/geo";
import { NominatimGeocoder, type GeocodeResult, type Geocoder } from "../src/server/geo/geocoder";
import { GoogleGeocoder, OlaGeocoder } from "../src/server/geo/providers";

config({ override: true });

interface Row {
  address: string;
  lat: number | null;
  lng: number | null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(cell);
      cell = "";
      if (cur.some((c) => c.trim() !== "")) rows.push(cur);
      cur = [];
    } else cell += ch;
  }
  cur.push(cell);
  if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  return rows;
}

function readRows(path: string): Row[] {
  const rows = parseCsv(readFileSync(path, "utf-8").replace(/^﻿/, ""));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const ia = header.indexOf("address");
  if (ia < 0) throw new Error('The first line of the CSV must be a header with an "address" column (and optionally "lat" and "lng")');
  const il = header.indexOf("lat");
  const ig = header.indexOf("lng");
  const num = (v: string | undefined) => (v && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  return rows
    .map((r) => ({ address: (r[ia] ?? "").trim(), lat: il >= 0 ? num(r[il]) : null, lng: ig >= 0 ? num(r[ig]) : null }))
    .filter((r) => r.address.length >= 3)
    .slice(0, 100);
}

interface Provider {
  name: string;
  geo: Geocoder;
}

function providers(): { run: Provider[]; skipped: string[] } {
  const run: Provider[] = [{ name: "nominatim", geo: new NominatimGeocoder() }];
  const skipped: string[] = [];
  if (process.env.OLA_MAPS_API_KEY) run.push({ name: "ola", geo: new OlaGeocoder(process.env.OLA_MAPS_API_KEY) });
  else skipped.push("ola (no OLA_MAPS_API_KEY in .env)");
  if (process.env.GOOGLE_MAPS_API_KEY) run.push({ name: "google", geo: new GoogleGeocoder(process.env.GOOGLE_MAPS_API_KEY) });
  else skipped.push("google (no GOOGLE_MAPS_API_KEY in .env)");
  return { run, skipped };
}

interface Outcome {
  results: GeocodeResult[];
  ms: number;
}

const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] : null);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");

async function printRaw(name: string, address: string): Promise<void> {
  // Only for checking the shape of an answer: the key is added here and never printed.
  const q = encodeURIComponent(`${address}, Udaipur, Rajasthan`);
  const url =
    name === "ola"
      ? `https://api.olamaps.io/places/v1/geocode?address=${q}&api_key=${encodeURIComponent(process.env.OLA_MAPS_API_KEY ?? "")}`
      : name === "google"
        ? `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&components=country:IN&key=${encodeURIComponent(process.env.GOOGLE_MAPS_API_KEY ?? "")}`
        : `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=2&q=${q}`;
  const res = await fetch(url, { headers: { "User-Agent": process.env.GEOCODER_USER_AGENT ?? "HariHaat-dev/0.1" } });
  const text = await res.text();
  console.log(`\n--- raw ${name} answer (HTTP ${res.status}) for "${address}" ---\n${text.slice(0, 1800)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: npm run geocoder:compare -- <addresses.csv> [--raw] [--reverse]");
  const raw = args.includes("--raw");
  const reverse = args.includes("--reverse");
  const rows = readRows(file);
  const { run, skipped } = providers();
  console.log(`${rows.length} addresses · providers: ${run.map((p) => p.name).join(", ")}${skipped.length ? ` · skipped: ${skipped.join("; ")}` : ""}`);

  const table: Array<{ row: Row; by: Record<string, Outcome> }> = [];
  for (const row of rows) {
    const by: Record<string, Outcome> = {};
    for (const p of run) {
      const t0 = Date.now();
      const results = await p.geo.search(row.address);
      by[p.name] = { results, ms: Date.now() - t0 };
      await new Promise((r) => setTimeout(r, 150));
    }
    table.push({ row, by });
    process.stdout.write(".");
  }
  console.log("");
  if (raw && rows[0]) for (const p of run) await printRaw(p.name, rows[0].address);

  // ---- report
  const withTruth = table.filter((t) => t.row.lat !== null && t.row.lng !== null);
  const lines: string[] = [];
  lines.push(`# Address search comparison`, ``, `${rows.length} addresses (${withTruth.length} with a known true spot). Providers: ${run.map((p) => p.name).join(", ")}.`, skipped.length ? `Not run: ${skipped.join("; ")}.` : "", ``);

  lines.push(`## Summary`, ``, `| Provider | Found something | Inside Udaipur | Median time | Median error | Within 100 m | Within 300 m | Within 1 km |`, `|---|---|---|---|---|---|---|---|`);
  for (const p of run) {
    const outs = table.map((t) => t.by[p.name]);
    const found = outs.filter((o) => o.results.length > 0).length;
    const inside = outs.filter((o) => o.results[0] && insideUdaipurBounds(o.results[0])).length;
    const errs = withTruth.flatMap((t) => {
      const top = t.by[p.name].results[0];
      return top ? [distanceMeters({ lat: t.row.lat!, lng: t.row.lng! }, top)] : [];
    });
    const n = withTruth.length;
    lines.push(`| ${p.name} | ${pct(found, rows.length)} | ${pct(inside, rows.length)} | ${median(outs.map((o) => o.ms)) ?? "–"} ms | ${errs.length ? `${median(errs)} m` : "–"} | ${pct(errs.filter((e) => e <= 100).length, n)} | ${pct(errs.filter((e) => e <= 300).length, n)} | ${pct(errs.filter((e) => e <= 1000).length, n)} |`);
  }
  lines.push(``, `"Within" counts addresses whose best answer is that close to the true spot, out of the addresses that have one. A provider that found nothing counts as a miss.`, ``);

  // When two or more providers answer, how far apart are their best answers? Useful when there is no true spot to measure against:
  // answers that agree are probably right, answers that are kilometres apart mean at least one is wrong.
  if (run.length >= 2) {
    const gaps = table.flatMap((t) => {
      const tops = run.map((p) => t.by[p.name].results[0]).filter((r): r is GeocodeResult => !!r);
      if (tops.length < 2) return [];
      let max = 0;
      for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) max = Math.max(max, distanceMeters(tops[i], tops[j]));
      return [max];
    });
    lines.push(`## Do the providers agree?`, ``, `Addresses where at least two providers answered: ${gaps.length} of ${rows.length}. Median gap between the two furthest-apart answers: ${median(gaps) ?? "–"} m. Within 300 m of each other: ${pct(gaps.filter((g) => g <= 300).length, gaps.length)}. More than 2 km apart: ${gaps.filter((g) => g > 2000).length}.`, ``);
  }

  lines.push(`## Address by address`, ``);
  for (const t of table) {
    lines.push(`### ${t.row.address}`);
    for (const p of run) {
      const o = t.by[p.name];
      const top = o.results[0];
      const err = top && t.row.lat !== null && t.row.lng !== null ? ` · ${distanceMeters({ lat: t.row.lat, lng: t.row.lng! }, top)} m from the true spot` : "";
      lines.push(`- **${p.name}**: ${top ? `${short(top.displayName)} (${top.lat.toFixed(5)}, ${top.lng.toFixed(5)})${err}` : "no answer"} · ${o.results.length} result${o.results.length === 1 ? "" : "s"} · ${o.ms} ms`);
    }
    lines.push("");
  }

  if (reverse) {
    lines.push(`## Pin to address (reverse lookup)`, ``);
    for (const t of withTruth) {
      lines.push(`### ${t.row.address} (${t.row.lat}, ${t.row.lng})`);
      for (const p of run) {
        const r = await p.geo.reverse(t.row.lat!, t.row.lng!);
        lines.push(`- **${p.name}**: ${r ? short(r.displayName, 110) : "no answer"}`);
        await new Promise((x) => setTimeout(x, 150));
      }
      lines.push("");
    }
  }

  mkdirSync("reports", { recursive: true });
  const out = `reports/geocoder-compare-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`;
  writeFileSync(out, lines.join("\n"));
  console.log(lines.slice(0, 12).join("\n"));
  console.log(`\nFull report: ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
