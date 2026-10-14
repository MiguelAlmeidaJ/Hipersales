export type ProposalItem = {
  id: number;
  product_id: number;
  name: string;
  code: string;
  unit?: string;
  quantity: number;
  negotiated_price: number;
};

export type ProposalTimeline = {
  id?: number;
  title: string;
  notes?: string | null;
  status: string;
  created_at: string;
  created_by_name?: string | null;
};

export type Proposal = {
  id: number;
  order_number?: number | null;
  status: string;
  company_name: string;
  customer_name: string;
  customer_trade_name?: string | null;
  seller_name: string;
  order_type: string;
  created_at: string;
  updated_at?: string;
  payment_terms?: string | null;
  freight_type?: string | null;
  delivery_type?: string | null;
  delivery_forecast?: string | null;
  industry_order_number?: string | null;
  invoice_number?: string | null;
  purchase_order?: string | null;
  notes?: string | null;
  items?: ProposalItem[];
  timeline?: ProposalTimeline[];
};

export type Customer = {
  id: number;
  legal_name: string;
  trade_name?: string | null;
  cnpj: string;
  state_registration?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean | number;
};
