"""add public_id and voice_public_id back

Revision ID: 8205bbcfdbd4
Revises: c163f033e2f5
Create Date: 2026-03-04 15:34:48.868589

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8205bbcfdbd4'
down_revision: Union[str, Sequence[str], None] = 'c163f033e2f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "group_messages",
        sa.Column("public_id", sa.String(length=255), nullable=True)
    )

    op.add_column(
        "group_messages",
        sa.Column("voice_public_id", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("group_messages", "public_id")
    op.drop_column("group_messages", "voice_public_id")
