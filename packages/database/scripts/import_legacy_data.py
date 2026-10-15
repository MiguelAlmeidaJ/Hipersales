#!/usr/bin/env python3
"""Import SQLite backup to an EXISTING EMPTY SQL Server Prisma schema.

Requirements: pip install pyodbc; Microsoft ODBC Driver 18 for SQL Server.
Environment: SQLSERVER_HOST (default 127.0.0.1,14333), SQLSERVER_DATABASE
(default hipersales), SQLSERVER_USER (default sa), SQLSERVER_PASSWORD required.
Usage: python packages/database/scripts/import_legacy_data.py '/path/to/backup.sqlite3' [--execute]
Without --execute: read-only preflight. During --execute, import is one transaction.
"""
import argparse
import datetime as dt
import os
import sqlite3
import sys
from decimal import Decimal
from pathlib import Path


def identifier(name):
    return '[' + name.replace(']', ']]') + ']'


def connect_sqlserver():
    import pyodbc
    password = os.environ.get('SQLSERVER_PASSWORD')
    if not password:
        raise RuntimeError('Set SQLSERVER_PASSWORD in the current terminal (do not publish it).')
    server = os.getenv('SQLSERVER_HOST', '127.0.0.1,14333')
    database = os.getenv('SQLSERVER_DATABASE', 'hipersales')
    user = os.getenv('SQLSERVER_USER', 'sa')
    # ODBC connection values wrapped in braces, escaping embedded braces.
    def brace(v): return '{' + str(v).replace('}', '}}') + '}'
    connstr = ';'.join([
        'DRIVER={ODBC Driver 18 for SQL Server}',
        f'SERVER={brace(server)}', f'DATABASE={brace(database)}',
        f'UID={brace(user)}', f'PWD={brace(password)}',
        'Encrypt=yes', 'TrustServerCertificate=yes', 'Connection Timeout=15',
    ]) + ';'
    conn = pyodbc.connect(connstr, autocommit=False)
    return conn


def columns(cursor, table):
    sql = '''SELECT c.name, ty.name, c.is_nullable, c.is_identity,
                CASE WHEN dc.object_id IS NULL THEN 0 ELSE 1 END AS has_default,
                c.is_computed
             FROM sys.columns c
             JOIN sys.types ty ON c.user_type_id=ty.user_type_id
             LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
             WHERE c.object_id=OBJECT_ID(?) ORDER BY c.column_id'''
    return {r[0]:dict(type=r[1].lower(),nullable=bool(r[2]),identity=bool(r[3]),
                       default=bool(r[4]),computed=bool(r[5])) for r in cursor.execute(sql, f'dbo.{table}').fetchall()}


def transform(value, sql_type):
    if value is None:
        return None
    if sql_type == 'bit':
        return bool(value)
    if sql_type in ('decimal', 'numeric', 'money', 'smallmoney'):
        return Decimal(str(value))
    if sql_type in ('datetime', 'datetime2', 'smalldatetime', 'date', 'datetimeoffset', 'time') and isinstance(value,str):
        value=value.strip().replace('Z','+00:00')
        if sql_type == 'date': return dt.date.fromisoformat(value[:10])
        if sql_type == 'time': return dt.time.fromisoformat(value)
        value=dt.datetime.fromisoformat(value.replace(' ','T'))
        # SQLite stores naive timestamp strings. Treat timezone-marked values as UTC.
        if value.tzinfo:
            value=value.astimezone(dt.timezone.utc).replace(tzinfo=None)
        return value
    if isinstance(value, bytes):
        return bytes(value)
    return value


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('sqlite_file',type=Path)
    ap.add_argument('--execute',action='store_true',help='Import rows after checks, otherwise dry run')
    args=ap.parse_args()
    uri='file:'+args.sqlite_file.resolve().as_posix()+'?mode=ro'
    source=sqlite3.connect(uri,uri=True)
    source.row_factory=sqlite3.Row
    integrity=source.execute('PRAGMA integrity_check').fetchone()[0]
    bad_fks=source.execute('PRAGMA foreign_key_check').fetchall()
    if integrity != 'ok' or bad_fks:
        raise RuntimeError(f'SQLite validation failed (integrity={integrity}, FK violations={len(bad_fks)})')
    source.execute('BEGIN')  # stable read snapshot; source is opened read-only
    src_tables={r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
    dest=connect_sqlserver()
    cur=dest.cursor()
    dst_tables={r[0] for r in cur.execute("SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND is_ms_shipped=0 AND name <> '_prisma_migrations'").fetchall()}
    missing=src_tables-dst_tables
    if missing:
        raise RuntimeError('Tables missing in target: '+', '.join(sorted(missing)))
    extra=dst_tables-src_tables
    if extra:
        raise RuntimeError('Target contains unexpected application tables: '+', '.join(sorted(extra)))
    # Foreign-key dependencies from the REAL target schema, not an assumed order.
    dependencies={t:set() for t in src_tables}
    for child,parent in cur.execute('''SELECT OBJECT_NAME(parent_object_id),OBJECT_NAME(referenced_object_id)
                                  FROM sys.foreign_keys WHERE schema_id=SCHEMA_ID('dbo')''').fetchall():
        if child in dependencies and parent in dependencies and child != parent:
            dependencies[child].add(parent)
    ordered=[]
    pending={t:set(deps) for t,deps in dependencies.items()}
    while pending:
        ready=sorted(t for t, deps in pending.items() if not deps)
        if not ready:
            raise RuntimeError('Cyclic foreign keys in target; cannot import safely: '+str(pending))
        for table in ready:
            ordered.append(table)
            pending.pop(table)
        for deps in pending.values(): deps.difference_update(ready)
    # The historical database allowed users without tenant_id. In single-tenant
    # mode, only those NULL values may be normalized to the existing singleton.
    tenant_row = source.execute('SELECT id FROM tenants').fetchall()
    if len(tenant_row) != 1:
        raise RuntimeError('Expected exactly one source tenant for single-tenant import.')
    singleton_id = tenant_row[0][0]
    invalid_users = source.execute(
        'SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL AND tenant_id <> ?',
        (singleton_id,),
    ).fetchone()[0]
    if invalid_users:
        raise RuntimeError(f'Users referencing another tenant: {invalid_users}')
    null_user_tenants = source.execute(
        'SELECT COUNT(*) FROM users WHERE tenant_id IS NULL'
    ).fetchone()[0]
    if null_user_tenants:
        print(f'users: will normalize {null_user_tenants} NULL tenant_id value(s) to {singleton_id}')
    plans=[]
    print('Source integrity OK; target schema found. Checking destination emptiness...')
    for table in ordered:
        target_cols=columns(cur,table)
        source_cols=[r[1] for r in source.execute('PRAGMA table_info('+identifier(table)+')')]
        use=[c for c in source_cols if c in target_cols and not target_cols[c]['computed']]
        ignored=[c for c in source_cols if c not in target_cols]
        if ignored:
            raise RuntimeError(f'{table}: source columns absent from target: {ignored}')
        required=[c for c,meta in target_cols.items() if c not in use and not meta['nullable'] and not meta['identity'] and not meta['default'] and not meta['computed']]
        if required:
            raise RuntimeError(f'{table}: required columns unavailable in source: {required}')
        orig=source.execute('SELECT COUNT(*) FROM '+identifier(table)).fetchone()[0]
        existing=cur.execute('SELECT COUNT_BIG(*) FROM dbo.'+identifier(table)).fetchone()[0]
        if table == 'tenants' and existing == 1 and orig == 1:
            source_tenant = source.execute('SELECT id, slug FROM tenants').fetchone()
            target_tenant = cur.execute('SELECT id, slug FROM dbo.tenants').fetchone()
            if (source_tenant['id'], source_tenant['slug']) != (target_tenant[0], target_tenant[1]):
                raise RuntimeError(
                    'Existing tenant does not match source id/slug; refusing to remap foreign keys.'
                )
            print(f'tenants: preserved existing singleton (id={target_tenant[0]}, slug={target_tenant[1]})')
            plans.append((table, use, target_cols, 0))
            continue
        if existing:
            raise RuntimeError(f'{table} is NOT EMPTY ({existing} rows). Refusing to overwrite.')
        plans.append((table,use,target_cols,orig))
        print(f'{table}: {orig} rows, {len(use)} fields')
    print(f'TOTAL {sum(p[3] for p in plans)} rows, {len(plans)} tables')
    if not args.execute:
        print('DRY RUN ONLY: No changes. Run again with --execute when ready.')
        dest.rollback()
        return
    # Isolation: no other application may write to target during migration.
    try:
        for table, use, metadata, count in plans:
            if not count:
                continue
            identity=any(metadata[c]['identity'] for c in use)
            if identity: cur.execute('SET IDENTITY_INSERT dbo.'+identifier(table)+' ON')
            sql='INSERT INTO dbo.'+identifier(table)+' ('+','.join(identifier(c) for c in use)+') VALUES ('+','.join('?' for _ in use)+')'
            sql_src='SELECT '+','.join(identifier(c) for c in use)+' FROM '+identifier(table)
            n=0
            rows=source.execute(sql_src)
            while True:
                batch=rows.fetchmany(100)
                if not batch: break
                for row in batch:
                    vals=[(
                        singleton_id if table == 'users' and c == 'tenant_id' and row[c] is None
                        else transform(row[c], metadata[c]['type'])
                    ) for c in use]
                    cur.execute(sql,vals)
                    n+=1
            if identity: cur.execute('SET IDENTITY_INSERT dbo.'+identifier(table)+' OFF')
            observed=cur.execute('SELECT COUNT_BIG(*) FROM dbo.'+identifier(table)).fetchone()[0]
            if observed != count or n != count:
                raise RuntimeError(f'Row mismatch for {table}: source={count}, inserted={n}, target={observed}')
            # Correct identity seeds based on migrated keys.
            if identity:
                id_col=next(c for c in use if metadata[c]['identity'])
                max_id=cur.execute('SELECT MAX('+identifier(id_col)+') FROM dbo.'+identifier(table)).fetchone()[0]
                if max_id is not None:
                    safe_table='dbo.'+identifier(table)
                    cur.execute('DBCC CHECKIDENT (\''+safe_table+'\', RESEED, '+str(int(max_id))+') WITH NO_INFOMSGS')
            print('Imported',table,n)
        # Verify SQL Server trusted foreign keys post-import.
        cur.execute('DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS')
        violations=cur.fetchall() if cur.description else []
        if violations:
            raise RuntimeError(f'SQL Server check constraints violations: {len(violations)}')
        dest.commit()
        print('COMMITTED: imported',sum(p[3] for p in plans),'records; source preserved.')
    except BaseException:
        dest.rollback()
        print('ERROR: Transaction rolled back. No data committed.',file=sys.stderr)
        raise
    finally:
        dest.close()
        source.close()

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('IMPORT FAILED:',str(e),file=sys.stderr)
        sys.exit(1)
