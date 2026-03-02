"""Configurações da aplicação."""
import os
import yaml
from pathlib import Path
from typing import Dict, List
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_DIR = BASE_DIR / "config"


class Settings(BaseSettings):
    """Configurações da aplicação.
    Persistent DB: database_path grava em ficheiro (ex: data/warehouse.duckdb).
    Definir DATABASE_PATH no .env para override. Nunca usar :memory: em produção.
    """

    app_name: str = "Pagamentos Marketplace"
    locale: str = "pt-PT"
    database_path: str = "data/warehouse.duckdb"  # .env: DATABASE_PATH
    trf_window_days: int = 7
    # CORS: "*" para dev; em prod usar "https://meusite.com,https://outro.com"
    cors_origins: str = "*"
    # Em produção definir como false para não logar headers em cada pedido
    debug_logging: bool = True
    # Chave mestra para encriptar senhas em supplier_access (variável de ambiente SUPPLIER_ACCESS_SECRET)
    supplier_access_secret: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False

    def get_cors_origins(self) -> list[str]:
        """Devolve lista de origens CORS a partir da string configurada."""
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


def load_yaml_config(filename: str) -> Dict:
    """Carrega configuração de ficheiro YAML."""
    config_path = CONFIG_DIR / filename
    if not config_path.exists():
        return {}
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f) or {}


def get_settings() -> Settings:
    """Retorna instância de configurações."""
    return Settings()


def get_reserva_keywords() -> List[str]:
    """Retorna keywords para identificação de reservas."""
    config = load_yaml_config("settings.yaml")
    return config.get("reservas", {}).get("keywords", ["reserv", "reten", "hold", "escrow"])


def get_mapping_patterns() -> Dict:
    """Retorna padrões de mapeamento."""
    return load_yaml_config("mapping_patterns.yaml")

