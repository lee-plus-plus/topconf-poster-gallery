"""Optional loopback preview exposing only the published static assets."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import mimetypes,argparse
ROOT=Path(__file__).resolve().parents[1]
ALLOWED={'index.html','assets/app.js','assets/i18n.js','assets/catalog.js','assets/style.css','assets/brand.svg','data/index-data.js','data/index-report.json'}
class Preview(BaseHTTPRequestHandler):
    def do_GET(self):
        name=urlsplit(self.path).path.lstrip('/') or 'index.html'
        if name not in ALLOWED:self.send_error(404);return
        path=ROOT/name
        if not path.is_file():self.send_error(404);return
        body=path.read_bytes();self.send_response(200);self.send_header('Content-Type',(mimetypes.guess_type(name)[0] or 'application/octet-stream')+'; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8876);args=parser.parse_args()
    print('Static preview: http://127.0.0.1:%d'%args.port,flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Preview).serve_forever()
