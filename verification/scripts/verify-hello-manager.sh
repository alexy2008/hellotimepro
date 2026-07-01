#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
WEB_PID=""

cleanup() {
  if [[ -n "${WEB_PID}" ]]; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
    wait "${WEB_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -x "${TMP}/scripts/hello" ]]; then
    "${TMP}/scripts/hello" stop fastapi >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP}"
}
trap cleanup EXIT

read -r API_PORT PROXY_PORT WEB_PORT < <(python3 - <<'PY'
import socket

ports = []
for _ in range(3):
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    ports.append(s.getsockname()[1])
    s.close()
print(*ports)
PY
)

mkdir -p "${TMP}/scripts" "${TMP}/backends/fastapi" "${TMP}/data"
cp "${ROOT}/scripts/hello" "${TMP}/scripts/hello"
cp "${ROOT}/scripts/hello-ui.html" "${TMP}/scripts/hello-ui.html"
chmod +x "${TMP}/scripts/hello"

API_PORT="${API_PORT}" PROXY_PORT="${PROXY_PORT}" python3 - "${TMP}/scripts/hello" <<'PY'
import os
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
text = re.sub(r'("fastapi":\s*\{"dir":\s*"backends/fastapi",\s*"port":\s*)29010', rf'\g<1>{os.environ["API_PORT"]}', text)
text = re.sub(r"PROXY_PORT = 9080", f'PROXY_PORT = {os.environ["PROXY_PORT"]}', text)
path.write_text(text)
PY

cat > "${TMP}/backends/fastapi/run" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
exec python3 - <<'PY'
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = __API_PORT__

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path == "/api/v1/health":
            body = {
                "success": True,
                "data": {
                    "status": "ok",
                    "service": "hellotime-pro",
                    "version": "test",
                    "uptimeSeconds": 1,
                    "stack": {
                        "summary": "dummy",
                        "items": [
                            {"role": "framework", "name": "Dummy", "version": "1"}
                        ],
                    },
                },
            }
            raw = json.dumps(body).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        self.send_response(404)
        self.end_headers()

ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
PY
SH
python3 - "${TMP}/backends/fastapi/run" "${API_PORT}" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
path.write_text(path.read_text().replace("__API_PORT__", sys.argv[2]))
PY
chmod +x "${TMP}/backends/fastapi/run"

python3 - "${TMP}/data/.hello-state.json" <<'PY'
import json
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(json.dumps({
    "processes": {},
    "proxy_target": None,
    "proxy_pid": None,
    "db_driver": "postgres",
    "db_config": {
        "pg_host": "127.0.0.1",
        "pg_port": 5432,
        "pg_db": "hellotime_pro",
        "pg_user": "tester",
        "pg_pass": "secret",
        "sqlite_path": "data/sqlite/hellotime.db",
    },
    "llm_config": {
        "enabled": False,
        "provider": "openai",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-test",
        "model": "test-model",
        "timeout_ms": 30000,
    },
}, indent=2))
PY

HELLO="${TMP}/scripts/hello"
HELLO_START_WAIT_SECONDS=5 "${HELLO}" start fastapi >/tmp/hello-manager-start.log
"${HELLO}" status >/tmp/hello-manager-status.log

"${HELLO}" web --port "${WEB_PORT}" --no-open >/tmp/hello-manager-web.log 2>&1 &
WEB_PID="$!"

WEB_PORT="${WEB_PORT}" PROXY_PORT="${PROXY_PORT}" python3 - <<'PY'
import json
import os
import time
import urllib.request

base = f"http://127.0.0.1:{os.environ['WEB_PORT']}"

def fetch_json(path, data=None):
    raw = None
    headers = {}
    if data is not None:
        raw = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=raw, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=5) as res:
        return json.loads(res.read().decode())

for _ in range(30):
    try:
        snap = fetch_json("/api/snapshot")["data"]
        break
    except Exception:
        time.sleep(0.1)
else:
    raise SystemExit("web ui did not start")

assert snap["db_config"]["pg_pass_configured"] is True
assert "pg_pass" not in snap["db_config"]
fastapi = next(s for s in snap["stacks"] if s["name"] == "fastapi")
assert fastapi["status"] == "ready", fastapi
assert "cpu_percent" in fastapi, fastapi
assert "memory_rss_kb" in fastapi, fastapi
assert "process_count" in fastapi, fastapi
assert fastapi["memory_rss_kb"] is not None and fastapi["memory_rss_kb"] > 0, fastapi

res = fetch_json("/api/db-config", {"pg_pass": ""})["result"]
assert res["ok"], res
snap = fetch_json("/api/snapshot")["data"]
assert snap["db_config"]["pg_pass_configured"] is True

res = fetch_json("/api/switch", {"backend": "fastapi"})["result"]
assert res["ok"], res
snap = fetch_json("/api/snapshot")["data"]
assert snap["proxy"]["port"] == int(os.environ["PROXY_PORT"])
assert snap["proxy"]["ok"] is True, snap["proxy"]

health = fetch_json("/api/health/fastapi")["data"]
assert health["ok"] is True, health

res = fetch_json("/api/db-config", {"clear_pg_pass": True})["result"]
assert res["ok"], res
snap = fetch_json("/api/snapshot")["data"]
assert snap["db_config"]["pg_pass_configured"] is False
PY

"${HELLO}" stop fastapi >/tmp/hello-manager-stop.log
echo "verify-hello-manager: ok"
