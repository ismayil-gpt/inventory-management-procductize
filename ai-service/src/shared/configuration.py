"""Runtime configuration for the AI service. Ref: CLAUDE.md §2, §16."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuration(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.development", extra="ignore")

    # The backend owns the data + the deterministic reorder engine; the AI service
    # triggers the daily review and (Stage 2) adds the assistant + forecasting.
    backend_base_url: str = "http://backend:3000/api/v1"

    # Service account used only to trigger the scheduled review.
    service_account_email: str = "admin@example.com"
    service_account_password: str = ""

    # Daily review time (Gulf Standard Time). Ref: §8.1.
    replenishment_run_time: str = "07:00"
    timezone: str = "Asia/Dubai"

    # Language model selection is a single switch — never edit feature code (§2.1).
    language_model_profile: str = "llama-development"
    ollama_url: str = "http://ollama:11434"


configuration = Configuration()
