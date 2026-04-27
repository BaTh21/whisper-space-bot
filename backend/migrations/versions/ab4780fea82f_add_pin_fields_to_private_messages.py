"""add pin fields to private_messages

Revision ID: ab4780fea82f
Revises: c6d594d0d230
Create Date: 2026-04-22 11:13:58.855737

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ab4780fea82f'
down_revision: Union[str, Sequence[str], None] = 'c6d594d0d230'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "private_messages",
        sa.Column("is_pinned", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "private_messages",
        sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "private_messages",
        sa.Column("pinned_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_private_messages_pinned_by_users",
        "private_messages",
        "users",
        ["pinned_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_private_messages_pinned_by_users", "private_messages", type_="foreignkey")
    op.drop_column("private_messages", "pinned_by")
    op.drop_column("private_messages", "pinned_at")
    op.drop_column("private_messages", "is_pinned")