#!/usr/bin/env python3
"""공마일 사무실 서버 (Python 표준 라이브러리만 사용)

실행:  python3 server/local_server.py [포트] [--host 0.0.0.0] [--db 파일경로] [--key 접속키]
  - 플랫폼 화면(정적 파일)과 저장 API를 함께 제공합니다.
  - 같은 내부망 PC에서 http://<이 PC의 IP>:<포트>/ 로 접속하세요.

API (JSON):
  GET    /api/health                  -> {"ok": true, "app": "platform"}
  GET    /api/items                   -> {"cols": [...]}
  GET    /api/items/<col>             -> [{"id", "data", "updatedAt"}, ...] 최신순
  GET    /api/items/<col>/<id>        -> {"id", "data", "updatedAt"} | 404
  PUT    /api/items/<col>/<id>        본문 = data(JSON) -> {"ok": true, "updatedAt"}
  DELETE /api/items/<col>/<id>        -> {"ok": true}
"""
import argparse
import hmac
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_BODY = 50 * 1024 * 1024  # 50MB


class Store:
    def __init__(self, path):
        self.lock = threading.Lock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS items ("
            " col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,"
            " PRIMARY KEY (col, id))"
        )
        self.db.commit()

    def cols(self):
        with self.lock:
            return [r[0] for r in self.db.execute("SELECT DISTINCT col FROM items ORDER BY col")]

    def list(self, col):
        with self.lock:
            rows = self.db.execute(
                "SELECT id, data, updated_at FROM items WHERE col=? ORDER BY updated_at DESC", (col,)
            ).fetchall()
        return [{"id": r[0], "data": json.loads(r[1]), "updatedAt": r[2]} for r in rows]

    def get(self, col, item_id):
        with self.lock:
            r = self.db.execute(
                "SELECT id, data, updated_at FROM items WHERE col=? AND id=?", (col, item_id)
            ).fetchone()
        return None if r is None else {"id": r[0], "data": json.loads(r[1]), "updatedAt": r[2]}

    def put(self, col, item_id, data):
        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        with self.lock:
            self.db.execute(
                "INSERT INTO items(col, id, data, updated_at) VALUES(?,?,?,?)"
                " ON CONFLICT(col, id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
                (col, item_id, json.dumps(data, ensure_ascii=False), now),
            )
            self.db.commit()
        return now

    def remove(self, col, item_id):
        with self.lock:
            self.db.execute("DELETE FROM items WHERE col=? AND id=?", (col, item_id))
            self.db.commit()


class Handler(SimpleHTTPRequestHandler):
    store = None
    key = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Platform-Key")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            super().log_message(fmt, *args)

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def api_parts(self):
        path = urlsplit(self.path).path
        if path != "/api" and not path.startswith("/api/"):
            return None
        return [unquote(p) for p in path[len("/api/"):].split("/") if p]

    def authorized(self):
        if not self.key or hmac.compare_digest(self.headers.get("X-Platform-Key", "").encode(), self.key.encode()):
            return True
        self.send_json(401, {"error": "접속 키가 맞지 않습니다."})
        return False

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parts = self.api_parts()
        if parts is None:
            if self.blocked_path():
                return self.send_json(404, {"error": "없는 파일입니다."})
            return super().do_GET()
        if parts == ["health"]:
            return self.send_json(200, {"ok": True, "app": "platform"})
        if not self.authorized():
            return None
        if parts == ["items"]:
            return self.send_json(200, {"cols": self.store.cols()})
        if len(parts) == 2 and parts[0] == "items":
            return self.send_json(200, self.store.list(parts[1]))
        if len(parts) == 3 and parts[0] == "items":
            item = self.store.get(parts[1], parts[2])
            if item is None:
                return self.send_json(404, {"error": "없는 항목입니다."})
            return self.send_json(200, item)
        return self.send_json(404, {"error": "알 수 없는 주소입니다."})

    def blocked_path(self):
        # 서버 폴더·데이터베이스·숨김 파일(.git 등)은 정적 파일로 내보내지 않음.
        # 실제 파일 경로로 판단하므로 대소문자(Windows)·끝의 점·이중 슬래시로 우회되지 않음.
        real = os.path.normcase(os.path.realpath(self.translate_path(self.path)))
        root = os.path.normcase(os.path.realpath(ROOT))
        rel = os.path.relpath(real, root)
        parts = rel.split(os.sep)
        if rel.startswith("..") or parts[0] == "server" or any(p.startswith(".") for p in parts if p != "."):
            return True
        return real.rstrip(". ").endswith((".py", ".sql", ".db", ".db-wal", ".db-shm", ".db-journal", ".sqlite"))

    def do_HEAD(self):
        if self.api_parts() is None:
            if self.blocked_path():
                return self.send_json(404, {"error": "없는 파일입니다."})
            return super().do_HEAD()
        return self.send_json(405, {"error": "지원하지 않는 요청입니다."})

    def do_PUT(self):
        parts = self.api_parts()
        if parts is None or len(parts) != 3 or parts[0] != "items":
            return self.send_json(404, {"error": "알 수 없는 주소입니다."})
        if not self.authorized():
            return None
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if length < 0:
            return self.send_json(400, {"error": "Content-Length 가 올바르지 않습니다."})
        if length > MAX_BODY:
            return self.send_json(413, {"error": "데이터가 너무 큽니다."})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8") or "null")
        except (ValueError, UnicodeDecodeError):
            return self.send_json(400, {"error": "JSON 형식이 아닙니다."})
        updated = self.store.put(parts[1], parts[2], data)
        return self.send_json(200, {"ok": True, "updatedAt": updated})

    def do_DELETE(self):
        parts = self.api_parts()
        if parts is None or len(parts) != 3 or parts[0] != "items":
            return self.send_json(404, {"error": "알 수 없는 주소입니다."})
        if not self.authorized():
            return None
        self.store.remove(parts[1], parts[2])
        return self.send_json(200, {"ok": True})

    def do_POST(self):
        return self.send_json(405, {"error": "지원하지 않는 요청입니다."})


def main():
    ap = argparse.ArgumentParser(description="공마일 사무실 서버")
    ap.add_argument("port", nargs="?", type=int, default=8787, help="포트 (기본 8787)")
    ap.add_argument("--host", default="0.0.0.0", help="수신 주소 (기본 0.0.0.0 = 내부망 전체)")
    ap.add_argument("--db", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "platform.db"),
                    help="SQLite 파일 경로 (기본 server/platform.db)")
    ap.add_argument("--key", default="", help="접속 키(선택). 지정하면 플랫폼 설정에 같은 키를 입력해야 함")
    args = ap.parse_args()

    Handler.store = Store(args.db)
    Handler.key = args.key
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print("공마일 사무실 서버 실행 중")
    print(f"  화면:   http://localhost:{args.port}/  (다른 PC: http://<이 PC의 IP>:{args.port}/)")
    print(f"  데이터: {args.db}")
    print("  끝내려면 Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
