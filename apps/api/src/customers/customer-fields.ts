type Data = Record<string, unknown>;

export function customerText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

export function customerField(payload: Data, ...keys: string[]): string {
  const row = payload.row && typeof payload.row === "object" && !Array.isArray(payload.row)
    ? payload.row as Data : {};
  for (const key of keys) {
    const value = customerText(payload[key], row[key]);
    if (value) return value;
  }
  return "";
}

export function customerAddress(payload: Data): string {
  const direct = customerField(payload, "address", "delivery_address");
  const street = customerField(payload, "street", "logradouro");
  const number = customerField(payload, "number", "numero");
  const complement = customerField(payload, "complement", "complemento");
  const neighborhood = customerField(payload, "neighborhood", "bairro_distrito", "bairro");
  const city = customerField(payload, "city", "cidade");
  const state = customerField(payload, "state", "uf");
  const zip = customerField(payload, "zip_code", "cep");

  if (direct && ![street, number, complement, neighborhood, city, state, zip].some(Boolean)) {
    return direct;
  }
  const firstLine = [direct || street, number, complement].filter(Boolean).join(" ");
  const withDistrict = firstLine + (neighborhood ? ` - ${neighborhood}` : "");
  return [withDistrict, [city, state].filter(Boolean).join("/"), zip ? `CEP ${zip}` : ""]
    .filter(Boolean).join(", ");
}

export function customerContact(payload: Data, lookup: Data = {}) {
  const phone = customerText(
    payload.phone, payload.phone_1, payload.buyer_phone_1, lookup.phone,
  );
  const email = customerText(
    payload.email, payload.purchase_email, payload.buyer_email, lookup.email,
  );
  return {
    state_registration: customerText(payload.state_registration, lookup.state_registration),
    address: customerText(customerAddress(payload), lookup.address),
    phone,
    email,
  };
}
