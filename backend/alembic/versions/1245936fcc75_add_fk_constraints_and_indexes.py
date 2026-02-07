"""add_fk_constraints_and_indexes

Revision ID: 1245936fcc75
Revises: 00ff918148de
Create Date: 2026-02-07 11:29:13.039863

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1245936fcc75'
down_revision: Union[str, None] = '00ff918148de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Foreign key constraints on game_id / source_game_id columns ---
    with op.batch_alter_table('exit_tickets', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_exit_tickets_game_id_sessions'),
            'sessions', ['game_id'], ['id'], ondelete='SET NULL',
        )

    with op.batch_alter_table('detailed_misconceptions', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_detailed_misconceptions_game_id_sessions'),
            'sessions', ['game_id'], ['id'], ondelete='SET NULL',
        )

    with op.batch_alter_table('peer_discussion_sessions', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_peer_discussion_sessions_game_id_sessions'),
            'sessions', ['game_id'], ['id'], ondelete='SET NULL',
        )

    with op.batch_alter_table('student_assignments', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_student_assignments_source_game_id_sessions'),
            'sessions', ['source_game_id'], ['id'], ondelete='SET NULL',
        )

    # --- Performance indexes ---
    with op.batch_alter_table('concept_mastery', schema=None) as batch_op:
        batch_op.create_index(
            'ix_concept_mastery_student_concept',
            ['student_name', 'concept'], unique=False,
        )

    with op.batch_alter_table('learning_sessions', schema=None) as batch_op:
        batch_op.create_index(
            'ix_learning_session_student_topic',
            ['student_name', 'topic'], unique=False,
        )
        batch_op.create_index(
            'ix_learning_session_student_created',
            ['student_name', 'created_at'], unique=False,
        )

    with op.batch_alter_table('spaced_repetition_items', schema=None) as batch_op:
        batch_op.create_index(
            'ix_spaced_rep_student_review',
            ['student_name', 'next_review_at'], unique=False,
        )


def downgrade() -> None:
    # --- Drop performance indexes ---
    with op.batch_alter_table('spaced_repetition_items', schema=None) as batch_op:
        batch_op.drop_index('ix_spaced_rep_student_review')

    with op.batch_alter_table('learning_sessions', schema=None) as batch_op:
        batch_op.drop_index('ix_learning_session_student_created')
        batch_op.drop_index('ix_learning_session_student_topic')

    with op.batch_alter_table('concept_mastery', schema=None) as batch_op:
        batch_op.drop_index('ix_concept_mastery_student_concept')

    # --- Drop foreign key constraints ---
    with op.batch_alter_table('student_assignments', schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f('fk_student_assignments_source_game_id_sessions'),
            type_='foreignkey',
        )

    with op.batch_alter_table('peer_discussion_sessions', schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f('fk_peer_discussion_sessions_game_id_sessions'),
            type_='foreignkey',
        )

    with op.batch_alter_table('detailed_misconceptions', schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f('fk_detailed_misconceptions_game_id_sessions'),
            type_='foreignkey',
        )

    with op.batch_alter_table('exit_tickets', schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f('fk_exit_tickets_game_id_sessions'),
            type_='foreignkey',
        )
