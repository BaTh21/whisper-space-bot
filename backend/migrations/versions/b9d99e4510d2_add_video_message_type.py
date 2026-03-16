"""add video message type

Revision ID: b9d99e4510d2
Revises: 8205bbcfdbd4
Create Date: 2026-03-06 11:04:59.955038

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9d99e4510d2'
down_revision: Union[str, Sequence[str], None] = '8205bbcfdbd4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE messagetype ADD VALUE 'video'")
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
