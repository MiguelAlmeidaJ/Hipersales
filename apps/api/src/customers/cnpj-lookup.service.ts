import { BadGatewayException, BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { EnvService } from "../config/env.service.js";
import { DatabaseRepository } from "../database/database.repository.js";
import { customerText } from "./customer-fields.js";
import { isValidCnpj } from "./cnpj-validation.js";

type Data = Record<string, unknown>;

function object(value: unknown): Data {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
}
function nested(value: unknown, key: string): Data { return object(object(value)[key]); }
function text(...values: unknown[]): string { return customerText(...values); }
function unwrap(value: unknown): Data {
  if (Array.isArray(value)) return object(value[0]);
  const data = object(value);
  for (const key of ["response", "data", "result", "results", "payload", "content"]) {
    if (data[key]) {
      const item = unwrap(data[key]);
      if (Object.keys(item).length) return item;
    }
  }
  return data;
}

function normalizeCnpjWs(payload: Data): Data {
  const branch = nested(payload, "estabelecimento");
  const city = nested(branch, "cidade");
  const state = nested(branch, "estado");
  const registrations = Array.isArray(branch.inscricoes_estaduais) ? branch.inscricoes_estaduais : [];
  const registration = registrations.map(object).find(item => Boolean(item.ativo) && item.inscricao_estadual)
    ?? registrations.map(object).find(item => item.inscricao_estadual) ?? {};
  const phone = (ddd: unknown, number: unknown) => ddd && number
    ? `(${text(ddd)}) ${text(number)}` : text(number, ddd);
  return {
    razao_social: text(payload.razao_social),
    nome_fantasia: text(branch.nome_fantasia),
    inscricao_estadual: text(registration.inscricao_estadual),
    logradouro: [text(branch.tipo_logradouro), text(branch.logradouro)].filter(Boolean).join(" "),
    numero: text(branch.numero),
    complemento: text(branch.complemento),
    bairro: text(branch.bairro),
    municipio: text(city.nome),
    uf: text(state.sigla),
    cep: text(branch.cep),
    ddd_telefone_1: phone(branch.ddd1, branch.telefone1),
    ddd_telefone_2: phone(branch.ddd2, branch.telefone2),
    email: text(branch.email),
    situacao_cadastral: text(branch.situacao_cadastral),
    atividade_principal: text(nested(branch, "atividade_principal").descricao),
    porte: text(nested(payload, "porte").descricao),
    natureza_juridica: text(nested(payload, "natureza_juridica").descricao),
    simples: text(nested(payload, "simples").simples),
    mei: text(nested(payload, "simples").mei),
    data_inicio_atividade: text(branch.data_inicio_atividade),
    _raw: payload,
  };
}

export function normalizeSintegra(payload: Data): Data {
  const registrations = Array.isArray(payload.inscricoes_estaduais)
    ? payload.inscricoes_estaduais.map(object)
    : [];
  const preferredState = text(payload.uf).toUpperCase();
  const registration = registrations.find(item => Boolean(item.ativa) && text(item.uf).toUpperCase() === preferredState)
    ?? registrations.find(item => Boolean(item.ativa))
    ?? registrations[0]
    ?? {};
  const registrationAddress = nested(registration, "endereco");
  const address = Object.keys(registrationAddress).length ? registrationAddress : nested(payload, "endereco");
  return {
    razao_social: text(payload.razao_social),
    inscricao_estadual: text(registration.inscricao_estadual),
    logradouro: [text(address.tipo), text(address.logradouro)].filter(Boolean).join(" "),
    numero: text(address.numero),
    complemento: text(address.complemento),
    bairro: text(address.bairro),
    municipio: text(address.municipio),
    uf: text(address.uf, registration.uf, payload.uf),
    cep: text(address.cep),
    situacao_cadastral: text(registration.situacao_pj),
    _raw: payload,
  };
}

function formatted(digits: string) {
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function normalizeLookup(digits: string, source: Data) {
  const payload = source;
  const street = text(payload.logradouro, payload.rua, payload.endereco);
  const number = text(payload.numero, payload.numero_endereco);
  const complement = text(payload.complemento, payload.complemento_endereco);
  const neighborhood = text(payload.bairro, payload.bairro_distrito);
  const city = text(payload.municipio, payload.municipio_nome, payload.cidade);
  const state = text(payload.uf, payload.estado);
  const zip = text(payload.cep, payload.codigo_postal);
  const addressLine = [street, number, complement].filter(Boolean).join(" ");
  const fullAddress = [[street, number, complement, neighborhood].filter(Boolean).join(" "), [city, state].filter(Boolean).join("/"), zip].filter(Boolean).join(", ");
  return {
    cnpj: formatted(digits),
    legal_name: text(payload.razao_social, payload.nome, payload.nome_empresarial, payload.nome_razao_social),
    trade_name: text(payload.fantasia, payload.nome_fantasia, payload.nome_comercial),
    state_registration: text(payload.inscricao_estadual, payload.ie),
    address: fullAddress, address_line: addressLine, neighborhood,
    phone: text(payload.ddd_telefone_1, payload.ddd_telefone_2, payload.telefone, payload.telefone1),
    email: text(payload.email, payload.endereco_eletronico),
    city, state, zip_code: zip,
    status: text(payload.situacao_cadastral, payload.descricao_situacao_cadastral),
    main_activity: text(payload.atividade_principal, payload.cnae_fiscal_descricao),
    company_size: text(payload.porte, payload.porte_descricao),
    legal_nature: text(payload.natureza_juridica, payload.natureza_juridica_descricao),
    simples: text(payload.simples), mei: text(payload.mei),
    started_at: text(payload.data_inicio_atividade, payload.inicio_atividade),
    raw: object(payload._raw).razao_social ? payload._raw : payload,
  };
}

@Injectable()
export class CnpjLookupService {
  constructor(
    private readonly database: DatabaseRepository,
    private readonly env: EnvService,
  ) {}

  async lookup(tenantId: number, value: string, excludeId?: number) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!isValidCnpj(digits)) throw new BadRequestException("CNPJ inválido. Verifique os dígitos informados.");
    const customers = await this.database.db.prepare("SELECT id, cnpj FROM customers WHERE tenant_id=?").all(tenantId) as {id:number;cnpj:string}[];
    if (customers.some(item => item.id !== excludeId && item.cnpj.replace(/\D/g,"") === digits)) {
      throw new ConflictException("Ja existe esse CNPJ na nossa base.");
    }
    const pending = await this.database.db.prepare("SELECT cnpj FROM registration_requests WHERE tenant_id=? AND status=?").all(tenantId, "pendente") as {cnpj:string}[];
    if (pending.some(row => row.cnpj.replace(/\\D/g, "") === digits)) throw new ConflictException("Este CNPJ já possui uma solicitação pendente de análise.");
    const providers = [
      { url: `https://brasilapi.com.br/api/cnpj/v1/${digits}`, normalize: unwrap },
      { url: `https://minhareceita.org/${digits}`, normalize: unwrap },
      { url: `https://publica.cnpj.ws/cnpj/${digits}`, normalize: (payload: Data) => normalizeCnpjWs(unwrap(payload)) },
      { url: `https://www.receitaws.com.br/v1/cnpj/${digits}`, normalize: unwrap },
      ...(this.env.sintegraApiKey ? [{
        url: `https://api.sintegrapi.com.br/consultas/v2/sintegra/${digits}?cache_strategy=ONLINE_PREFERENCIAL&error_fallback=true&endereco=true`,
        headers: { "x-api-key": this.env.sintegraApiKey },
        normalize: (payload: Data) => normalizeSintegra(unwrap(payload)),
      }] : []),
    ];
    for (const provider of providers) {
      try {
        const response = await fetch(provider.url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "HiperSalesWeb/1.0",
            "Accept-Language": "pt-BR",
            ...provider.headers,
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) continue;
        const result = provider.normalize(object(await response.json()));
        if (Object.keys(result).length && text(result.razao_social, result.nome, result.nome_empresarial)) {
          return normalizeLookup(digits, result);
        }
      } catch {
        // The second provider remains available when the first one times out or responds badly.
      }
    }
    throw new BadGatewayException("Nao foi possivel consultar o CNPJ nos provedores disponiveis.");
  }
}
