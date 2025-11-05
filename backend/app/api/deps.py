"""Dependencies para FastAPI."""
from app.services.kpi_service import KPIService
from app.services.upload_service import UploadService
from app.services.invoice_service import InvoiceService
from app.services.bank_service import BankService
from app.services.empresa_service import EmpresaService
from app.services.marketplace_service import MarketplaceService


def get_kpi_service() -> KPIService:
    """Dependency para KPIService."""
    return KPIService()


def get_upload_service() -> UploadService:
    """Dependency para UploadService."""
    return UploadService()


def get_invoice_service() -> InvoiceService:
    """Dependency para InvoiceService."""
    return InvoiceService()


def get_bank_service() -> BankService:
    """Dependency para BankService."""
    return BankService()


def get_empresa_service() -> EmpresaService:
    """Dependency para EmpresaService."""
    return EmpresaService()


def get_marketplace_service() -> MarketplaceService:
    """Dependency para MarketplaceService."""
    return MarketplaceService()

