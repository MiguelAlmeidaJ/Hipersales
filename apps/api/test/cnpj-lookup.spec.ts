import { describe, expect, it } from "vitest";
import { normalizeLookup, normalizeSintegra } from "../src/customers/cnpj-lookup.service.js";
import { isValidCnpj } from "../src/customers/cnpj-validation.js";

describe("CNPJ lookup", () => {
  it("accepts the reported valid CNPJ", () => {
    expect(isValidCnpj("10.345.806/0001-75")).toBe(true);
  });

  it("normalizes an active Sintegra registration and its address", () => {
    const normalized = normalizeSintegra({
      cnpj: "10345806000175",
      razao_social: "NIVEL 3 TECNOLOGIA E INOVACAO LTDA",
      uf: "SP",
      inscricoes_estaduais: [{
        inscricao_estadual: "123456789",
        uf: "SP",
        ativa: true,
        situacao_pj: "Sem restrição",
        endereco: {
          logradouro: "RUA EXEMPLO",
          numero: "10",
          bairro: "CENTRO",
          municipio: "SAO PAULO",
          uf: "SP",
          cep: "01001000",
        },
      }],
    });

    expect(normalizeLookup("10345806000175", normalized)).toMatchObject({
      cnpj: "10.345.806/0001-75",
      legal_name: "NIVEL 3 TECNOLOGIA E INOVACAO LTDA",
      state_registration: "123456789",
      address_line: "RUA EXEMPLO 10",
      neighborhood: "CENTRO",
      city: "SAO PAULO",
      state: "SP",
      zip_code: "01001000",
      status: "Sem restrição",
    });
  });
});
