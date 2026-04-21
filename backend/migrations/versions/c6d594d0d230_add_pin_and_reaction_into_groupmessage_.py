"""add pin and reaction into groupmessage model

Revision ID: c6d594d0d230
Revises: 842cf54008c2
Create Date: 2026-04-13 11:42:12.965438

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c6d594d0d230'
down_revision: Union[str, Sequence[str], None] = '842cf54008c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # -------------------------
    # 1. Add pin + summary columns
    # -------------------------
    op.add_column(
        'group_messages',
        sa.Column('is_pinned', sa.Boolean(), nullable=True, server_default=sa.false())
    )
    op.add_column(
        'group_messages',
        sa.Column('pinned_by_id', sa.Integer(), nullable=True)
    )
    op.add_column(
        'group_messages',
        sa.Column('pinned_at', sa.DateTime(timezone=True), nullable=True)
    )

    # ✅ use JSONB instead of JSON
    op.add_column(
        'group_messages',
        sa.Column('reaction_summary', sa.dialects.postgresql.JSONB(), nullable=True)
    )

    op.create_foreign_key(
        'fk_group_messages_pinned_by',
        'group_messages', 'users',
        ['pinned_by_id'], ['id'],
        ondelete='SET NULL'
    )

    # -------------------------
    # 2. Create reactions table (NO ENUM)
    # -------------------------
    op.create_table(
        'group_message_reactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('message_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),

        # ✅ STRING instead of ENUM
        sa.Column('reaction', sa.String(length=20), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),

        sa.ForeignKeyConstraint(['message_id'], ['group_messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),

        sa.UniqueConstraint('message_id', 'user_id', name='unique_user_reaction')
    )

    op.create_index(
        'idx_reaction_message_id',
        'group_message_reactions',
        ['message_id']
    )


def downgrade():
    # -------------------------
    # 1. Drop reactions table
    # -------------------------
    op.drop_index('idx_reaction_message_id', table_name='group_message_reactions')
    op.drop_table('group_message_reactions')

    # -------------------------
    # 2. Remove columns
    # -------------------------
    op.drop_constraint('fk_group_messages_pinned_by', 'group_messages', type_='foreignkey')

    op.drop_column('group_messages', 'reaction_summary')
    op.drop_column('group_messages', 'pinned_at')
    op.drop_column('group_messages', 'pinned_by_id')
    op.drop_column('group_messages', 'is_pinned')