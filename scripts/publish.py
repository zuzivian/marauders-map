"""Publish the static export in out/ to here.now.

Run via `npm run deploy`, which builds (and so runs the data tests) first.
With an API key (HERENOW_API_KEY, or ~/.herenow/credentials) the site is permanent.
Without one the site is anonymous and expires in 24 hours; claim it
from the claim URL (saved in .herenow/state.json, which is gitignored) to keep it.
Re-running updates the same site.
"""
import hashlib, json, mimetypes, os, pathlib, sys, urllib.error, urllib.request

API = "https://here.now/api/v1"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
STATE = ROOT / ".herenow" / "state.json"
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("text/plain", ".txt")  # Next's RSC payloads


def api_key():
    """HERENOW_API_KEY, else the key saved at ~/.herenow/credentials (here.now's recommended location)."""
    key = os.environ.get("HERENOW_API_KEY")
    cred = pathlib.Path.home() / ".herenow" / "credentials"
    if not key and cred.exists():
        key = cred.read_text().strip().split("=")[-1].strip() or None
    return key


def call(method, url, body=None, headers=None, raw=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    key = api_key()
    if key and url.startswith(API):  # never send the key to presigned upload URLs
        h["Authorization"] = f"Bearer {key}"
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url} failed: {e.code} {e.read().decode()[:500]}")


def check_export():
    index = OUT / "index.html"
    if not index.exists():
        sys.exit("out/index.html is missing. Run `npm run build` first (or use `npm run deploy`).")
    newest_src = max(p.stat().st_mtime for p in (ROOT / "src").rglob("*") if p.is_file())
    if index.stat().st_mtime < newest_src:
        sys.exit("out/ is older than src/. Rebuild before publishing (`npm run deploy` does both).")


def main():
    check_export()
    files = [p for p in OUT.rglob("*") if p.is_file()]
    manifest = [{
        "path": p.relative_to(OUT).as_posix(),
        "size": p.stat().st_size,
        "contentType": mimetypes.guess_type(p.name)[0] or "application/octet-stream",
        "hash": hashlib.sha256(p.read_bytes()).hexdigest(),
    } for p in files]

    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    body = {"files": manifest, "displayName": "The Marauder's Map of big tech recruiting"}
    if state.get("slug"):
        if state.get("claimToken"):
            body["claimToken"] = state["claimToken"]
        res = call("PUT", f"{API}/publish/{state['slug']}", body)
    else:
        res = call("POST", f"{API}/publish", body)

    up = res["upload"]
    by_path = {p.relative_to(OUT).as_posix(): p for p in files}
    for t in up["uploads"]:
        call("PUT", t["url"], headers=t["headers"], raw=by_path[t["path"]].read_bytes())
    fin = call("POST", up["finalizeUrl"], {"versionId": up["versionId"]})

    state.update({k: res[k] for k in ("slug", "siteUrl", "claimToken", "claimUrl", "expiresAt") if res.get(k)})
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2))
    print(json.dumps({"siteUrl": res["siteUrl"], "expiresAt": state.get("expiresAt"),
                      "uploaded": len(up["uploads"]), "skipped": len(up.get("skipped", [])), "finalize": fin.get("status", fin)}, indent=2))
    if state.get("claimUrl") and not api_key():
        print("Anonymous site: open the claimUrl in .herenow/state.json to keep it past expiresAt.")


if __name__ == "__main__":
    main()
