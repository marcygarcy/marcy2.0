"""Dependencies para FastAPI."""
from app.services.kpi_service import KPIService
from app.services.upload_service import UploadService
from app.services.invoice_service import InvoiceService
from app.services.bank_service import BankService
from app.services.empresa_service import EmpresaService
from app.services.marketplace_service import MarketplaceService
from app.services.sales_service import SalesService
from app.services.sales_module_service import SalesModuleService
from app.services.purchase_service import BulkPurchaseService
from app.services.purchase_aggregator_service import PurchaseAggregatorService
from app.services.master_data_service import MasterDataService
from app.services.accounting_match_service import AccountingMatchService
from app.services.billing_service import BillingService


def get_billing_service() -> BillingService:
    """Dependency para BillingService (proformas, documentos comerciais)."""
    return BillingService()


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


def get_sales_service() -> SalesService:
    """Dependency para SalesService (módulo Sales & Orders)."""
    return SalesService()


def get_sales_module_service() -> SalesModuleService:
    """Dependency para SalesModuleService (import, list, stats sales_orders)."""
    return SalesModuleService()


def get_bulk_purchase_service() -> BulkPurchaseService:
    """Dependency para BulkPurchaseService (Global Cockpit, prepare_bulk_purchases)."""
    return BulkPurchaseService()


def get_purchase_aggregator_service() -> PurchaseAggregatorService:
    """Dependency para PurchaseAggregatorService (Fase 3: pending -> POs por empresa/fornecedor)."""
    return PurchaseAggregatorService()


def get_master_data_service() -> MasterDataService:
    """Dependency para MasterDataService (ficha fornecedor, prepare_draft_purchase)."""
    return MasterDataService()


def get_accounting_service() -> AccountingMatchService:
    """Dependency para AccountingMatchService (Fase 5: ledger, triple-match, aging, profitability)."""
    return AccountingMatchService()

