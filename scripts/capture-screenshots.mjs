import { chromium } from "playwright";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {
    base: "http://127.0.0.1:8765",
    out: path.join(rootDir, "screenshots"),
    steps: [],
    file: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") {
      options.base = argv[++i];
    } else if (arg === "--out") {
      options.out = path.resolve(argv[++i]);
    } else if (arg === "--steps") {
      options.steps = argv[++i].split(",").map((step) => step.trim()).filter(Boolean);
    } else if (arg === "--file") {
      options.file = path.resolve(argv[++i]);
    } else if (arg === "--name") {
      options.name = argv[++i];
    }
  }

  return options;
}

const defaultSteps = [
  {
    id: "01-swat-page",
    label: "Swat destination page rendered in browser",
    url: "/swat.html",
  },
  {
    id: "02-home-page",
    label: "Home page with Swat navigation link",
    url: "/index.html",
  },
  {
    id: "03-all-pages-check",
    label: "Swat page full scroll capture",
    url: "/swat.html",
    fullPage: true,
  },
];

export async function captureScreenshots({ base, out, steps = defaultSteps }) {
  await mkdir(out, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const saved = [];

  for (const step of steps) {
    const target = new URL(step.url, base).toString();
    await page.goto(target, { waitUntil: "networkidle" });
    const filePath = path.join(out, `step-${step.id}.png`);
    await page.screenshot({ path: filePath, fullPage: Boolean(step.fullPage) });
    saved.push({ ...step, filePath, target });
    console.log(`[screenshot] ${step.id} -> ${filePath}`);
  }

  await browser.close();
  return saved;
}

export async function captureHtmlFile({ html, out, name }) {
  await mkdir(out, { recursive: true });
  const tempName = `_screenshot-${name}.html`;
  const tempPath = path.join(rootDir, tempName);

  await writeFile(tempPath, html, "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const target = `file://${tempPath}`;
  await page.goto(target, { waitUntil: "networkidle" });
  const filePath = path.join(out, `step-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  await browser.close();
  await unlink(tempPath);

  console.log(`[screenshot] ${name} -> ${filePath}`);
  return filePath;
}

export async function captureTextFilePreview({ sourceFile, out, name, title, body }) {
  const { readFile } = await import("node:fs/promises");
  const escaped = (await readFile(sourceFile, "utf8"))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f7f7f7; color: #222; }
    .card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    h1 { color: #006400; margin-top: 0; }
    pre { background: #111; color: #f5f5f5; padding: 16px; border-radius: 8px; overflow: auto; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <pre>${escaped}</pre>
  </div>
</body>
</html>`;

  return captureHtmlFile({ html, out, name });
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const options = parseArgs(process.argv);

  if (options.file) {
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(options.file, "utf8");
    await captureHtmlFile({
      html,
      out: options.out,
      name: options.name || "preview",
    });
  } else {
    const steps = options.steps.length
      ? defaultSteps.filter((step) => options.steps.includes(step.id))
      : defaultSteps;

    await captureScreenshots({ base: options.base, out: options.out, steps });
  }
}
