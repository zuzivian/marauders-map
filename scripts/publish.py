"""Publish the static export in out/ to here.now.

Without HERENOW_API_KEY the site is anonymous and expires in 24 hours; claim it
from the claim URL (saved in .herenow/state.json) to keep it.
Re-running updates the same site.
"""
import hashlib, json, mimetypes, os, pathlib, sys, urllib.request

API = "https://here.now/api/v1"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
STATE = ROOT / ".herenow" / "state.json"
SKIP = {"file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"}  # create-next-app leftovers


def call(method, url, body=None, headers=None, raw=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    key = os.environ.get("HERENOW_API_KEY")
    if key and url.startswith(API):
        h["Authorization"] = f"Bearer {key}"
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url} failed: {e.code} {e.read().decode()[:500]}")


def main():
    files = [p for p in OUT.rglob("*") if p.is_file() and p.name not in SKIP]
    manifest = [{
        "path": p.relative_to(OUT).as_posix(),
        "size": p.stat().st_size,
        "contentType": mimetypes.guess_type(p.name)[0] or "application/octet-stream",
        "hash": hashlib.sha256(p.read_bytes()).hexdigest(),
    } for p in files]

    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    body = {"files": manifest, "displayName": "Lone Tree — a field guide to big tech"}
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
    print(json.dumps({"siteUrl": res["siteUrl"], "claimUrl": state.get("claimUrl"), "expiresAt": state.get("expiresAt"),
                      "uploaded": len(up["uploads"]), "skipped": len(up.get("skipped", [])), "finalize": fin.get("status", fin)}, indent=2))


if __name__ == "__main__":
    main()
