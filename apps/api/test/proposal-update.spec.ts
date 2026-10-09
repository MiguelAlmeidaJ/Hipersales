import { BadRequestException } from "@nestjs/common";
import { describe,expect,it } from "vitest";
import { normalizeProposalStatus } from "../src/proposals/proposal-update.service.js";

describe("proposal status normalization",()=>{
  it("supports historical aliases",()=>{
    expect(normalizeProposalStatus("proposta_enviada","em_analise")).toBe("em_analise");
    expect(normalizeProposalStatus("proposta_recusada","em_analise")).toBe("recusado");
  });
  it("blocks status regressions and unsupported statuses",()=>{
    expect(()=>normalizeProposalStatus("em_producao","faturado")).toThrow(BadRequestException);
    expect(()=>normalizeProposalStatus("qualquer","em_analise")).toThrow(BadRequestException);
  });
});
