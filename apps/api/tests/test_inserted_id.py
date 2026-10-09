"""Unit checks for legacy SQLite and future PostgreSQL insert identifiers."""
from pathlib import Path
import sqlite3
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from foundation import inserted_id


class InsertedIdTests(unittest.TestCase):
    def test_sqlite_lastrowid(self):
        with sqlite3.connect(":memory:") as conn:
            conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)")
            cursor = conn.execute("INSERT INTO test (name) VALUES (?)", ("Test",))
            self.assertEqual(inserted_id(cursor), 1)

    def test_postgres_dict_row(self):
        class FakeCursor:
            lastrowid = None

            def fetchone(self):
                return {"id": 42}

        self.assertEqual(inserted_id(FakeCursor()), 42)

    def test_missing_returning_is_error(self):
        class FakeCursor:
            lastrowid = None

            def fetchone(self):
                return None

        with self.assertRaises(RuntimeError):
            inserted_id(FakeCursor())


if __name__ == "__main__":
    unittest.main()
