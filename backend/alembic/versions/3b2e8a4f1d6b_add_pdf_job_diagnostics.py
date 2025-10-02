"""Add diagnostics column to pdf_jobs

Revision ID: 3b2e8a4f1d6b
Revises: 29e8204f390a
Create Date: 2025-10-02 20:05:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b2e8a4f1d6b'
down_revision: Union[str, Sequence[str], None] = '29e8204f390a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pdf_jobs', sa.Column('diagnostics', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pdf_jobs', 'diagnostics')
