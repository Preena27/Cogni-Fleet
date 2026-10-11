"""Invoice / billing routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import require_manager
from ..websocket import manager

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.get("", response_model=list[schemas.InvoiceResponse])
def get_invoices(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    return db.query(models.Invoice).filter(models.Invoice.manager_id == current_user.id).all()


@router.put("/{invoice_id}", response_model=schemas.InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    invoice = (
        db.query(models.Invoice)
        .filter(models.Invoice.id == invoice_id, models.Invoice.manager_id == current_user.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = status
    db.commit()
    db.refresh(invoice)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "invoices"})
    return invoice
