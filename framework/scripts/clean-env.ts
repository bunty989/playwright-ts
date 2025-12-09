import * as fs from "fs";
import * as path from "path";
import os from "os";

const DEFAULT_ENV_PATH = path.join(__dirname, "../../allure-results/environment.properties");

const NORMALIZATION_MAP: { regex: RegExp; normalized: string }[] = [
  { regex: /^BrowserVersion.*/i, normalized: "BrowserVersion" },
];

function normalizeKey(key: string): string {
  for (const rule of NORMALIZATION_MAP) {
    if (rule.regex.test(key)) return rule.normalized;
  }
  return key;
}

function parseLine(line: string): { key?: string; value?: string; sep?: string } {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) {
    return {};
  }

  const eqIdx = line.indexOf("=");
  const colonIdx = line.indexOf(":");
  let sepIdx = -1;
  if (eqIdx >= 0 && colonIdx >= 0) sepIdx = Math.min(eqIdx, colonIdx);
  else if (eqIdx >= 0) sepIdx = eqIdx;
  else if (colonIdx >= 0) sepIdx = colonIdx;

  if (sepIdx === -1) return {};

  const key = line.slice(0, sepIdx).trim();
  const value = line.slice(sepIdx + 1);
  const sep = line[sepIdx];
  return { key, value, sep };
}


function extractVersionComponents(val: string): number[] | null {
  if (!val) return null;
  const m = val.match(/\d+(?:\.\d+)*/);
  if (!m) return null;
  const parts = m[0].split(".").map(p => {
    const n = Number(p);
    return Number.isNaN(n) ? 0 : n;
  });
  return parts;
}


function compareVersionArrays(a: number[], b: number[]): number {
  const la = a.length, lb = b.length;
  const L = Math.max(la, lb);
  for (let i = 0; i < L; i++) {
    const na = i < la ? a[i] : 0;
    const nb = i < lb ? b[i] : 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}


function chooseCollapsedValue(values: string[], normalizedKey: string): string {
  if (values.length === 0) return "";

  if (normalizedKey === "BrowserVersion") {
    let bestIdx = -1;
    let bestVer: number[] | null = null;

    values.forEach((v, i) => {
      const comps = extractVersionComponents(v);
      if (comps) {
        if (bestVer === null || compareVersionArrays(comps, bestVer) === 1) {
          bestVer = comps;
          bestIdx = i;
        }
      }
    });

    if (bestIdx !== -1) {
      return values[bestIdx].trim();
    }

    return values[values.length - 1].trim();
  }

  return values[values.length - 1].trim();
}

function makeBackup(filePath: string) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `${base}.backup.${stamp}`;
  const backupPath = path.join(dir, backupName);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function cleanEnvironmentFile(envFilePath: string) {
  if (!fs.existsSync(envFilePath)) {
    console.error("❌ environment.properties not found:", envFilePath);
    process.exitCode = 2;
    return;
  }

  const raw = fs.readFileSync(envFilePath, "utf8");
  const lines = raw.split(/\r?\n/);

  const normalizedBuckets = new Map<
    string,
    { values: string[]; sep: string; rawKeys: string[] }
  >();

  const meta: { line: string; parsed: ReturnType<typeof parseLine> }[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    meta.push({ line, parsed });

    if (!parsed.key) continue;

    const normKey = normalizeKey(parsed.key);
    const bucket = normalizedBuckets.get(normKey) ?? { values: [], sep: parsed.sep ?? "=", rawKeys: [] };
    bucket.values.push((parsed.value ?? "").toString());
    bucket.sep = parsed.sep ?? bucket.sep; 
    bucket.rawKeys.push(parsed.key);
    normalizedBuckets.set(normKey, bucket);
  }

  const chosenMap = new Map<string, { value: string; sep: string }>();
  for (const [k, v] of normalizedBuckets) {
    const chosen = chooseCollapsedValue(v.values, k);
    chosenMap.set(k, { value: chosen, sep: v.sep });
  }

  const emittedKeys = new Set<string>();
  const outputPieces: string[] = [];

  for (const { line, parsed } of meta) {
    if (!parsed.key) {
      outputPieces.push(line);
      continue;
    }

    const normKey = normalizeKey(parsed.key);
    if (emittedKeys.has(normKey)) {
      continue;
    }

    const chosen = chosenMap.get(normKey);
    if (!chosen) {
      outputPieces.push(line);
      emittedKeys.add(normKey);
      continue;
    }

    const outLine = `${normKey}${chosen.sep}${chosen.value}`.replace(/\s+$/u, "");
    outputPieces.push(outLine);
    emittedKeys.add(normKey);
  }

  for (const [k, val] of chosenMap) {
    if (!emittedKeys.has(k)) {
      outputPieces.push(`${k}${val.sep}${val.value}`);
      emittedKeys.add(k);
    }
  }

  const backup = makeBackup(envFilePath);
  try {
    const fd = fs.openSync(envFilePath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR, 0o600);
    fs.writeFileSync(fd, outputPieces.join(os.EOL), "utf8");
  } catch (error) {
    // fs.writeFileSync(envFilePath, outputPieces.join(os.EOL), "utf8");
  }

  console.log("✔ Cleaned environment.properties — duplicates collapsed.");
  console.log(`Backup written to: ${backup}`);
}

function main() {
  try {
    const cliPath = process.argv[2];
    const envPath = cliPath ? path.resolve(process.cwd(), cliPath) : DEFAULT_ENV_PATH;
    cleanEnvironmentFile(envPath);
  } catch (err: any) {
    console.error("Error:", err?.message ?? err);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
