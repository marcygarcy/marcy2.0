"""Configurações da aplicação."""
import os
import yaml
from pathlib import Path
from typing import Dict, List
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_DIR = BASE_DIR / "config"


class Settings(BaseSettings):
    """Configurações da aplicação."""
    
    app_name: str = "Pagamentos Marketplace"
    locale: str = "pt-PT"
    database_path: str = "data/warehouse.duckdb"
    trf_window_days: int = 7
    
    class Config:
        env_file = ".env"
        case_sensitive = False


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

