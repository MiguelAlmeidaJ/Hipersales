import { describe, expect, it } from "vitest";
import { appendApprovalNotice, renderNotificationTemplate } from "../src/customers/approval-notifications.service.js";

describe("approval message templates", () => {
  it("interpolates configured placeholders and removes unknown placeholders", () => {
    expect(renderNotificationTemplate("Cliente {{ cliente }}: {{status}} {{missing}}", {
      cliente:"Empresa A",status:"aprovada",
    })).toBe("Cliente Empresa A: aprovada ");
  });

  it("inserts approval notice once into an HTML document", () => {
    const html = "<html><body><p>Olá</p></body></html>";
    const result = appendApprovalNotice(html,"Cliente liberado");
    expect(result).toContain("Cliente liberado");
    expect(result.indexOf("Cliente liberado")).toBe(result.lastIndexOf("Cliente liberado"));
    expect(result).toContain("</body>");
    expect(appendApprovalNotice(result,"Cliente liberado")).toBe(result);
  });
});
