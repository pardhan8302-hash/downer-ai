"""
Downer AI - Automated Test Suite
Verifies prompt rules, 1-2 sentence enforcement, multilingual constraint,
encouragement mode, vent mode, offline fallback, and HTTP server endpoints.
"""

import os
import sys
import json
import unittest
import threading
import urllib.request
import urllib.error
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import server
from system_prompt import get_system_prompt, get_offline_response, SYSTEM_PROMPT


class DownerAITestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start server in a background thread on a test port
        cls.test_port = 3099
        cls.server_address = ("127.0.0.1", cls.test_port)
        cls.httpd = server.HTTPServer(cls.server_address, server.DownerHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.test_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_system_prompt_rules(self):
        """Verify strict 1-2 sentence rule, sarcastic/rude tone, and multilingual rule."""
        prompt = get_system_prompt(ai_name="CynicBot", encouragement_mode=False, is_vent=False)
        self.assertIn("CynicBot", prompt)
        self.assertIn("1 TO 2 SHORT SENTENCES", prompt)
        self.assertIn("NEVER WRITE A THIRD SENTENCE", prompt)
        self.assertIn("sarcastic, rude, blunt, tired", prompt.lower())
        self.assertIn("EXACT SAME LANGUAGE", prompt)
        self.assertIn("ENCOURAGEMENT MODE IS OFF", prompt)

    def test_system_prompt_modes(self):
        """Verify encouragement mode and vent mode modify prompt instructions."""
        # Encouragement mode ON
        prompt_enc = get_system_prompt(encouragement_mode=True, is_vent=False)
        self.assertIn("ENCOURAGEMENT MODE IS ACTIVATED", prompt_enc)
        self.assertIn("passive-aggressive disappointment", prompt_enc)

        # Vent mode ON
        prompt_vent = get_system_prompt(encouragement_mode=False, is_vent=True)
        self.assertIn("CRITICAL VENT EVENT", prompt_vent)
        self.assertIn("ruthlessly crushing reality check", prompt_vent)

    def test_offline_fallback_generator(self):
        """Verify curated offline responses are returned and obey mode rules."""
        # Normal
        reply_normal = get_offline_response("Hello there")
        self.assertTrue(len(reply_normal) > 10)
        
        # Positive crush
        reply_positive = get_offline_response("I am so happy and excited today!")
        self.assertTrue(any(w in reply_positive.lower() for w in ["mood", "reality", "happiness", "cheerful"]))

        # Vent
        reply_vent = get_offline_response("Everything is ruined", is_vent=True)
        self.assertTrue(len(reply_vent) > 10)

    def test_get_index_html(self):
        """Verify GET / returns 200 and serves HTML with all required UI components."""
        req = urllib.request.Request(f"{self.base_url}/")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            content = resp.read().decode("utf-8")
            self.assertIn("Downer AI", content)
            # Check for customizable name display
            self.assertIn("ai-name-display", content)
            # Check for mood tracker
            self.assertIn("mood-percentage", content)
            self.assertIn("mood-bar-track", content)
            # Check for encouragement toggle
            self.assertIn("toggle-encouragement", content)
            # Check for Daily Dose of Reality banner
            self.assertIn("daily-dose-banner", content)
            self.assertIn("daily-reality-quote", content)
            # Check for big red Vent to me button
            self.assertIn("btn-vent", content)
            self.assertIn("Vent to me", content)
            # Check for theme selector
            self.assertIn("theme-select", content)

    def test_get_static_css_and_themes(self):
        """Verify static CSS includes all 3 themes and neon glow variables."""
        req = urllib.request.Request(f"{self.base_url}/style.css")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            css = resp.read().decode("utf-8")
            self.assertIn("theme-default", css)
            self.assertIn("theme-deeper-black", css)
            self.assertIn("theme-cold-blue", css)
            self.assertIn("--neon-accent", css)
            self.assertIn("--neon-box-glow", css)
            self.assertIn("btn-vent", css)

    def test_get_static_js(self):
        """Verify static app.js is delivered and contains key logic."""
        req = urllib.request.Request(f"{self.base_url}/app.js")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            js = resp.read().decode("utf-8")
            self.assertIn("REALITY_QUOTES", js)
            self.assertIn("updateAiNameUI", js)
            self.assertIn("dropMood", js)
            self.assertIn("toggleVentMode", js)

    def test_get_api_config(self):
        """Verify GET /api/config returns JSON with expected schema."""
        req = urllib.request.Request(f"{self.base_url}/api/config")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("default_provider", data)
            self.assertIn("groq", data)
            self.assertIn("openrouter", data)

    def test_post_chat_missing_payload(self):
        """Verify POST /api/chat with empty payload returns 400."""
        req = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 400)

    def test_download_zip(self):
        """Verify GET /api/download and /downer-ai.zip return valid zip file."""
        for path in ["/api/download", "/downer-ai.zip"]:
            req = urllib.request.Request(f"{self.base_url}{path}")
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 200)
                content = resp.read()
                self.assertTrue(content.startswith(b"PK"))
                self.assertTrue(len(content) > 10000)

    def test_pwa_manifest(self):
        """Verify GET /manifest.json returns valid PWA configuration."""
        req = urllib.request.Request(f"{self.base_url}/manifest.json")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["name"], "Downer AI")
            self.assertEqual(data["display"], "standalone")


if __name__ == "__main__":
    unittest.main()
