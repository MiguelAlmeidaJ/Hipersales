import { describe, expect, it } from "vitest";
import { customerAddress, customerContact, customerField } from "../src/customers/customer-fields.js";

describe("legacy customer field parity", () => {
  it("builds address from separated legacy fields", () => {
    expect(customerAddress({
      street: "Rua A", number: "123", complement: "Sala 2", neighborhood: "Centro",
      city: "Leopoldina", state: "MG", zip_code: "36700000",
    })).toBe("Rua A 123 Sala 2 - Centro, Leopoldina/MG, CEP 36700000");
  });

  it("reads legacy row fallback and preserves direct address", () => {
    expect(customerField({ row: { buyer_email: "compras@teste.com" } }, "buyer_email"))
      .toBe("compras@teste.com");
    expect(customerAddress({ address: "Rua pronta, 100" })).toBe("Rua pronta, 100");
  });

  it("prefers explicit form contact details over lookup suggestions", () => {
    expect(customerContact(
      { phone: "31999999999", email: "pessoa@teste.com", street: "Rua B", city: "Além Paraíba", state: "MG" },
      { phone: "000", email: "lookup@teste.com", address: "Outro endereço" },
    )).toMatchObject({
      phone: "31999999999", email: "pessoa@teste.com", address: "Rua B, Além Paraíba/MG",
    });
  });
});
