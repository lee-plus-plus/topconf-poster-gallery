"""Official sources, normalization and resilient metadata fetching."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import Request, urlopen
import argparse
import csv
import html
from collections import Counter
import io
import json
import os
import re
import threading
import time

try:
    import requests
except ImportError:
    requests = None

BASE = Path(__file__).resolve().parent
SOURCES = (
    json.loads((BASE.parent / "data/sources.json").read_text(encoding="utf-8"))
    if (BASE.parent / "data/sources.json").exists()
    else []
)


def now():
    return datetime.now(timezone.utc).isoformat()


def safe_url(base, value):
    url = urljoin(base, value or "") if value else ""
    return url if urlsplit(url).scheme in ("http", "https") else ""


def tokens(text):
    return [
        phrase or word
        for phrase, word in re.findall(r'"([^\"]+)"|(\S+)', text.casefold())
    ]


def selected(params, key):
    return {
        x
        for value in params.get(key, [])
        for x in value.split(",")
        if x and x not in ("all", "featured")
    }


def clean_text(value):
    return html.unescape(re.sub(r"<[^>]*>", " ", str(value or "")))


_supplement_path = BASE.parent / "data/paper-link-supplement.json"
PAPER_LINK_SUPPLEMENT = (
    json.loads(_supplement_path.read_text(encoding="utf-8"))
    if _supplement_path.exists()
    else {}
)


def paper_link(event, source=None):
    candidates = [event.get("paper_url"), event.get("paper_pdf_url")] + [
        m.get("uri") for m in event.get("eventmedia", [])
    ]
    for value in candidates:
        if not value:
            continue
        url = urlsplit(value)
        host = (url.hostname or "").lower()
        if url.scheme not in ("http", "https"):
            continue
        if (
            host == "openreview.net"
            and url.path in ("/forum", "/pdf")
            and "id=" in url.query
        ):
            return value
        if host in (
            "proceedings.mlr.press",
            "papers.nips.cc",
            "proceedings.neurips.cc",
            "arxiv.org",
        ) and url.path not in ("", "/"):
            return value
    if source:
        match = PAPER_LINK_SUPPLEMENT.get(source["id"] + "-" + str(event["id"]), {})
        if match.get("title") == event.get("name"):
            return match["paper_url"]
    return ""


def acceptance_type(decision, source):
    text = str(decision or "").lower()
    if "oral" in text:
        return "Oral"
    if "spotlight" in text:
        return "Spotlight"
    if source["venue"] == "ICLR" and source["year"] == 2023:
        if "notable-top-5%" in text:
            return "Oral"
        if "notable-top-25%" in text:
            return "Spotlight"
    if source["venue"] == "ICML" and source["year"] == 2022:
        if "long presentation" in text:
            return "Oral"
        if "short presentation" in text:
            return "Spotlight"
    return "Poster"


def normalize(data, source):
    rows = []
    for event in data["results"]:
        if event.get("eventtype") != "Poster":
            continue
        media = [
            m
            for m in event.get("eventmedia", [])
            if m.get("type") == "Poster" and m.get("file")
        ]
        eligible = [
            m
            for m in media
            if "thumb" not in (m.get("detailed_kind") or "")
            and "-thumb" not in m["file"]
        ]
        full = next(
            (m for m in eligible if m.get("detailed_kind") != "lowres"),
            eligible[0] if eligible else None,
        )
        if not full:
            continue
        thumb = next(
            (
                m
                for m in media
                if m.get("detailed_kind") == "thumb" or "-thumb" in m["file"]
            ),
            None,
        )
        title = event.get("name") or "未命名论文"
        decision = event.get("decision") or ""
        kind = acceptance_type(decision, source)
        abstract = clean_text(event.get("abstract"))
        paper = paper_link(event, source)
        poster = safe_url(source["base"], full["file"])
        rows.append(
            {
                "id": f"{source['id']}-{event['id']}",
                "event_id": event["id"],
                "title": title,
                "authors": "; ".join(
                    a.get("fullname", "") for a in event.get("authors", [])
                ),
                "venue": source["venue"],
                "year": source["year"],
                "source_id": source["id"],
                "acceptance_type": kind,
                "decision_raw": decision,
                "relevance_score": 0,
                "abstract": abstract,
                "institutions": [
                    {
                        "author": a.get("fullname", ""),
                        "institution": a.get("institution", ""),
                    }
                    for a in event.get("authors", [])
                ],
                "poster_url": poster,
                "thumbnail_url": (
                    safe_url(source["base"], thumb["file"]) if thumb else poster
                ),
                "paper_url": safe_url(source["base"], paper),
                "conference_page": safe_url(
                    source["base"],
                    event.get("virtualsite_url")
                    or f"/virtual/{source['year']}/poster/{event['id']}",
                ),
                "metadata_source": source["url"],
            }
        )
    return rows


def read_response(url, headers=None):
    if requests is not None:
        with requests.get(
            url,
            headers={"User-Agent": "PosterSurveyLive/1.0", **(headers or {})},
            timeout=(20, 60),
        ) as response:
            response.raise_for_status()
            return response.status_code, response.headers, response.content
    request = Request(
        url, headers={"User-Agent": "PosterSurveyLive/1.0", **(headers or {})}
    )
    with urlopen(request, timeout=60) as response:
        return response.status, response.headers, response.read()


def fetch_metadata(url):
    """Parse normal response first; use validated ranges if an intermediary truncates it."""
    try:
        _, _, body = read_response(url)
        result = json.loads(body)
        if not isinstance(result.get("results"), list):
            raise ValueError("Missing results list")
        return result
    except (ValueError, OSError):
        chunk = 2 * 1024 * 1024
        code, headers, body = read_response(url, {"Range": f"bytes=0-{chunk-1}"})
        match = re.fullmatch(r"bytes 0-(\d+)/(\d+)", headers.get("Content-Range", ""))
        if code != 206 or not match:
            raise ValueError("官方索引无法完整读取，且服务器未提供有效分段响应")
        total = int(match[2])
        if total > 100 * 1024 * 1024 or len(body) != min(chunk, total):
            raise ValueError("官方索引大小或分段长度异常")
        parts = [body]
        ranges = [
            (start, min(start + chunk, total) - 1)
            for start in range(chunk, total, chunk)
        ]

        def fetch_part(bounds):
            start, end = bounds
            for attempt in range(3):
                try:
                    code, hdr, data = read_response(
                        url, {"Range": f"bytes={start}-{end}"}
                    )
                    if (
                        code != 206
                        or hdr.get("Content-Range") != f"bytes {start}-{end}/{total}"
                        or len(data) != end - start + 1
                    ):
                        raise ValueError("分段内容不完整")
                    return data
                except (ValueError, OSError):
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)

        with ThreadPoolExecutor(max_workers=3) as pool:
            parts.extend(pool.map(fetch_part, ranges))
        result = json.loads(b"".join(parts))
        if not isinstance(result.get("results"), list):
            raise ValueError("官方索引格式异常")
        return result
