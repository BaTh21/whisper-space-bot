"""remove public_id columns from group_messages

Revision ID: c163f033e2f5
Revises: 
Create Date: 2026-03-04 15:15:23.922455

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c163f033e2f5'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove public_id column
    op.drop_column("group_messages", "public_id")

    # Remove voice_public_id column
    op.drop_column("group_messages", "voice_public_id")


def downgrade() -> None:
    # Add public_id column back
    op.add_column(
        "group_messages",
        sa.Column("public_id", sa.String(length=255), nullable=True)
    )

    # Add voice_public_id column back
    op.add_column(
        "group_messages",
        sa.Column("voice_public_id", sa.String(length=255), nullable=True)
    )
