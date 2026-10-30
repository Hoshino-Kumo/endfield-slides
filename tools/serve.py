"""Serve the static editor on loopback; never receives uploads or writes decks."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser


def main():
    parser = argparse.ArgumentParser(description="Start Endfield Slides")
    parser.add_argument("--port", type=int, default=8800)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    url = f"http://127.0.0.1:{args.port}/"
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Endfield Slides: {url}\nPress Ctrl+C to stop.")
        if not args.no_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
