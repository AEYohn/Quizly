"""Simulation module for student modeling and session simulation."""

from .student_model import SimulatedStudent, generate_students
from .session_simulator import SessionSimulator

__all__ = ["SimulatedStudent", "generate_students", "SessionSimulator"]
