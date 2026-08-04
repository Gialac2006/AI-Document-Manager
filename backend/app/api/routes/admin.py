from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_super_admin
from app.core.exceptions import DuplicateError, NotFoundError
from app.database.connection import get_db
from app.models.user import User
from app.repositories import organization_repository, user_repository
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationDetail,
    OrganizationRead,
)
from app.schemas.user import UserRead

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/organizations", response_model=list[OrganizationRead])
def list_organizations(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return organization_repository.list_organizations(db)


@router.post(
    "/organizations", response_model=OrganizationRead, status_code=201
)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    if organization_repository.get_by_name(db, data.name):
        raise DuplicateError("Tên tổ chức đã tồn tại")
    return organization_repository.create(db, name=data.name.strip())


@router.get(
    "/organizations/{organization_id}", response_model=OrganizationDetail
)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    organization = organization_repository.get_by_id(db, organization_id)
    if not organization:
        raise NotFoundError("Tổ chức không tồn tại")
    organization.members = user_repository.list_users(
        db, organization_id=organization_id
    )
    return organization


@router.delete("/organizations/{organization_id}", status_code=204)
def delete_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    organization = organization_repository.get_by_id(db, organization_id)
    if not organization:
        raise NotFoundError("Tổ chức không tồn tại")
    db.delete(organization)
    db.commit()


@router.get("/users", response_model=list[UserRead])
def list_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return user_repository.list_users(db)
