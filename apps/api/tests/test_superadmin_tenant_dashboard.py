"""Integration checks for tenant-isolated superadmin dashboard using SQLite fixture."""
from __future__ import annotations
from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tenant_goals import TenantGoalsMixin

class TenantDashboardTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript("""
            CREATE TABLE tenants(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,status TEXT);
            CREATE TABLE proposals(id INTEGER PRIMARY KEY,tenant_id INTEGER,customer_id INTEGER,company_id INTEGER,
                seller_id INTEGER,order_number INTEGER,status TEXT,created_at TEXT);
            CREATE TABLE customers(id INTEGER PRIMARY KEY,tenant_id INTEGER,legal_name TEXT,active INTEGER);
            CREATE TABLE companies(id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,active INTEGER);
            CREATE TABLE products(id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,active INTEGER);
            CREATE TABLE users(id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,role TEXT,active INTEGER);
            CREATE TABLE proposal_items(proposal_id INTEGER,product_id INTEGER,quantity REAL,negotiated_price REAL);
            CREATE TABLE registration_requests(tenant_id INTEGER,status TEXT);
            INSERT INTO tenants VALUES (1,'Tenant A','a','active'),(2,'Tenant B','b','active');
            INSERT INTO customers VALUES (11,1,'Cliente A',1),(22,2,'Cliente B',1);
            INSERT INTO companies VALUES (11,1,'Industria A',1),(22,2,'Industria B',1);
            INSERT INTO products VALUES (11,1,'Produto A',1),(22,2,'Produto B',1);
            INSERT INTO users VALUES (11,1,'Vendedor A','seller',1),(22,2,'Vendedor B','seller',1);
            INSERT INTO proposals VALUES
                (11,1,11,11,11,1001,'entregue','2026-10-08T10:00:00+00:00'),
                (22,2,22,22,22,2002,'entregue','2026-10-08T10:00:00+00:00');
            INSERT INTO proposal_items VALUES (11,11,2,100),(22,22,8,1000);
            INSERT INTO registration_requests VALUES (1,'pendente'),(2,'pendente');
        """)
        self.dashboard = TenantGoalsMixin()

    def tearDown(self):
        self.conn.close()

    def test_tenant_isolation(self):
        value = self.dashboard.super_admin_tenant_dashboard(self.conn,1,{})
        self.assertEqual(value["summary"]["orders"],1)
        self.assertEqual(value["summary"]["revenue"],200)
        self.assertEqual(value["summary"]["customers"],1)
        self.assertEqual(value["company_ranking"][0]["name"],"Industria A")
        self.assertEqual(value["seller_ranking"][0]["name"],"Vendedor A")
        self.assertEqual(value["top_products"][0]["name"],"Produto A")
        self.assertEqual(value["recent_orders"][0]["customer_name"],"Cliente A")
        self.assertNotIn("Tenant B",str(value))

    def test_search_date_and_status(self):
        result=self.dashboard.super_admin_tenant_dashboard(self.conn,1,{"q":["nao existe"]})
        self.assertEqual(result["summary"]["orders"],0)
        self.assertEqual(result["summary"]["revenue"],0)
        result=self.dashboard.super_admin_tenant_dashboard(self.conn,1,{"status":["em_analise"]})
        self.assertEqual(result["summary"]["orders"],0)
        result=self.dashboard.super_admin_tenant_dashboard(self.conn,1,{"date_from":["2026-10-09"]})
        self.assertEqual(result["summary"]["orders"],0)
        result=self.dashboard.super_admin_tenant_dashboard(self.conn,1,{"q":["Cliente A"],"date_from":["2026-10-01"],"date_to":["2026-10-09"]})
        self.assertEqual(result["summary"]["orders"],1)

    def test_invalid_tenant(self):
        with self.assertRaises(Exception):
            self.dashboard.super_admin_tenant_dashboard(self.conn,999,{})

if __name__=="__main__":
    unittest.main()
