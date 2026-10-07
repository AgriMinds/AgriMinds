from fastapi import APIRouter, Depends

from agriminds_api.api.deps import get_enso
from agriminds_api.schemas.enso import EnsoOutlookResponse
from agriminds_api.services.enso import EnsoService

router = APIRouter(prefix="/enso", tags=["Climate Engine"])


@router.get("/outlook", response_model=EnsoOutlookResponse, summary="Niño 3.4 history and CNN-LSTM forecast")
def outlook(service: EnsoService = Depends(get_enso)) -> EnsoOutlookResponse:
    return service.outlook()
