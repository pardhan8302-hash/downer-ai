#!/usr/bin/env python3
"""
Downer AI - Local Web Server and API Proxy
Zero external dependencies required (uses Python standard library).
Connects to Groq (or OpenRouter) API, or runs in curated offline misery mode if no key is set.
"""

import os
import sys
import json
import mimetypes
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

# Import system prompt generator and offline fallback
try:
    from system_prompt import get_system_prompt, get_offline_response
except ImportError:
    from .system_prompt import get_system_prompt, get_offline_response

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
ENV_FILE = BASE_DIR / ".env"


def load_env(env_path=ENV_FILE):
    """Load key-value pairs from .env into os.environ."""
    if not env_path.exists():
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("\"'").strip()
                    if key:
                        os.environ[key] = val
    except Exception as e:
        sys.stderr.write(f"Warning: could not read .env: {e}\n")


# Load .env on startup
load_env()


def get_provider_config():
    """Retrieve current provider configurations."""
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    default_provider = os.environ.get("DEFAULT_PROVIDER", "groq").lower().strip()
    
    if default_provider not in ("groq", "openrouter"):
        default_provider = "groq"
        
    groq_model = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b").strip()
    openrouter_model = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct").strip()
    
    groq_valid = bool(groq_key and not groq_key.startswith("your_") and not groq_key.startswith("gsk_your_"))
    openrouter_valid = bool(openrouter_key and not openrouter_key.startswith("your_") and not openrouter_key.startswith("sk-or-your_"))

    return {
        "default_provider": default_provider,
        "groq": {
            "configured": groq_valid,
            "model": groq_model,
        },
        "openrouter": {
            "configured": openrouter_valid,
            "model": openrouter_model,
        },
        "has_any_key": groq_valid or openrouter_valid
    }


def call_llm(messages, ai_name="Downer AI", encouragement_mode=False, is_vent=False, provider=None, model_override=None):
    """Proxy chat completion request to Groq or OpenRouter, with offline fallback."""
    config = get_provider_config()
    target_provider = (provider or config["default_provider"]).lower().strip()
    
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    
    system_prompt = get_system_prompt(
        ai_name=ai_name or "Downer AI",
        encouragement_mode=bool(encouragement_mode),
        is_vent=bool(is_vent)
    )

    # Check if target provider has a valid key
    api_key = None
    if target_provider == "groq":
        api_key = groq_key
        api_url = "https://api.groq.com/openai/v1/chat/completions"
        model = model_override or config["groq"]["model"]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    elif target_provider == "openrouter":
        api_key = openrouter_key
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        model = model_override or config["openrouter"]["model"]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Downer AI",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    else:
        raise ValueError(f"Unknown provider '{target_provider}'. Choose 'groq' or 'openrouter'.")

    # If no key configured, trigger curated offline fallback
    if not api_key or api_key.startswith("your_") or api_key.startswith("gsk_your_") or api_key.startswith("sk-or-your_"):
        last_user_text = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_text = m.get("content", "")
                break
        offline_reply = get_offline_response(last_user_text, encouragement_mode=encouragement_mode, is_vent=is_vent)
        return {
            "reply": offline_reply,
            "provider": "offline",
            "model": "offline-misery-engine",
            "is_offline": True,
            "notice": "Offline Misery Engine active. Add a valid GROQ_API_KEY to .env for full live AI."
        }

    # Format messages: System prompt first, followed by conversation
    formatted_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content.strip():
            formatted_messages.append({"role": role, "content": content.strip()})

    payload = {
        "model": model,
        "messages": formatted_messages,
        "temperature": 0.85,
        "max_tokens": 120,  # Enforces brief 1-2 sentence replies
    }

    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choice = data["choices"][0]
            content = choice["message"]["content"].strip()
            return {
                "reply": content,
                "provider": target_provider,
                "model": model,
                "is_offline": False,
                "usage": data.get("usage", {})
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(error_body)
            msg = err_json.get("error", {}).get("message", error_body)
        except Exception:
            msg = error_body
        raise RuntimeError(f"{target_provider.upper()} API error ({e.code}): {msg}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error contacting {target_provider.upper()}: {e.reason}")


class DownerHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler serving static frontend and REST endpoints."""

    def log_message(self, format, *args):
        # Concise logging to console
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def _send_json(self, status_code, data):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        """CORS preflight handling."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        # Refresh env dynamically in case user edited .env while server runs
        load_env()

        path = self.path.split("?")[0]

        if path == "/api/config":
            self._send_json(200, get_provider_config())
            return

        if path in ("/api/download", "/download"):
            zip_file = PUBLIC_DIR / "downer-ai.zip"
            if zip_file.exists():
                with open(zip_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", 'attachment; filename="downer-ai.zip"')
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # Static files
        if path in ("/", "/index.html"):
            target_path = PUBLIC_DIR / "index.html"
        else:
            # Strip leading slash and prevent directory traversal
            clean_path = path.lstrip("/")
            target_path = (PUBLIC_DIR / clean_path).resolve()
            if not str(target_path).startswith(str(PUBLIC_DIR.resolve())):
                self.send_error(403, "Forbidden")
                return

        if target_path.exists() and target_path.is_file():
            mime_type, _ = mimetypes.guess_type(str(target_path))
            if str(target_path).endswith(".svg"):
                mime_type = "image/svg+xml"
            elif str(target_path).endswith(".json") or str(target_path).endswith(".webmanifest"):
                mime_type = "application/json"
            elif mime_type is None:
                mime_type = "application/octet-stream"

            try:
                with open(target_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", mime_type)
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self.send_error(500, f"Error reading file: {e}")
        else:
            self.send_error(404, "File not found")

    def do_POST(self):
        load_env()
        path = self.path.split("?")[0]

        if path == "/api/chat":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8")
                payload = json.loads(body) if body else {}
                
                messages = payload.get("messages", [])
                ai_name = payload.get("ai_name", "Downer AI")
                encouragement_mode = payload.get("encouragement_mode", False)
                is_vent = payload.get("is_vent", False)
                provider = payload.get("provider")
                model = payload.get("model")

                if not messages:
                    self._send_json(400, {"error": "Missing 'messages' in request body."})
                    return

                res = call_llm(
                    messages=messages,
                    ai_name=ai_name,
                    encouragement_mode=encouragement_mode,
                    is_vent=is_vent,
                    provider=provider,
                    model_override=model
                )
                self._send_json(200, res)
            except json.JSONDecodeError:
                self._send_json(400, {"error": "Invalid JSON body."})
            except ValueError as e:
                self._send_json(400, {"error": str(e)})
            except RuntimeError as e:
                self._send_json(502, {"error": str(e)})
            except Exception as e:
                self._send_json(500, {"error": f"Unexpected internal error: {e}"})
        else:
            self.send_error(404, "Not Found")


def run_server(port=None, host=None):
    """Start Downer AI HTTP server."""
    port = port or int(os.environ.get("PORT", 3000))
    host = host or os.environ.get("HOST", "127.0.0.1")
    
    server_address = (host, port)
    httpd = HTTPServer(server_address, DownerHandler)
    
    cfg = get_provider_config()
    print("=" * 60)
    print("  DOWNER AI SERVER STARTED")
    print("  'No toxic positivity here.'")
    print("=" * 60)
    print(f"  URL: http://{host}:{port}")
    print(f"  Default Provider: {cfg['default_provider']}")
    print(f"  Groq Configured: {'Yes' if cfg['groq']['configured'] else 'No (set GROQ_API_KEY in .env)'}")
    print(f"  OpenRouter Configured: {'Yes' if cfg['openrouter']['configured'] else 'No (set OPENROUTER_API_KEY in .env)'}")
    if not cfg['has_any_key']:
        print("  NOTICE: No API key detected. Running in OFFLINE MISERY MODE.")
        print("     Add your GROQ_API_KEY to .env anytime to activate live AI.")
    print("=" * 60)
    print("  Press Ctrl+C to stop.\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Downer AI server...")
        httpd.server_close()
        print("Downer AI server stopped. Goodbye.")


if __name__ == "__main__":
    run_server()
