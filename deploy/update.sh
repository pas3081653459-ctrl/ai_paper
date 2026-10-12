#!/bin/bash
# One-command update for Channel Lab on the server:
#   /home/ubuntu/channel_lab_deploy/update.sh          (skips if already deployed at origin HEAD)
#   FORCE=1 /home/ubuntu/channel_lab_deploy/update.sh  (rebuild + redeploy anyway)
# Steps: git pull (retries) -> npm ci/build -> sync code -> tag prev-<ts> -> build (Dockerfile.code-update)
#        -> test container :8001 + smoke test (with site login) -> swap via run.sh -> auto rollback on failure.
set -euo pipefail
REPO=/home/ubuntu/ai_paper_repo
BUILD=/home/ubuntu/channel_lab_deploy
PAPERS=/home/ubuntu/channel_lab_papers
SECRETS=/home/ubuntu/channel_lab_secrets.env
BRANCH=${BRANCH:-main}
TS=$(date +%Y%m%d%H%M%S)
T0=$(date +%s)
LOG=$BUILD/logs/update-$TS.log
mkdir -p "$BUILD/logs" "$PAPERS"
exec 9>"$BUILD/.update.lock"; flock -n 9 || { echo "another update is running"; exit 1; }
exec > >(tee -a "$LOG") 2>&1
step() { echo "== [$(( $(date +%s) - T0 ))s] $*"; }
retry() { local n=0; until "$@"; do n=$((n+1)); [ $n -ge ${RETRIES:-6} ] && return 1; echo "retry $n: $*"; sleep $((n*3)); done; }

# Smoke request with site login; credentials go to curl via stdin config, never argv/logs.
auth_curl() {  # auth_curl URL -> prints HTTP code
  local u p
  u=$(sed -n 's/^CHANNEL_LAB_SITE_USER=//p' "$SECRETS" | tail -1); p=$(sed -n 's/^CHANNEL_LAB_SITE_PASSWORD=//p' "$SECRETS" | tail -1)
  printf 'user = "%s:%s"\n' "${u:-pas}" "$p" | curl -s -o /dev/null -w '%{http_code}' -m 20 -K - "$1"
}
wait_health() {  # wait_health PORT
  for i in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:$1/api/health")" = 200 ] && return 0; sleep 2
  done; return 1
}
smoke() {  # smoke PORT
  local h r p
  wait_health "$1" || { echo "health failed"; return 1; }
  h=$(auth_curl "http://127.0.0.1:$1/"); r=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://127.0.0.1:$1/")
  p=$(auth_curl "http://127.0.0.1:$1/api/models" )
  echo "health=200 home(auth)=$h home(noauth)=$r api(auth)=$p"
  [ "$h" = 200 ] && [ "$p" = 200 ] || return 1
  if grep -q '^CHANNEL_LAB_SITE_PASSWORD=.' "$SECRETS"; then [ "$r" = 401 ] || return 1; fi
}

step "git pull $REPO ($BRANCH)"
cd "$REPO"
git config http.version HTTP/1.1
OLD=$(git rev-parse HEAD)
# GitHub from this server is flaky (connect timeouts, HTTP/2 resets): bound each try, then retry.
PULLNOTE=""
if retry timeout 90 git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=20 fetch --depth 50 origin "$BRANCH"; then
  git merge --ff-only FETCH_HEAD
else
  PULLNOTE=" WARNING: GitHub unreachable, used existing checkout"; echo "$PULLNOTE"
  [ "${FORCE:-0}" = 1 ] || { echo "SUMMARY: git pull failed after retries; nothing deployed. Re-run later (or FORCE=1 to redeploy the current checkout)."; exit 1; }
fi
NEW=$(git rev-parse --short HEAD)
DEPLOYED=$(cat "$BUILD/.deployed_commit" 2>/dev/null || true)
echo "checkout $(git rev-parse --short "$OLD") -> $NEW ; deployed: ${DEPLOYED:-none}"
if [ "${FORCE:-0}" != 1 ] && [ "$DEPLOYED" = "$NEW" ] && sudo docker ps --format '{{.Names}}' | grep -qx channel-lab; then
  echo "SUMMARY: already deployed at $NEW, nothing to do (FORCE=1 to rebuild). $(( $(date +%s) - T0 ))s"; exit 0
fi

step "frontend: npm ci + build"
cd "$REPO/channel_lab/frontend"
LOCKSUM=$(sha256sum package-lock.json | cut -c1-16)
if [ ! -d node_modules ] || [ "$(cat node_modules/.locksum 2>/dev/null)" != "$LOCKSUM" ]; then
  retry npm ci --no-audit --no-fund && echo "$LOCKSUM" > node_modules/.locksum
else echo "node_modules up to date (lockfile unchanged), skipping npm ci"; fi
npm run build

step "papers: sync manifests into $PAPERS (PDFs kept there persistently)"
rsync -a --exclude '*.pdf' dist/papers/ "$PAPERS/" 2>/dev/null || true
echo "$(ls "$PAPERS"/*.pdf 2>/dev/null | wc -l) PDFs in $PAPERS"

step "sync code -> $BUILD"
rsync -a --delete --exclude node_modules --exclude models --exclude experiment_runs --exclude __pycache__ \
  --exclude 'frontend/public/papers/*.pdf' --exclude 'frontend/dist/papers/*.pdf' \
  "$REPO/channel_lab/" "$BUILD/channel_lab/"
for f in Dockerfile Dockerfile.code-update Dockerfile.dockerignore run.sh update.sh requirements-docker.txt fetch_wheels.sh; do
  [ -f "$REPO/deploy/$f" ] && install -m 755 "$REPO/deploy/$f" "$BUILD/$f"
done
cp "$BUILD/Dockerfile.dockerignore" "$BUILD/.dockerignore"

step "tag current image as channel-lab:prev-$TS and build channel-lab:$TS"
PREV=channel-lab:prev-$TS
sudo docker tag channel-lab:latest "$PREV"
sudo docker build -q -f "$BUILD/Dockerfile.code-update" --label "commit=$NEW" -t "channel-lab:$TS" "$BUILD"

step "test container on 127.0.0.1:8001"
cleanup_test() { sudo docker rm -f channel-lab-test >/dev/null 2>&1 || true; }
trap cleanup_test EXIT
NAME=channel-lab-test PORT=127.0.0.1:8001 RESTART=no sh "$BUILD/run.sh" "channel-lab:$TS" >/dev/null
if ! smoke 8001; then
  sudo docker logs --tail 40 channel-lab-test || true
  echo "SUMMARY: FAILED smoke test on :8001; production untouched (still $PREV). $(( $(date +%s) - T0 ))s"; exit 1
fi
cleanup_test

step "swap production container"
sudo docker tag "channel-lab:$TS" channel-lab:latest
TSWAP=$(date +%s)
sh "$BUILD/run.sh" channel-lab:latest >/dev/null
if smoke 80; then
  echo "$NEW" > "$BUILD/.deployed_commit"
  echo "SUMMARY: deployed $NEW as channel-lab:$TS (latest); rollback image $PREV; swap ${DOWN:-$(( $(date +%s) - TSWAP ))}s; total $(( $(date +%s) - T0 ))s; log $LOG$PULLNOTE"
else
  echo "swap failed, rolling back to $PREV"
  sudo docker tag "$PREV" channel-lab:latest
  sh "$BUILD/run.sh" channel-lab:latest >/dev/null; wait_health 80 && echo "rolled back OK" || echo "ROLLBACK ALSO FAILED"
  echo "SUMMARY: FAILED swap, rolled back to $PREV. $(( $(date +%s) - T0 ))s"; exit 1
fi
