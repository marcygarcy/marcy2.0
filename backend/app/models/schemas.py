"""Schemas Pydantic para requests e responses."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    """Resposta de upload."""
    success: bool
    message: str
    records_inserted: Optional[int] = None


class TransactionUpload(BaseModel):
    """Schema para upload de transações."""
    file_type: str = Field(..., description="Tipo de ficheiro: transactions, trf, accounting")


class CycleSummaryItem(BaseModel):
    """Item do resumo de ciclo."""
    key: str
    valor: float


class ReconciliationCycle(BaseModel):
    """Ciclo de conciliação."""
    ciclo: str
    cycle_end: str
    net: float
    trf_0_7: float
    diff: float


class ReconciliationResponse(BaseModel):
    """Resposta de conciliação."""
    cycles: List[ReconciliationCycle]


class CycleBreakdownItem(BaseModel):
    """Item do breakdown de ciclo."""
    tipo: str
    credito: float
    debito: float
    real: float
    quantidade: int


class CycleBreakdownResponse(BaseModel):
    """Resposta de breakdown do ciclo."""
    ciclo: Optional[str]
    data_ciclo: Optional[str]
    breakdown: List[CycleBreakdownItem]
    total_net: float

