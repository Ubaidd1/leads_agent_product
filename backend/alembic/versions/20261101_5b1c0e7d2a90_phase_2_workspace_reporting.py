"""phase 2 workspace reporting settings and dashboard indexes

Revision ID: 5b1c0e7d2a90
Revises: 8035802ec75b
Create Date: 2026-11-01 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5b1c0e7d2a90'
down_revision: Union[str, Sequence[str], None] = '8035802ec75b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REGIONS = ("worldwide", "united-states", "canada", "latam", "europe", "united-kingdom", "pakistan-allowed", "international-remote")


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('workspaces', sa.Column('reporting_timezone', sa.String(length=64), server_default='UTC', nullable=False))
    op.add_column('workspaces', sa.Column('qualified_threshold', sa.Integer(), server_default='75', nullable=False))
    op.create_index('ix_hiring_signals_occurred_at', 'hiring_signals', ['occurred_at'], unique=False)
    op.create_index('ix_leads_first_seen_at', 'leads', ['first_seen_at'], unique=False)
    op.create_index('ix_leads_last_verified_at', 'leads', ['last_verified_at'], unique=False)
    op.create_index('ix_leads_status_workspace', 'leads', ['status', 'workspace_id'], unique=False)
    # Phase 1 stored display labels ("Worldwide"); the API validates region slugs ("worldwide").
    op.execute(
        sa.text(
            "UPDATE workspaces SET default_geography = lower(replace(default_geography, ' ', '-')) "
            "WHERE lower(replace(default_geography, ' ', '-')) IN :regions"
        ).bindparams(sa.bindparam("regions", REGIONS, expanding=True))
    )


def downgrade() -> None:
    """Downgrade schema. Region slugs are left as slugs; they remain valid values."""
    op.drop_index('ix_leads_status_workspace', table_name='leads')
    op.drop_index('ix_leads_last_verified_at', table_name='leads')
    op.drop_index('ix_leads_first_seen_at', table_name='leads')
    op.drop_index('ix_hiring_signals_occurred_at', table_name='hiring_signals')
    op.drop_column('workspaces', 'qualified_threshold')
    op.drop_column('workspaces', 'reporting_timezone')
