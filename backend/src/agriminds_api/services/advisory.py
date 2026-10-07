from __future__ import annotations

from ai_drews.advisory import advise

from agriminds_api.schemas.advisory import AdvisoryRequest, AdvisoryResponse
from agriminds_api.services.drought import DroughtService
from agriminds_api.services.inference import InferenceService


class AdvisoryService:
    def __init__(self, inference: InferenceService, drought: DroughtService) -> None:
        self._inference = inference
        self._drought = drought

    def evaluate(self, req: AdvisoryRequest) -> AdvisoryResponse:
        cube = self._inference.risk_cube()
        cell = self._drought.resolve_cell(req.row, req.col, req.latitude, req.longitude)
        p = float(cube.probs[req.lead_month - 1, cell.row, cell.col])
        target = cube.target(req.lead_month)
        result = advise(
            p=p,
            lead_month=req.lead_month,
            crop=req.crop,
            target_month=target.month,
            nino34=self._inference.nino_for_lead(req.lead_month),
            iek_agrees=req.iek_agrees,
        )
        return AdvisoryResponse(
            **result.to_dict(),
            row=cell.row,
            col=cell.col,
            target_date=target.strftime("%B %Y"),
            provenance=cube.provenance(),
        )
