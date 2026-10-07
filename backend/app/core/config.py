from pathlib import Path
from typing import List, Tuple
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgriMinds AI-DREWS API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Path to project root and ML artifacts
    BASE_DIR: Path = Path(__file__).resolve().parents[3]
    AI_DREWS_DIR: Path = BASE_DIR / "ai_drews"
    DATA_DIR: Path = AI_DREWS_DIR / "data"
    MODELS_DIR: Path = AI_DREWS_DIR / "models"
    OUTPUTS_DIR: Path = AI_DREWS_DIR / "outputs"
    
    # Choke Mountain Watershed Geo Configurations
    GRID_ROWS: int = 8
    GRID_COLS: int = 8
    BBOX: Tuple[float, float, float, float] = (37.6, 10.4, 38.4, 11.2)  # (lon_min, lat_min, lon_max, lat_max)
    
    # Leads and thresholds
    DROUGHT_LEADS: int = 3
    ENSO_LEADS: int = 6
    SPI_SCALE: int = 3
    SPI_DROUGHT_THRESHOLD: float = -1.0
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ]

    class Config:
        case_sensitive = True

settings = Settings()
