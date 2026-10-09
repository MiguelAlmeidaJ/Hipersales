import { describe, expect, it } from "vitest";
import { proposalEmailBody, proposalEmailSubject } from "../src/proposals/proposal-notification.service.js";

describe("legacy new-proposal notification contract", () => {
  const proposal = { seller_name: "Maria", customer_name: "Cliente Exemplo", cnpj: "12.345.678/0001-90" };

  it("reproduces the original subject", () => {
    expect(proposalEmailSubject(proposal)).toBe("NOVA PROPOSTA Cliente Exemplo + 12.345.678/0001-90");
  });

  it("reproduces original text and line breaks", () => {
    expect(proposalEmailBody(proposal)).toBe([
      "Ola, Thalles.",
      "Voce esta recebendo uma nova proposta enviada por Maria para analise do cliente Cliente Exemplo - CNPJ 12.345.678/0001-90.",
      "Por favor, verificar na plataforma do administrador para dar andamento a analise.",
      "Atenciosamente,",
      "Comunicacao HiperSales Web",
    ].join("\n"));
  });
});
