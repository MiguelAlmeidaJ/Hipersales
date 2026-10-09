import { BadGatewayException, Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { CnpjLookupService } from "./cnpj-lookup.service.js";
import { customerText } from "./customer-fields.js";
import { CustomersWriteService, type CustomerInput } from "./customers-write.service.js";

type Lookup = Awaited<ReturnType<CnpjLookupService["lookup"]>>;

/**
 * Keeps I/O outside SQLite write transactions.
 * Optional external enrichment must never overwrite explicit user input.
 */
@Injectable()
export class CustomerRegistrationService {
  constructor(
    private readonly lookup: CnpjLookupService,
    private readonly writer: CustomersWriteService,
  ) {}

  private async enrich(user: PublicUser, input: CustomerInput, excludeId?: number): Promise<CustomerInput> {
    let result: Lookup | null = null;
    try {
      result = await this.lookup.lookup(user.tenant_id, input.cnpj, excludeId);
    } catch (error) {
      // Duplicate/invalid CNPJ remains a hard failure; only provider outages are optional.
      if (!(error instanceof BadGatewayException)) throw error;
    }

    if (!result) return input;
    return {
      ...input,
      state_registration: customerText(input.state_registration, result.state_registration),
      address: customerText(input.address, result.address),
      phone: customerText(input.phone, input.phone_1, input.buyer_phone_1, result.phone),
      email: customerText(input.email, input.purchase_email, input.buyer_email, result.email),
      // Mirror the legacy payload metadata without losing the original form.
      _lookup: result,
    };
  }

  async create(user: PublicUser, input: CustomerInput) {
    const enriched = await this.enrich(user, input);
    return this.writer.create(user, enriched);
  }

  async update(user: PublicUser, id: number, input: CustomerInput) {
    const enriched = await this.enrich(user, input, id);
    return this.writer.update(user, id, enriched);
  }
}
