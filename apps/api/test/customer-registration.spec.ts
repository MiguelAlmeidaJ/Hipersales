import { BadGatewayException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CustomerRegistrationService } from "../src/customers/customer-registration.service.js";
import type { CustomersWriteService } from "../src/customers/customers-write.service.js";
import type { CnpjLookupService } from "../src/customers/cnpj-lookup.service.js";
import type { PublicUser } from "@hipersales/contracts";

const user = { id: 1, tenant_id: 1, role: "admin" } as PublicUser;
const input = { legal_name: "Empresa", cnpj: "12345678000190", phone: "31999999999" };

function setup(response: unknown) {
  const lookup = { lookup: vi.fn() };
  const writer = { create: vi.fn().mockReturnValue({ id: 3 }), update: vi.fn() };
  if (response instanceof Error) lookup.lookup.mockRejectedValue(response);
  else lookup.lookup.mockResolvedValue(response);
  const service = new CustomerRegistrationService(
    lookup as unknown as CnpjLookupService,
    writer as unknown as CustomersWriteService,
  );
  return { service, lookup, writer };
}

describe("customer registration", () => {
  it("preserves user phone and enriches missing fields", async () => {
    const { service, writer } = setup({ phone: "000", address: "Rua A", email: "cnpj@example.com" });
    await service.create(user, input);
    expect(writer.create.mock.calls[0][1]).toMatchObject({
      phone: "31999999999", address: "Rua A", email: "cnpj@example.com",
    });
  });

  it("continues on a provider outage", async () => {
    const { service, writer } = setup(new BadGatewayException("offline"));
    await service.create(user, input);
    expect(writer.create).toHaveBeenCalledWith(user, input);
  });

  it("does not hide duplicate CNPJ conflicts", async () => {
    const { service, writer } = setup(new ConflictException("duplicate"));
    await expect(service.create(user, input)).rejects.toThrow();
    expect(writer.create).not.toHaveBeenCalled();
  });
});
