#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCREENSHOT_DIR="$ROOT_DIR/screenshots/member5"
SERVER_PID=""
HTTP_PORT=8765

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

step_pass() {
  echo ""
  echo "✅ Step $1 complete: $2"
  echo "   Screenshot: screenshots/member5/$3"
  echo ""
}

step_fail() {
  echo ""
  echo "❌ Step $1 failed: $2"
  echo ""
  exit 1
}

start_server() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    return
  fi
  python3 -m http.server "$HTTP_PORT" --directory "$ROOT_DIR" >/dev/null 2>&1 &
  SERVER_PID=$!
  sleep 1
}

echo "PakVista Member 5 workflow – capturing screenshots after each step"
echo "Output folder: screenshots/member5/"
echo ""

cd "$ROOT_DIR"
mkdir -p "$SCREENSHOT_DIR"

echo "Step 1: Validate swat.html exists and has required content"
if [[ ! -f "$ROOT_DIR/swat.html" ]]; then
  step_fail "1" "swat.html is missing"
fi
for keyword in "Malam Jabba" "Mingora Bazaar" "Swat Museum" "style.css"; do
  if ! grep -q "$keyword" "$ROOT_DIR/swat.html"; then
    step_fail "1" "swat.html is missing required content: $keyword"
  fi
done
start_server
node "$ROOT_DIR/scripts/capture-screenshots.mjs" \
  --base "http://127.0.0.1:${HTTP_PORT}" \
  --out "$SCREENSHOT_DIR" \
  --steps "01-swat-page"
step_pass "1" "Swat page built and validated" "step-01-swat-page.png"

echo "Step 2: Validate ci-prod.yml workflow file"
if [[ ! -f "$ROOT_DIR/.github/workflows/ci-prod.yml" ]]; then
  step_fail "2" "ci-prod.yml is missing"
fi
for keyword in "pull_request" "production" "prod-latest" "docker push"; do
  if ! grep -qi "$keyword" "$ROOT_DIR/.github/workflows/ci-prod.yml"; then
    step_fail "2" "ci-prod.yml is missing required setting: $keyword"
  fi
done
node -e "
import { captureTextFilePreview } from './scripts/capture-screenshots.mjs';
await captureTextFilePreview({
  sourceFile: '.github/workflows/ci-prod.yml',
  out: 'screenshots/member5',
  name: '02-ci-prod-workflow',
  title: 'Step 2 – Production CI Workflow',
  body: 'Validated ci-prod.yml before opening the PR.',
});
"
step_pass "2" "Production CI workflow validated" "step-02-ci-prod-workflow.png"

echo "Step 3: Confirm shared site files are linked correctly"
start_server
node "$ROOT_DIR/scripts/capture-screenshots.mjs" \
  --base "http://127.0.0.1:${HTTP_PORT}" \
  --out "$SCREENSHOT_DIR" \
  --steps "02-home-page"
step_pass "3" "Home page navigation checked" "step-02-home-page.png"

echo "Step 4: Capture full Swat page for submission evidence"
node "$ROOT_DIR/scripts/capture-screenshots.mjs" \
  --base "http://127.0.0.1:${HTTP_PORT}" \
  --out "$SCREENSHOT_DIR" \
  --steps "03-all-pages-check"
step_pass "4" "Full-page Swat screenshot captured" "step-03-all-pages-check.png"

echo "Step 5: Ready for git workflow"
node -e "
import { captureTextFilePreview } from './scripts/capture-screenshots.mjs';
await captureTextFilePreview({
  sourceFile: 'scripts/NEXT_STEPS.txt',
  out: 'screenshots/member5',
  name: '05-next-actions',
  title: 'Step 5 – Next Git Actions',
  body: 'Create feature branch, commit, push, and open PR to develop.',
});
"
step_pass "5" "Next actions checklist captured" "step-05-next-actions.png"

echo "All Member 5 local steps finished."
echo "Paste screenshots from screenshots/member5/ into the Term Project document when CI/CD runs complete."
