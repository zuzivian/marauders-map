"""Count H-1B filings for product roles at each company, from the Labor Department's LCA disclosure data.

Every H-1B petition starts with a Labor Condition Application (LCA). OFLC publishes all of them each quarter, cumulative
for the fiscal year, as one large .xlsx: https://www.dol.gov/agencies/eta/foreign-labor/performance
This finds the newest file, streams it (it is hundreds of MB, so nothing loads whole), keeps certified H-1B
applications whose employer matches a company's `match` pattern in src/data/visa.json, and counts them by title family
(product manager, program manager, product marketing) with the offered wage's median and middle half.

    python3 scripts/refresh-lca.py                     # dry run: find the newest file, compare, print the table
    python3 scripts/refresh-lca.py --write             # also update src/data/visa.json and its source in sources.json
    python3 scripts/refresh-lca.py --file=LCA.xlsx     # use a downloaded file (its name must carry FY and quarter)
    python3 scripts/refresh-lca.py --force             # re-read even if visa.json already has the newest quarter
    python3 scripts/refresh-lca.py --report=out.md     # also save the table as markdown (the workflow shows it)

Standard library only. .github/workflows/visa.yml runs it monthly and publishes when a new quarter appears.
"""
import datetime, json, pathlib, re, statistics, sys, tempfile, urllib.request, zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
PAGE = "https://www.dol.gov/agencies/eta/foreign-labor/performance"
UA = "marauders-map/1.0 (+https://marauders-map.natwong.dev; quarterly read of OFLC LCA disclosure data)"
FILE_RE = re.compile(r"LCA_Disclosure_Data_FY(\d{4})_Q([1-4])\.xlsx", re.I)
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
COLS = ["CASE_STATUS", "VISA_CLASS", "EMPLOYER_NAME", "JOB_TITLE", "WAGE_RATE_OF_PAY_FROM", "WAGE_UNIT_OF_PAY"]
PER_YEAR = {"YEAR": 1, "MONTH": 12, "BI-WEEKLY": 26, "WEEK": 52, "HOUR": 2080}
# Title families, tried in order on the upper-cased job title. "Product marketing" first: it also says "product".
FAMILIES = [("pmm", re.compile(r"PRODUCT MARKETING")), ("program", re.compile(r"PROGRAM MANAG")), ("pm", re.compile(r"PRODUCT MANAG"))]

arg = lambda name: next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith(f"--{name}=")), None)
WRITE, FORCE = "--write" in sys.argv, "--force" in sys.argv


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
        return r.read()


def newest_file() -> tuple[str, int, int]:
    """The newest LCA disclosure file linked from OFLC's performance page: (url, fiscal year, quarter)."""
    html = fetch(PAGE).decode("utf-8", "replace")
    found = {}
    for href in re.findall(r'href="([^"]+)"', html):
        m = FILE_RE.search(href)
        if m: found[(int(m[1]), int(m[2]))] = re.sub(r"(?<!:)//+", "/", urllib.request.urljoin(PAGE, href))  # the page links "dol.gov//media/…"
    if not found: raise SystemExit(f"No LCA_Disclosure_Data_FY____Q_.xlsx link on {PAGE}; the page layout may have changed.")
    (fy, q), url = max(found.items())
    return url, fy, q


def quarter_end(fy: int, q: int) -> str:
    """Last day the file covers. FY2026 runs Oct 1, 2025 to Sep 30, 2026; Q3 ends Jun 30, 2026."""
    return {1: f"{fy - 1}-12-31", 2: f"{fy}-03-31", 3: f"{fy}-06-30", 4: f"{fy}-09-30"}[q]


def col_letters(ref: str) -> str:
    return ref.rstrip("0123456789")


def rows(path: str):
    """Yield each data row of the workbook's first sheet as {header: value}, streaming, for the COLS columns only."""
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        # The first sheet's part, via the workbook and its relationships (usually xl/worksheets/sheet1.xml).
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rid = wb.find(f"{NS}sheets/{NS}sheet").get(f"{REL_NS}id")
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in rels if r.get("Id") == rid)
        sheet = target.lstrip("/") if target.startswith("/") else "xl/" + target
        shared = []
        if "xl/sharedStrings.xml" in names:
            with z.open("xl/sharedStrings.xml") as f:
                for _, el in ET.iterparse(f):
                    if el.tag == f"{NS}si":
                        shared.append("".join(t.text or "" for t in el.iter(f"{NS}t")))
                        el.clear()
        header = None  # column letters -> header name, for the columns we keep
        with z.open(sheet) as f:
            for _, el in ET.iterparse(f):
                if el.tag != f"{NS}row": continue
                cells = {}
                for c in el.iter(f"{NS}c"):
                    t, v = c.get("t"), c.find(f"{NS}v")
                    if t == "s": val = shared[int(v.text)] if v is not None else ""
                    elif t == "inlineStr": val = "".join(x.text or "" for x in c.iter(f"{NS}t"))
                    else: val = v.text if v is not None else ""
                    cells[col_letters(c.get("r"))] = (val or "").strip()
                el.clear()
                if header is None:
                    header = {k: v.upper() for k, v in cells.items() if v.upper() in COLS}
                    missing = set(COLS) - set(header.values())
                    if missing: raise SystemExit(f"The sheet has no {', '.join(sorted(missing))} column; the layout changed.")
                    continue
                yield {name: cells.get(k, "") for k, name in header.items()}


def annual(rate: str, unit: str) -> float | None:
    try: n = float(re.sub(r"[$,\s]", "", rate))
    except ValueError: return None
    k = PER_YEAR.get(unit.strip().upper())
    return n * k if k and n > 0 else None


def tally(path: str, patterns: dict[str, re.Pattern]):
    """Per company: matched employer names, all certified H-1B LCAs, and per title family the count and wages."""
    out = {cid: {"names": set(), "all": 0, "fam": {f: [0, []] for f, _ in FAMILIES}} for cid in patterns}
    for r in rows(path):
        if r["VISA_CLASS"].upper() != "H-1B" or r["CASE_STATUS"].upper() != "CERTIFIED": continue
        name = re.sub(r"\s+", " ", r["EMPLOYER_NAME"].upper())
        cid = next((c for c, p in patterns.items() if p.search(name)), None)
        if not cid: continue
        o = out[cid]
        o["names"].add(name)
        o["all"] += 1
        title = r["JOB_TITLE"].upper()
        fam = next((f for f, p in FAMILIES if p.search(title)), None)
        if fam:
            o["fam"][fam][0] += 1
            w = annual(r["WAGE_RATE_OF_PAY_FROM"], r["WAGE_UNIT_OF_PAY"])
            if w: o["fam"][fam][1].append(w)
    return out


def summarize(wages: list[float]):
    """Median and middle half, to the nearest $1,000; None below 5 wages, where a spread says little."""
    if len(wages) < 5: return None
    q1, q2, q3 = statistics.quantiles(wages, n=4)
    k = lambda x: int(round(x / 1000) * 1000)
    return {"median": k(q2), "low": k(q1), "high": k(q3)}


def main():
    visa = json.loads((DATA / "visa.json").read_text())
    sources = json.loads((DATA / "sources.json").read_text())
    local = arg("file")
    if local:
        m = FILE_RE.search(pathlib.Path(local).name)
        if not m: raise SystemExit("--file must be named like LCA_Disclosure_Data_FY2026_Q3.xlsx")
        url, fy, q = f"https://www.dol.gov/media/{m[0]}", int(m[1]), int(m[2])
    else:
        url, fy, q = newest_file()
    have = (visa.get("fy"), visa.get("quarter"))
    print(f"Newest file: FY{fy} Q{q} ({url}); visa.json has FY{have[0]} Q{have[1]}.")
    if have == (fy, q) and not FORCE:
        print("Already up to date.")
        return

    path = local
    if not path:
        tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        print("Downloading…", flush=True)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=600) as r:
            while chunk := r.read(1 << 20): tmp.write(chunk)
        tmp.close()
        path = tmp.name
    print("Reading…", flush=True)
    patterns = {cid: re.compile(c["match"]) for cid, c in visa["companies"].items()}
    counts = tally(path, patterns)

    today = datetime.date.today().isoformat()
    sid = f"dol-lca-fy{fy}-q{q}"
    lines = [f"# H-1B filings for product roles, FY{fy} through Q{q} ({quarter_end(fy, q)})", "",
             "| Company | All certified H-1B LCAs | Product managers | Program managers | Product marketing | Employer names matched |",
             "|---|---|---|---|---|---|"]
    for cid, c in visa["companies"].items():
        o = counts[cid]
        fam = {f: {"n": n, "wage": summarize(w)} for f, (n, w) in o["fam"].items()}
        cell = lambda f: f"{fam[f]['n']}" + (f" (median ${fam[f]['wage']['median']:,})" if fam[f]["wage"] else "")
        lines.append(f"| {cid} | {o['all']} | {cell('pm')} | {cell('program')} | {cell('pmm')} | {'; '.join(sorted(o['names'])) or '**none: check `match`**'} |")
        c.update({"employers": sorted(o["names"]), "all": o["all"], "roles": fam, "sources": [sid]})
    report = "\n".join(lines)
    print(report)
    rp = arg("report")
    if rp: pathlib.Path(rp).write_text(report + "\n")

    if not WRITE:
        print("\nDry run; nothing written. Add --write to update src/data/visa.json.")
        return
    old = visa.get("source")
    if old and old != sid: sources.pop(old, None)
    sources[sid] = {
        "url": url, "title": f"LCA Programs (H-1B, H-1B1, E-3) Disclosure Data, FY {fy} Q{q}",
        "publisher": "US Department of Labor, Office of Foreign Labor Certification",
        "published": None, "accessed": today, "kind": "primary", "quote": None,
    }
    visa.update({"fy": fy, "quarter": q, "from": f"{fy - 1}-10-01", "through": quarter_end(fy, q), "checked": today, "source": sid})
    (DATA / "visa.json").write_text(json.dumps(visa, indent=2, ensure_ascii=False) + "\n")
    (DATA / "sources.json").write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote src/data/visa.json and source {sid}. Run `npm test`, review `git diff`, then commit.")


if __name__ == "__main__":
    main()
