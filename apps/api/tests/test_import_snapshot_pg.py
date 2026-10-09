"""SQLite-to-PostgreSQL importer unit tests (no server required)."""
import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[3] / "packages/database/scripts/import_snapshot_pg.py"
spec = importlib.util.spec_from_file_location("import_snapshot_pg", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImportMappingTests(unittest.TestCase):
    def test_sqlite_types(self):
        self.assertEqual(module.pg_type("INTEGER"), "BIGINT")
        self.assertEqual(module.pg_type("TEXT"), "TEXT")
        self.assertEqual(module.pg_type("REAL"), "DOUBLE PRECISION")
        self.assertEqual(module.pg_type("BLOB"), "BYTEA")
        self.assertEqual(module.pg_type("NUMERIC"), "NUMERIC")
    def test_fail_closed_unknown_type(self):
        with self.assertRaises(ValueError):
            module.pg_type("JSON_MAGIC")
    def test_quote_identifiers(self):
        self.assertEqual(module.qi('my"table'), '"my""table"')

if __name__ == "__main__":
    unittest.main()
