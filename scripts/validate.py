"""Check publishable assets, bundled metadata, and Python syntax."""

from pathlib import Path
from urllib.parse import urlsplit
import ast
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def check():
    html = (ROOT / "index.html").read_text(encoding="utf-8-sig")
    for value in re.findall(r'(?:src|href)="([^"]+)"', html):
        if value.startswith(("http:", "https:", "#")):
            continue
        assert (ROOT / value).is_file(), "Missing asset: " + value
    for path in (ROOT / "scripts").glob("*.py"):
        ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    bundle = json.loads(
        (ROOT / "data/index-data.js")
        .read_text(encoding="utf-8")
        .split("=", 1)[1]
        .strip()
        .rstrip(";")
    )
    report = json.loads((ROOT / "data/index-report.json").read_text(encoding="utf-8"))
    assert len(bundle["columns"]) == len(set(bundle["columns"]))
    seen = set()
    total = featured = 0
    for source in bundle["sources"]:
        for values in source["rows"]:
            assert len(values) == len(bundle["columns"])
            row = dict(zip(bundle["columns"], values))
            key = (source["id"], row["event_id"])
            assert key not in seen, "Duplicate " + str(key)
            seen.add(key)
            assert urlsplit(row["poster_url"]).scheme in ("http", "https")
            featured += row["acceptance_type"] in ("Oral", "Spotlight")
            total += 1
    assert total == report["total"]
    audit = json.loads((ROOT / "data/source-audit.json").read_text(encoding="utf-8"))
    for field in ("abstract", "official_topic", "keywords", "institutions"):
        assert (field in bundle["columns"]) == audit["common_fields"][field][
            "eligible"
        ], ("Field threshold mismatch: " + field)
    print(
        "Index: %d unique records; %d Oral/Spotlight; %d sources"
        % (total, featured, len(bundle["sources"]))
    )
    print("Static paths and Python syntax: passed")


if __name__ == "__main__":
    check()
