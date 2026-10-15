import { describe, expect, it } from "vitest";
import { customerMirrorData, orderMirrorNumber } from "../src/documents/documents.service.js";

describe("order mirror", () => {
  it("adds the sale or bonus suffix to the order number", () => {
    expect(orderMirrorNumber(11073, 1, "Venda de Mercadoria")).toBe("11073 / V");
    expect(orderMirrorNumber(11074, 2, "Bonificação")).toBe("11074 / B");
  });

  it("uses only customer registration data for billing and delivery", () => {
    const customer = customerMirrorData({
      customer_name: "RAMIGOS SUPERMERCADOS S.A.",
      customer_trade_name: "SUPERMARKET",
      customer_cnpj: "11.552.261/0001-30",
      customer_state_registration: "78.992.83-2",
      customer_phone: "(21) 2455-9650",
      customer_email: "ramigos@redesupermarket.com.br",
      customer_form_payload: JSON.stringify({
        address: "RUA ZANINI",
        address_number: "150",
        neighborhood: "ANCHIETA",
        city: "RIO DE JANEIRO",
        state: "RJ",
        zip_code: "21.630-330",
        delivery_address: "DOCA 2 - RUA ZANINI, Nº 150",
        delivery_warnings: "AGENDAR COM ANTECEDÊNCIA",
      }),
    });

    expect(customer).toMatchObject({
      legalName: "RAMIGOS SUPERMERCADOS S.A.",
      street: "RUA ZANINI",
      number: "150",
      neighborhood: "ANCHIETA",
      city: "RIO DE JANEIRO",
      state: "RJ",
      zipCode: "21.630-330",
      deliveryAddress: "DOCA 2 - RUA ZANINI, Nº 150",
      deliveryWarnings: "AGENDAR COM ANTECEDÊNCIA",
    });
  });
});
