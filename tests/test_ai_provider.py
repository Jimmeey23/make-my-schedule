import sys
import types

import ai_provider


def test_get_ai_settings_uses_openai_model_override_even_with_other_provider_keys(monkeypatch):
    monkeypatch.setattr(ai_provider, "load_dotenv_if_present", lambda: None)
    for key in (
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_MODEL",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "AI_BACKUP_MODEL",
    ):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "~anthropic/claude-sonnet-latest")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4.1")
    monkeypatch.setenv("AI_BACKUP_MODEL", "z-ai/glm-4.5-air:free")

    settings = ai_provider.get_ai_settings()

    assert settings["provider"] == "openai"
    assert settings["api_key"] == "openai-key"
    assert settings["model"] == "gpt-4.1"
    assert settings["backup_model"] == ""
    assert settings["base_url"] == "https://api.openai.com/v1"


def test_get_ai_fallback_settings_is_empty_for_openai_only_policy(monkeypatch):
    monkeypatch.setattr(ai_provider, "load_dotenv_if_present", lambda: None)
    for key in ("OPENAI_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")

    assert ai_provider.get_ai_fallback_settings({"provider": "openai"}) == []


def test_get_ai_settings_ignores_openrouter_and_deepseek_without_openai_key(monkeypatch):
    monkeypatch.setattr(ai_provider, "load_dotenv_if_present", lambda: None)
    for key in (
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL",
        "OPENROUTER_BASE_URL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_MODEL",
        "DEEPSEEK_BASE_URL",
        "OPENAI_API_KEY",
    ):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")

    assert ai_provider.get_ai_settings() is None


def test_get_ai_fallback_settings_ignores_non_openai_providers(monkeypatch):
    monkeypatch.setattr(ai_provider, "load_dotenv_if_present", lambda: None)
    for key in (
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL",
        "OPENROUTER_BACKUP_MODEL",
        "AI_BACKUP_MODEL",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_MODEL",
    ):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("OPENROUTER_API_KEY", "primary-key")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")

    assert ai_provider.get_ai_fallback_settings({"provider": "openrouter"}) == []


def test_call_ai_coerces_explicit_runtime_settings_to_openai_only(monkeypatch):
    captured = {}

    monkeypatch.setattr(ai_provider, "OPENAI_AVAILABLE", True)

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs

    def fake_completion(client, system_prompt, user_prompt, model, max_tokens, settings_override=None):
        captured["system_prompt"] = system_prompt
        captured["user_prompt"] = user_prompt
        captured["model"] = model
        captured["max_tokens"] = max_tokens
        captured["settings_override"] = settings_override
        return types.SimpleNamespace(
            choices=[
                types.SimpleNamespace(
                    message=types.SimpleNamespace(content='{"summary":"ok","operations":[]}')
                )
            ]
        )

    monkeypatch.setattr(ai_provider, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(ai_provider, "create_chat_completion", fake_completion)

    raw = ai_provider.call_ai(
        prompt="optimise this schedule",
        max_tokens=321,
        api_key="deepseek-key",
        provider="deepseek",
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com",
    )

    assert raw == '{"summary":"ok","operations":[]}'
    assert captured["client_kwargs"]["api_key"] == "deepseek-key"
    assert captured["client_kwargs"]["base_url"] == "https://api.openai.com/v1"
    assert captured["model"] == "gpt-5.6-terra"
    assert captured["max_tokens"] == 321
    assert captured["user_prompt"] == "optimise this schedule"
    assert captured["settings_override"]["provider"] == "openai"


def test_get_ai_settings_defaults_to_gpt56_terra(monkeypatch):
    monkeypatch.setattr(ai_provider, "load_dotenv_if_present", lambda: None)
    for key in ("OPENAI_API_KEY", "OPENAI_MODEL", "SCHEDULER_AI_MODEL"):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")

    settings = ai_provider.get_ai_settings()

    assert settings["model"] == "gpt-5.6-terra"


def test_deepseek_chat_completion_disables_thinking_and_requests_json(monkeypatch):
    calls = []

    monkeypatch.setattr(ai_provider, "get_ai_settings", lambda: {
        "provider": "deepseek",
        "api_key": "deepseek-key",
        "base_url": "https://api.deepseek.com",
        "timeout": 30,
    })

    class FakeResponse:
        status_code = 200
        headers = {}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"message": {"content": '{"schedule":[]}'}}],
                "usage": {"prompt_tokens": 8, "completion_tokens": 3, "total_tokens": 11},
            }

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            calls.append((url, headers, json))
            return FakeResponse()

    class FakeTimeout:
        def __init__(self, *args, **kwargs):
            pass

    fake_httpx = types.SimpleNamespace(Client=FakeClient, Timeout=FakeTimeout)
    monkeypatch.setitem(sys.modules, "httpx", fake_httpx)

    response = ai_provider.create_chat_completion(
        client=None,
        system_prompt="Return JSON only.",
        user_prompt='{"slots":[]}',
        model="deepseek-v4-flash",
        max_tokens=100,
    )

    assert calls[0][0] == "https://api.deepseek.com/chat/completions"
    assert calls[0][2]["thinking"] == {"type": "disabled"}
    assert calls[0][2]["response_format"] == {"type": "json_object"}
    assert response.choices[0].message.content == '{"schedule":[]}'


def test_create_chat_completion_retries_rate_limit(monkeypatch):
    calls = []
    sleeps = []

    monkeypatch.setattr(ai_provider, "get_ai_settings", lambda: {
        "api_key": "test-key",
        "base_url": "https://openrouter.ai/api/v1",
    })
    monkeypatch.setattr(ai_provider.time, "sleep", lambda seconds: sleeps.append(seconds))

    class FakeResponse:
        def __init__(self, status_code):
            self.status_code = status_code
            self.headers = {"retry-after": "0.2"}
            self.text = "rate limited"

        def raise_for_status(self):
            if self.status_code >= 400:
                raise FakeHTTPStatusError("429", response=self)

        def json(self):
            return {
                "choices": [{"message": {"content": '{"schedule":[]}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14},
            }

    class FakeHTTPStatusError(Exception):
        def __init__(self, message, response):
            super().__init__(message)
            self.response = response

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            calls.append((url, json))
            return FakeResponse(429 if len(calls) == 1 else 200)

    class FakeTimeout:
        def __init__(self, *args, **kwargs):
            pass

    fake_httpx = types.SimpleNamespace(
        Client=FakeClient,
        Timeout=FakeTimeout,
        HTTPStatusError=FakeHTTPStatusError,
    )
    monkeypatch.setitem(sys.modules, "httpx", fake_httpx)

    response = ai_provider.create_chat_completion(
        client=None,
        system_prompt="system",
        user_prompt="user",
        model="test-model",
        max_tokens=100,
    )

    assert len(calls) == 2
    assert sleeps == [0.2]
    assert response.choices[0].message.content == '{"schedule":[]}'


def test_openai_completion_uses_responses_api_with_reasoning(monkeypatch):
    calls = []

    monkeypatch.setattr(ai_provider, "get_ai_settings", lambda: {
        "provider": "openai",
        "api_key": "test-key",
        "base_url": "https://api.openai.com/v1",
        "timeout": 30,
    })
    monkeypatch.setenv("OPENAI_REASONING_EFFORT", "high")
    monkeypatch.setenv("OPENAI_REASONING_MODE", "pro")

    class FakeResponse:
        status_code = 200
        headers = {}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "completed",
                "output_text": '{"schedule":[]}',
                "usage": {"input_tokens": 10, "output_tokens": 4, "total_tokens": 14},
            }

    class FakeClient:
        def __init__(self, timeout=None):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            calls.append((url, json))
            return FakeResponse()

    class FakeTimeout:
        def __init__(self, *args, **kwargs):
            pass

    fake_httpx = types.SimpleNamespace(Client=FakeClient, Timeout=FakeTimeout)
    monkeypatch.setitem(sys.modules, "httpx", fake_httpx)

    response = ai_provider.create_chat_completion(
        client=None,
        system_prompt="Return JSON only.",
        user_prompt='{"slots":[]}',
        model="gpt-5.6-terra",
        max_tokens=1000,
    )

    assert calls[0][0] == "https://api.openai.com/v1/responses"
    assert calls[0][1]["max_output_tokens"] == 1000
    assert calls[0][1]["reasoning"] == {"effort": "high", "mode": "pro"}
    assert calls[0][1]["text"] == {"format": {"type": "json_object"}}
    assert response.choices[0].message.content == '{"schedule":[]}'
