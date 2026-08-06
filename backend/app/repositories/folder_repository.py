from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.folder import Folder


def get_by_id(db: Session, folder_id: int) -> Folder | None:
    return db.get(Folder, folder_id)


def list_all(
    db: Session, *, organization_id: int | None = None, owner_id: int | None = None
) -> list[Folder]:
    query = select(Folder).order_by(Folder.name)
    if organization_id is not None:
        query = query.where(Folder.organization_id == organization_id)
    elif owner_id is not None:
        query = query.where(Folder.owner_id == owner_id)
    return list(db.scalars(query).all())


def create(
    db: Session,
    *,
    name: str,
    parent_id: int | None,
    organization_id: int | None,
    owner_id: int | None,
) -> Folder:
    folder = Folder(
        name=name,
        parent_id=parent_id,
        organization_id=organization_id,
        owner_id=owner_id,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


def rename(db: Session, folder: Folder, name: str) -> Folder:
    folder.name = name
    db.commit()
    db.refresh(folder)
    return folder


def delete(db: Session, folder: Folder) -> None:
    db.delete(folder)
    db.commit()