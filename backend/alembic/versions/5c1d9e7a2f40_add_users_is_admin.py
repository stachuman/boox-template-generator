"""Add is_admin column to users

Revision ID: 5c1d9e7a2f40
Revises: 3b2e8a4f1d6b
Create Date: 2026-10-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c1d9e7a2f40'
down_revision: Union[str, Sequence[str], None] = '3b2e8a4f1d6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Deployments that ran the old docker-entrypoint.sh already have the column.
    existing = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('users')}
    if 'is_admin' not in existing:
        op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('users', 'is_admin')
