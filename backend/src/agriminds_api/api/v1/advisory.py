from fastapi import APIRouter, Depends

from agriminds_api.api.deps import get_advisory
from agriminds_api.schemas.advisory import AdvisoryRequest, AdvisoryResponse
from agriminds_api.services.advisory import AdvisoryService

router = APIRouter(prefix="/advisories", tags=["Agro-Decision Support"])


@router.post("/evaluate", response_model=AdvisoryResponse, summary="Crop advisory for a cell, lead and crop")
def evaluate(req: AdvisoryRequest, service: AdvisoryService = Depends(get_advisory)) -> AdvisoryResponse:
    return service.evaluate(req)
