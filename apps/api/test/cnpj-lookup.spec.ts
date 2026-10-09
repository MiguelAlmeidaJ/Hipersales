import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import { CnpjLookupService, normalizeLookup } from "../src/customers/cnpj-lookup.service.js";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE customers (id INTEGER PRIMARY KEY, tenant_id INTEGER, cnpj TEXT)");
  db.exec("INSERT INTO customers VALUES (1,1,'12.345.678/0001-90')");
  return { db, service: new CnpjLookupService({db} as DatabaseService) };
}

afterEach(() => vi.unstubAllGlobals());

describe("CNPJ lookup", () => {
  it("rejects invalid length and duplicate company CNPJ before network calls", async () => {
    const {db,service}=fixture();
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    await expect(service.lookup(1,"123")).rejects.toThrow();
    await expect(service.lookup(1,"12345678000190")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    db.close();
  });

  it("normalizes standard response fields", () => {
    const result=normalizeLookup("12345678000190",{
      razao_social:"Empresa Teste",municipio:"Leopoldina",uf:"MG",
      logradouro:"Rua A",numero:"10",cep:"36700000",
    });
    expect(result).toMatchObject({
      cnpj:"12.345.678/0001-90",legal_name:"Empresa Teste",
      address:"Rua A 10, Leopoldina/MG, 36700000",
    });
  });

  it("falls back to BrasilAPI when CNPJ.ws is unavailable", async () => {
    const {db,service}=fixture();
    const fake=vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok:true,json:async()=>({razao_social:"Empresa BrasilAPI",municipio:"Cataguases",uf:"MG"}),
      });
    vi.stubGlobal("fetch",fake);
    const result=await service.lookup(1,"98765432000111");
    expect(result.legal_name).toBe("Empresa BrasilAPI");
    expect(fake).toHaveBeenCalledTimes(2);
    db.close();
  });

  it("rejects both providers failing without returning an empty company", async () => {
    const {db,service}=fixture();
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));
    await expect(service.lookup(1,"98765432000111")).rejects.toThrow();
    db.close();
  });
});
