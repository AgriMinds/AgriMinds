"""AI-DREWS: AI-enabled Drought Early Warning and decision Support (Choke Mountain Watershed).

The package is intentionally light to import: heavy dependencies (torch, scipy, sklearn)
are imported lazily inside the subpackages that need them, so `ai_drews.advisory` and
`ai_drews.config` can be used by services that never run a model.
"""

from ai_drews.config import DataPaths, PipelineConfig

__all__ = ["DataPaths", "PipelineConfig", "__version__"]
__version__ = "0.2.0"
