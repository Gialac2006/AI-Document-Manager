from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.organization import Organization


def get_by_id(db: Session, organization_id: int) -> Organization | None:
    return db.get(Organization, organization_id)


def get_by_name(db: Session, name: str) -> Organization | None:
    return db.scalar(select(Organization).where(Organization.name == name))


def create(db: Session, *, name: str) -> Organization:
    organization = Organization(name=name)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def list_organizations(db: Session) -> list[Organization]:
    return list(db.scalars(select(Organization).order_by(Organization.id)).all())
