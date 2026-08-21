import os

from app.core.security import hash_password
from app.database.connection import SessionLocal
from app.models.user import UserRole
from app.repositories import organization_repository, user_repository

DEMO_PASSWORD = "Demo@2026!"

DEMO_ORGS = [
    {
        "name": "Cong ty Alpha",
        "manager": ("Quan ly Alpha", "manager.alpha@example.com", DEMO_PASSWORD),
        "staff": [("Nhan vien A1", "staff.a1@example.com"), ("Nhan vien A2", "staff.a2@example.com")],
    },
    {
        "name": "Truong Dai hoc Beta",
        "manager": ("Quan ly Beta", "manager.beta@example.com", DEMO_PASSWORD),
        "staff": [("Nhan vien B1", "staff.b1@example.com"), ("Nhan vien B2", "staff.b2@example.com")],
    },
]

DEMO_INDIVIDUAL = ("Ca nhan Z", "individual.z@example.com", DEMO_PASSWORD)


def seed_super_admin(db) -> None:
    email = os.getenv("SUPER_ADMIN_EMAIL", "admin@example.com")
    # Mật khẩu mặc định chỉ dùng cho môi trường demo; trong sản xuất hãy đặt biến môi trường
    password = os.getenv("SUPER_ADMIN_PASSWORD", "Admin@2026!")
    if user_repository.get_by_email(db, email):
        print(f"super_admin '{email}' already exists, skip.")
        return
    user_repository.create(
        db,
        full_name="Admin he thong",
        email=email,
        hashed_password=hash_password(password),
        role=UserRole.SUPER_ADMIN,
    )
    print(f"Created super_admin: {email} / {password}")


def _create_user(db, full_name, email, role, organization_id=None):
    if user_repository.get_by_email(db, email):
        return None
    return user_repository.create(
        db,
        full_name=full_name,
        email=email,
        hashed_password=hash_password(DEMO_PASSWORD),
        role=role,
        organization_id=organization_id,
    )


def seed_demo(db) -> None:
    for org in DEMO_ORGS:
        organization = organization_repository.get_by_name(db, org["name"])
        if not organization:
            organization = organization_repository.create(db, name=org["name"])
            print(f"Created organization: {org['name']}")
        m_name, m_email, _ = org["manager"]
        _create_user(db, m_name, m_email, UserRole.MANAGER, organization.id)
        for s_name, s_email in org["staff"]:
            _create_user(db, s_name, s_email, UserRole.STAFF, organization.id)
    _create_user(db, DEMO_INDIVIDUAL[0], DEMO_INDIVIDUAL[1], UserRole.INDIVIDUAL)
    print("Demo data ready.")


def seed() -> None:
    with SessionLocal() as db:
        seed_super_admin(db)
        seed_demo(db)


if __name__ == "__main__":
    seed()
