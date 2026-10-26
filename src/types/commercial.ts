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
  company_id?: number;
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
  admin_notes?: string | null;
  billing_date?: string | null;
  delivered_date?: string | null;
  has_invoice_pdf?: number | boolean;
  discount_percent?: number;
  commission_percent?: number;
  discount_on?: string | null;
  invoice_type?: string | null;
  scheduled_delivery_date?: string | null;
  tax_operator_invoice?: boolean | number;
  lead_time_days?: number;
  customer_cnpj?: string | null;
  purchase_order?: string | null;
  notes?: string | null;
  gross_value?: number;
  net_value?: number;
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
