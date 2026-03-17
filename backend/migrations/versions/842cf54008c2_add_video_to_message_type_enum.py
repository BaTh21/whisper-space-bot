from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '842cf54008c2'
down_revision = 'b9d99e4510d2'
branch_labels = None
depends_on = None

def upgrade():
    # Create the enum type if it doesn't exist
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
                CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'voice', 'system');
            END IF;
        END$$;
    """)

    # Add 'video' value
    op.execute("ALTER TYPE message_type ADD VALUE 'video'")

def downgrade():
    # Downgrade for enums is tricky; usually leave as is
    pass