import { describe, expect, it } from "vitest";
import { rejectedProposalBody, statusEmailBody, statusEmailSubject, statusWhatsappBody } from "../src/proposals/proposal-status-notifications.service.js";

const context = {vendedor:"Maria",cliente:"Cliente A",cnpj:"123",pedido_id:"10840",
 status:"faturado",status_label:"Faturado",delivery_forecast:"",observacoes:""};

describe("status notification parity", () => {
 it("renders the sender status subject",()=> {
   expect(statusEmailSubject("pedido_aprovado")).toBe("APROVADO");
   expect(statusEmailSubject("em_producao")).toBe("EM PRODUÇÃO");
   expect(statusEmailSubject("faturado")).toBe("FATURADO");
 });
 it("renders seller email and WhatsApp updates",()=> {
   expect(statusEmailBody(context)).toContain("O pedido nº #10840");
   expect(statusEmailBody(context)).toContain("Seu pedido encontra-se FATURADO");
   expect(statusWhatsappBody(context)).toContain("Seu pedido encontra-se FATURADO");
 });
 it("renders the original rejected proposal notice",()=> {
   expect(rejectedProposalBody("Maria","Cliente A","123")).toContain("Devido a inconsistencias ela nao foi aprovada.");
 });
});
