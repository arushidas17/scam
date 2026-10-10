import uuid
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import created_at_column, uuid_pk


class User(Base):
    """
    A person who can act on invoices.

    ``id`` is not generated here: it carries the Supabase auth user id, so a
    row only exists once the user has signed up through Supabase.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    role: Mapped[str] = mapped_column(String(40), nullable=False, server_default="reviewer")
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<User {self.email}>"
