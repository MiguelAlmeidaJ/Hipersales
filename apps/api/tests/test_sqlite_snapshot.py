import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest

path = Path(__file__).resolve().parents[3] / "packages/database/scripts/prepare_sqlite_snapshot.py"
spec = importlib.util.spec_from_file_location("prepare_sqlite_snapshot", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SnapshotTests(unittest.TestCase):
    def test_preserves_rows_and_generates_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.sqlite3"
            output = Path(tmp) / "snapshot.sqlite3"
            with closing(sqlite3.connect(source)) as db:
                db.execute("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT)")
                db.execute("INSERT INTO customers VALUES (1, 'Test')")
            report = module.snapshot(source, output)
            self.assertEqual(report["table_counts"]["customers"], 1)
            self.assertEqual(report["foreign_key_violations"], 0)
            self.assertTrue(Path(str(output) + ".manifest.json").exists())
            with closing(sqlite3.connect(output)) as db:
                self.assertEqual(db.execute("SELECT name FROM customers WHERE id=1").fetchone()[0], "Test")
            with self.assertRaises(FileExistsError):
                module.snapshot(source, output)

    def test_rejects_broken_foreign_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "bad.sqlite3"
            output = Path(tmp) / "snapshot.sqlite3"
            with closing(sqlite3.connect(source)) as db:
                db.execute("PRAGMA foreign_keys=OFF")
                db.execute("CREATE TABLE parent(id INTEGER PRIMARY KEY)")
                db.execute("CREATE TABLE child(parent_id INTEGER REFERENCES parent(id))")
                db.execute("INSERT INTO child VALUES (99)")
            with self.assertRaises(RuntimeError):
                module.snapshot(source, output)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
