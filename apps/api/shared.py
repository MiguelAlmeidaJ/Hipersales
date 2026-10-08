from __future__ import annotations

"""Superfície compartilhada para os módulos do backend."""

try:
    from .foundation import *
except ImportError:  # Execução direta: python backend/app.py
    from foundation import *

try:
    from .documents import *
except ImportError:  # Execução direta: python backend/app.py
    from documents import *



