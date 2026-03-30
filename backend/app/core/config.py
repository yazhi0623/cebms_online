from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    """从环境变量和 `.env` 中加载运行配置。"""
    APP_NAME: str = "CEBMS API"
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    POSTGRES_SERVER: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "cebms"
    POSTGRES_USER: str = "cebms_user"
    POSTGRES_PASSWORD: str = "cebms_pw"

    JWT_SECRET_KEY: str = "53db5a7068ee3b0ad97ca14f864a430ea100e6de9bd6a9c691a201bd83e9b2cdd94f1dde710378cf103adae88282b94ff8570eeec79b33aae38a2fec05515328"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AUTH_REGISTRATION_ENABLED: bool = False
    AUTH_LOGIN_RATE_LIMIT_ENABLED: bool = True
    AUTH_LOGIN_RATE_LIMIT_ATTEMPTS: int = 5
    AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300
    TOAST_DURATION_MS: int = 2400
    DAILY_ANALYSIS_LIMIT: int = 20
    DAILY_ANALYSIS_LIMIT_WHEN_LLM_DISABLED: int = 5
    ANALYSIS_THRESHOLD: int = 10
    ANALYSIS_LLM_ENABLED: bool = True
    ANALYSIS_MAX_LLM_OUTPUT_CHARS: int = 300
    ANALYSIS_MODELS_PATH: str = str(Path(__file__).resolve().parents[2] / "config" / "models.json")
    ANALYSIS_WEATHER_ENABLED: bool = False
    ANALYSIS_WEATHER_LOCATION_LABEL: str = ""
    ANALYSIS_WEATHER_LATITUDE: float | None = None
    ANALYSIS_WEATHER_LONGITUDE: float | None = None
    ANALYSIS_WEATHER_TIMEOUT_SECONDS: int = 5
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    BACKEND_CORS_ORIGINS: str = "http://127.0.0.1:5173,http://localhost:5173"
    BACKEND_TRUSTED_HOSTS: str = ""
    UPLOAD_MAX_FILE_SIZE_MB: int = 20
    SECURE_RESPONSE_HEADERS_ENABLED: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """把分散的数据库字段拼成 SQLAlchemy 连接串。"""
        return URL.create(
            "postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        ).render_as_string(hide_password=False)

    @property
    def cors_origins(self) -> list[str]:
        """把配置中的 CORS 地址转成去空白后的列表。"""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def trusted_hosts(self) -> list[str]:
        """Return configured trusted hosts as a trimmed list."""
        return [host.strip() for host in self.BACKEND_TRUSTED_HOSTS.split(",") if host.strip()]

    @property
    def upload_max_file_size_bytes(self) -> int:
        """Return the maximum allowed upload size in bytes."""
        return max(self.UPLOAD_MAX_FILE_SIZE_MB, 1) * 1024 * 1024

    @property
    def is_production(self) -> bool:
        """Return whether the app is running in production mode."""
        return self.APP_ENV.strip().lower() == "production"

    def validate_runtime_security(self) -> None:
        """Block production startup when critical security settings are unsafe."""
        if not self.is_production:
            return

        if self.APP_DEBUG:
            raise RuntimeError("APP_DEBUG must be disabled in production")

        if self.JWT_SECRET_KEY.strip() in {"", "change-me", "changeme"}:
            raise RuntimeError("JWT_SECRET_KEY must be set to a strong non-default value in production")


@lru_cache
def get_settings() -> Settings:
    """缓存配置对象，避免进程内重复解析环境变量。"""
    return Settings()


settings = get_settings()
