"""Run with: python3 -m unittest discover -s apps/api/tests -p 'test_postgres_adapter.py'"""
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / "postgres_adapter.py"
spec = importlib.util.spec_from_file_location("postgres_adapter", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TranslatorTests(unittest.TestCase):
    def test_parameters(self):
        self.assertEqual(module.translate_qmark("SELECT * FROM users WHERE id = ? AND name = ?"), "SELECT * FROM users WHERE id = %s AND name = %s")

    def test_question_mark_literals(self):
        source = """SELECT '?' AS literal, "?" AS ident, value FROM x WHERE id = ? -- ? ignored\nAND name = '?' /* ? */ AND flag = ?"""
        expected = """SELECT '?' AS literal, "?" AS ident, value FROM x WHERE id = %s -- ? ignored\nAND name = '?' /* ? */ AND flag = %s"""
        self.assertEqual(module.translate_qmark(source), expected)

    def test_escaped_quotes(self):
        self.assertEqual(module.translate_qmark("SELECT 'isn''t ?' FROM x WHERE x = ?"), "SELECT 'isn''t ?' FROM x WHERE x = %s")

    def test_percent_escape(self):
        self.assertEqual(module.translate_qmark("SELECT * FROM x WHERE name LIKE 'ab%' AND id=?"), "SELECT * FROM x WHERE name LIKE 'ab%%' AND id=%s")

    def test_insert_ignore_translation(self):
        self.assertEqual(
            module.translate_simple_dml("INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)"),
            "INSERT INTO users (id, name) VALUES (%s, %s) ON CONFLICT DO NOTHING"
        )
        self.assertEqual(
            module.translate_simple_dml("INSERT OR IGNORE INTO roles (id) VALUES (?);"),
            "INSERT INTO roles (id) VALUES (%s) ON CONFLICT DO NOTHING;"
        )

    def test_reject_sqlite_catalog(self):
        with self.assertRaises(ValueError):
            module.translate_simple_dml("SELECT name FROM sqlite_master")

    def test_reject_multistatement_ignore(self):
        with self.assertRaises(ValueError):
            module.translate_insert_or_ignore("INSERT OR IGNORE INTO a VALUES (1); DELETE FROM b;")

    def test_facade_commit_and_rollback(self):
        from unittest.mock import patch
        class FakeConnection:
            def __init__(self):
                self.actions = []
            def execute(self, sql, parameters):
                self.actions.append(("execute", sql, parameters))
                return {"ok": True}
            def commit(self):
                self.actions.append(("commit",))
            def rollback(self):
                self.actions.append(("rollback",))
            def close(self):
                self.actions.append(("close",))
        fake = FakeConnection()
        with patch.object(module, "postgresql_connect", return_value=fake):
            with module.PostgreSQLConnection("postgresql://test") as conn:
                conn.execute("SELECT * FROM users WHERE id=?", (7,))
        self.assertEqual(fake.actions, [
            ("execute", "SELECT * FROM users WHERE id=%s", (7,)),
            ("commit",), ("close",)])
        fake.actions.clear()
        with patch.object(module, "postgresql_connect", return_value=fake):
            with self.assertRaises(ValueError):
                with module.PostgreSQLConnection("postgresql://test"):
                    raise ValueError("rollback")
        self.assertEqual(fake.actions, [("rollback",), ("close",)])

    def test_dsn_rejected(self):
        with self.assertRaises(ValueError):
            module.postgresql_connect("sqlite:///foo.db")

    def test_sql_inventory(self):
        counts = module.sql_dialect_report("INSERT OR IGNORE INTO x VALUES (?)\nSELECT * FROM sqlite_master; PRAGMA foreign_keys=ON")
        self.assertEqual(counts["insert_or_ignore"], 1)
        self.assertEqual(counts["sqlite_master"], 1)
        self.assertEqual(counts["pragma"], 1)


if __name__ == "__main__":
    unittest.main()
