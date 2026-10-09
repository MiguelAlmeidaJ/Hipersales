import { describe, expect, it } from "vitest";
import { approvedOrderBody } from "../src/proposals/approved-order-email.js";

describe("approved order email", () => {
  it("includes the commercial details and each item", () => {
    const result = approvedOrderBody({
      created_at:"2026-10-09T15:00:00-03:00",
      seller_name:"Maria",company_name:"Industria A",customer_name:"Cliente A",
      cnpj:"123",address:"Rua A",tax_operator_invoice:1,
      order_type:"Pedido",freight_type:"CIF",delivery_type:"Normal",
      purchase_order:"OC-10",payment_terms:"30 dias",discount_percent:5,
      discount_on:"Desconto no boleto",commission_percent:3,
    }, [
      {code:"A01",name:"Produto A",unit:"UN",quantity:2,negotiated_price:25.5},
      {code:"B01",name:"Produto B",unit:"CX",quantity:3,negotiated_price:12},
    ]);
    expect(result).toContain("Item 01: A01");
    expect(result).toContain("Item 02: B01");
    expect(result).toContain("Forma de Pagamento: 30 dias");
    expect(result).toContain("Desconto em: Boleto Bancario");
    expect(result).toContain("Nota Fiscal via Operador Fiscal: SIM");
  });
});
