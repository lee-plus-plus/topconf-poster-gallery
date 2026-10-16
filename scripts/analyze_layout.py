"""Resumeable offline layout analysis; website images remain remote."""
import argparse
import concurrent.futures as futures
from collections import Counter
import hashlib
import json
import msvcrt
import os
from pathlib import Path
import sqlite3
import time
import traceback

import layout_features as features

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'layout-v4-jpeg1600-fast-model-orientation-2026-10-16'
MIN_COMPATIBILITY = .75


def atomic_text(path, content):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(content, encoding='utf-8')
    for attempt in range(20):
        try:
            os.replace(temporary, path)
            return
        except PermissionError:
            time.sleep(.1)
    raise PermissionError(f'Cannot replace {path}')


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'),
                      default=lambda x: x.item())


def analyze(item, archive):
    record_id = f"{item['source']}-{item['event_id']}"
    try:
        result = features.analyze_image(Path(archive) / item['file'])
        layout = result['layout']
        n, confidence = layout['candidate_columns'], layout['compatibility_score']
        label = str(n) if n in (1, 2, 3, 4) and confidence >= MIN_COMPATIBILITY else '其他'
        return record_id, {
            'id': record_id, 'source': item['source'], 'event_id': item['event_id'],
            'poster_url': item['poster_url'], 'image_key': item['key'],
            'algorithm_version': VERSION, 'input_file': item['file'],
            'columns': n, 'label': label, 'confidence': confidence,
            'kind': 'column_partition_candidate',
            'cuts_normalized': layout['cuts_normalized'],
            'score_evidence': layout['score_evidence'],
            'visual_evidence': layout['visual_evidence'],
            'rotation_clockwise': result['rotation_clockwise'],
            'orientation': result['orientation'],
            'width': result['corrected_width'], 'height': result['corrected_height'],
            'seconds': result['timings']['total_seconds'],
        }, None
    except Exception:
        return record_id, None, traceback.format_exc(limit=5)


def run(args):
    archive = Path(args.archive)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    lock = (output / 'run.lock').open('a+b')
    lock.seek(0)
    msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    manifest_path = archive / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    # Interleave conference-years, so all groups progress together.
    sources = sorted({x['source'] for x in manifest})
    groups = {s: [x for x in manifest if x['source'] == s] for s in sources}
    manifest = [groups[s][i] for i in range(max(map(len, groups.values())))
                for s in sources if i < len(groups[s])]
    if args.limit:
        manifest = manifest[:args.limit]
    ids = {f"{x['source']}-{x['event_id']}" for x in manifest}
    if len(ids) != len(manifest):
        raise ValueError('Duplicate record IDs in manifest')
    db = sqlite3.connect(output / 'layout.sqlite')
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, version TEXT, source TEXT, payload TEXT, error TEXT, updated REAL)')
    db.commit()
    done = {r[0] for r in db.execute('SELECT id FROM results WHERE version=? AND error IS NULL', (VERSION,))} & ids
    pending = [x for x in manifest if f"{x['source']}-{x['event_id']}" not in done]
    counts = {s: {'total': sum(x['source'] == s for x in manifest), 'completed': 0, 'failed': 0} for s in sources}
    compact = {}
    for record_id, source, raw in db.execute('SELECT id,source,payload FROM results WHERE version=? AND error IS NULL', (VERSION,)):
        if record_id in done:
            counts[source]['completed'] += 1
            compact[record_id] = compact_row(json.loads(raw))
    state = {'status': 'running', 'pid': os.getpid(), 'total': len(manifest),
             'completed': len(done), 'failed': 0, 'cached': len(done),
             'workers': args.workers, 'started': time.time(), 'sources': counts,
             'algorithm_version': VERSION, 'recent_errors': []}
    config = {'algorithm_version': VERSION, 'workers': args.workers,
              'threads_per_worker': args.threads, 'input_archive': str(archive),
              'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
              'model_sha256': hashlib.sha256(Path(args.model).read_bytes()).hexdigest(),
              'minimum_compatibility': MIN_COMPATIBILITY, 'total': len(manifest)}
    atomic_text(output / 'config.json', encode(config))
    started = time.monotonic()
    processed = 0
    last_publish = 0

    def publish(final=False):
        nonlocal last_publish
        elapsed = time.monotonic() - started
        rate = processed / elapsed if elapsed else 0
        state.update(updated=time.time(), elapsed=elapsed, items_per_second=rate,
                     eta_seconds=(state['total'] - state['completed'] - state['failed']) / rate if rate else None)
        atomic_text(output / 'status.json', encode(state))
        if args.publish and (final or time.monotonic() - last_publish >= 60):
            # Keep verified pilot results until their full-analysis replacement arrives.
            baseline_path = ROOT / 'images/metadata-pilot/metadata-layout-v4.json'
            items = {}
            if baseline_path.exists():
                for r in json.loads(baseline_path.read_text(encoding='utf-8')):
                    n = r['layout']['candidate_columns']
                    confidence = r['layout']['column_confidence']
                    items[f"{r['source']}-{r['event_id']}"] = {
                        'columns': n, 'label': str(n) if n in (1, 2, 3, 4) and confidence >= MIN_COMPATIBILITY else '其他',
                        'confidence': confidence, 'kind': 'column_partition_candidate'}
            items.update(compact)
            payload = {'version': 4, 'algorithm_version': VERSION,
                       'coverage': len(items), 'analyzed': len(compact),
                       'total': len(manifest), 'complete': state['status'] == 'complete',
                       'minimum_compatibility': MIN_COMPATIBILITY,
                       'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                       'items': items}
            atomic_text(ROOT / 'data/layout-data.js', 'window.POSTER_LAYOUT=' + encode(payload) + ';\n')
            last_publish = time.monotonic()

    try:
        # The browser workspace may disallow child-process pipes; ONNX Runtime
        # releases the GIL for the expensive inference calls, so threads keep
        # the same parallel behavior without requiring process creation.
        features.initialize(args.model, args.threads)
        with futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            jobs = {}
            todo = iter(pending)

            def fill():
                while len(jobs) < args.workers:
                    item = next(todo, None)
                    if item is None:
                        break
                    jobs[pool.submit(analyze, item, str(archive))] = item

            fill()
            publish()
            while jobs:
                ready, _ = futures.wait(jobs, timeout=2, return_when=futures.FIRST_COMPLETED)
                for job in ready:
                    item = jobs.pop(job)
                    record_id, result, error = job.result()
                    db.execute('INSERT OR REPLACE INTO results VALUES (?,?,?,?,?,?)',
                               (record_id, VERSION, item['source'], encode(result) if result else None, error, time.time()))
                    db.commit()
                    processed += 1
                    if error:
                        state['failed'] += 1
                        counts[item['source']]['failed'] += 1
                        state['recent_errors'] = (state['recent_errors'] + [{'id': record_id, 'error': error}])[-5:]
                        print('FAILED', record_id, error, flush=True)
                    else:
                        state['completed'] += 1
                        counts[item['source']]['completed'] += 1
                        compact[record_id] = compact_row(result)
                        print(state['completed'], '/', state['total'], record_id,
                              result['columns'], round(result['confidence'], 3), round(result['seconds'], 2), flush=True)
                fill()
                state['active'] = len(jobs)
                publish()
        state.update(status='complete' if not state['failed'] else 'finished_with_errors', active=0)
        with (output / 'metadata.jsonl').open('w', encoding='utf-8') as target:
            for record_id, raw in db.execute('SELECT id,payload FROM results WHERE version=? AND error IS NULL', (VERSION,)):
                if record_id in ids:
                    target.write(raw + '\n')
        state['distribution'] = dict(Counter(x['label'] for x in compact.values()))
        publish(final=True)
    except BaseException as error:
        state.update(status='interrupted', error=str(error), active=0)
        publish(final=True)
        raise
    finally:
        db.close()
        lock.close()


def compact_row(result):
    return {k: result[k] for k in ('columns', 'label', 'confidence', 'kind', 'cuts_normalized')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', default=str(ROOT / 'images/archive-jpg1600q80'))
    parser.add_argument('--output', default=str(ROOT / 'outputs/layout-analysis'))
    parser.add_argument('--model', default=str(ROOT / 'images/metadata-pilot/models/doc_ori.onnx'))
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--threads', type=int, default=2)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--publish', action='store_true')
    run(parser.parse_args())
