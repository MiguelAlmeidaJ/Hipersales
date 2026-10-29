import data from "@/mocks/api-data.json";

type ApiOptions = RequestInit & { timeoutMs?: number };
type MockOrder = Record<string, any>;

const orders: MockOrder[] = data.orders.map((order) => structuredClone(order));
const notifications: MockOrder[] = data.notifications.map((item) => structuredClone(item));
const occurrences: MockOrder[] = data.occurrences.map((item) => structuredClone(item));
const goalRecords: MockOrder[] = data.goals.map((item) => structuredClone(item));
const demoCustomerNames = ["Armazém Central", "Supermercado Horizonte", "Mercado Boa Praça", "Empório Imperial", "Rede Econômica", "Comercial Avenida", "Mercado São Lucas", "Supermercado União", "Distribuidora Ideal", "Mercado Primavera", "Empório da Serra", "Comercial Bom Preço", "Mercado Nacional", "Supermercado Estrela", "Atacado Mineiro", "Mercado Santa Clara", "Comercial Vitória", "Empório das Gerais", "Mercado Central Park", "Supermercado Imperial", "Comercial Nova Era"];
const demoPortfolioCustomers = demoCustomerNames.map((name,index)=>({id:600+index,legal_name:`${name} Ltda`,trade_name:name,cnpj:`9000000000${String(index+1).padStart(4,"0")}`,phone:`3299000${String(1000+index)}`,email:`compras${index+1}@carteira.demo`,address:`Rua Comercial, ${100+index} — Juiz de Fora/MG`,active:true,statusCadastro:"APROVADO"}));
const mockCustomers = [...data.customers, ...demoPortfolioCustomers];
const idempotentOrders = new Map<string, MockOrder>();
let currentMockUser={id:data.login.representante.id,name:data.login.representante.nome,admin:false};
const wait = () => new Promise((resolve) => setTimeout(resolve, 5000));
const bodyOf = (options: ApiOptions) => options.body ? JSON.parse(String(options.body)) as Record<string, any> : {};
const queryOf = (path: string) => new URLSearchParams(path.split("?")[1] || "");
const pathnameOf = (path: string) => path.split("?")[0];
const normalized = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const brDateValue = (value: unknown) => { const [day, month, year] = String(value || "").split("/").map(Number); return year && month && day ? new Date(year, month - 1, day).getTime() : 0; };
function ordersInPeriod(path:string){const query=queryOf(path),start=brDateValue(query.get("de")),end=brDateValue(query.get("ate"));return orders.filter(order=>{const value=brDateValue(order.dataPedido);return (!start||value>=start)&&(!end||value<=end);});}

function progress(goal:unknown,realized:unknown){const target=goal==null?null:Number(goal),done=Number(realized||0);return {enabled:target!=null,goal:target,realized:done,missing:target==null?0:Math.max(0,target-done),percent:target&&target>0?(done/target)*100:0};}
function performance(record:MockOrder|undefined){return {sales:progress(record?.sales_goal,record?.sales_realized),new_customers:progress(record?.new_customers_goal,record?.new_customers_realized),customer_positivation:progress(record?.positivation_goal,record?.positivation_realized),portfolio:{customers:Number(record?.portfolio_customers||0),attended:Number(record?.portfolio_attended||0)}};}

function toProposal(order: MockOrder) {
  return {
    id: Number(order.idPedido), order_number: Number(order.idPedido), status: String(order.status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_"),
    company_id: Number(order.idEmpresa), company_name: String(order.empresaNome), customer_name: String(order.clienteRazaoSocial), customer_trade_name: order.clienteNomeFantasia,
    customer_cnpj: order.clienteDocumento, seller_name: data.login.representante.nome, order_type: String(order.tipoPedido), created_at: String(order.dataPedido), payment_terms: order.condPagtoDescricao,
    freight_type: order.frete, delivery_type: order.formatoEntrega, scheduled_delivery_date: order.dataProgramada, delivery_forecast: order.entregaPrevista, lead_time_days: order.leadTimeDias,
    purchase_order: order.nroPedidoCliente, notes: order.observacoes, discount_percent: order.descontoPercentual, discount_on: order.descontoEm,
    tax_operator_invoice: order.operadorFiscal, invoice_type: order.faturamentoPercentual === 0 ? "Sem Nota" : `${order.faturamentoPercentual}% Nota`,
    gross_value: order.valorBruto, net_value: order.valorLiquido,
    items: (order.itens || []).map((item: MockOrder) => ({ id: item.idItem, product_id: item.idProduto, name: item.descricao, code: data.products.find(product=>product.idTabela===order.idTabela&&product.idProduto===item.idProduto)?.codigo||String(item.idProduto), unit: item.unidade, quantity: item.quantidade, negotiated_price: item.precoUnitario })),
  };
}

function createOrder(payload: MockOrder): MockOrder {
  const customer = data.customers.find((item) => item.id === Number(payload.idCliente)) || data.customers[0];
  const table = data.priceTables.find((item) => item.idTabela === Number(payload.idTabela)) || data.priceTables[0];
  const items = (payload.itens || []).map((line: MockOrder, index: number) => {
    const product = data.products.find((item) => item.idTabela === table.idTabela && item.idProduto === Number(line.idProduto)) || data.products[0];
    const quantity = Number(line.quantidade);
    return { idItem: Date.now() + index, idProduto: product.idProduto, descricao: product.descricao, unidade: product.unidade, quantidade: quantity, precoUnitario: product.precoUnitario, precoComIpi: product.precoUnitario * 1.06, total: product.precoUnitario * quantity };
  });
  const total = items.reduce((sum: number, item: MockOrder) => sum + item.total, 0);
  const discount = Math.min(100, Math.max(0, Number(payload.descontoPercentual || 0)));
  return {
    idPedido: Math.max(...orders.map((order) => Number(order.idPedido)), 1000) + 1, dataPedido: new Date().toLocaleDateString("pt-BR"), status: "EM ANÁLISE", tipoPedido: payload.tipoPedido || "Venda", faturamentoPercentual: payload.faturamentoPercentual ?? 100,
    idEmpresa: table.idEmpresa, empresaNome: table.empresaNome, idCliente: customer.id, clienteRazaoSocial: customer.legal_name, clienteNomeFantasia: customer.trade_name, clienteDocumento: customer.cnpj,
    idTabela: table.idTabela, tabelaDescricao: table.descricao, frete: payload.frete || table.frete,
    idCondPagto: payload.tipoPedido === "Bonificacao" ? null : (payload.idCondPagto || table.idCondPagto),
    condPagtoDescricao: payload.tipoPedido === "Bonificacao" ? null : (table.condicoesPagamento.find((term) => term.idCondPagto === Number(payload.idCondPagto))?.descricao || table.condPagtoDescricao),
    formatoEntrega: payload.formatoEntrega || "Imediata", dataProgramada: payload.dataProgramada || null, leadTimeDias: table.prazoEntregaDias,
    entregaPrevista: payload.dataProgramada || new Date(Date.now() + table.prazoEntregaDias * 86400000).toLocaleDateString("pt-BR"), observacoes: payload.observacoes || "", nroPedidoCliente: payload.numeroPedidoCliente || null,
    operadorFiscal: Boolean(payload.operadorFiscal), descontoEm: payload.descontoEm || "SemDescontos",
    origem: "API", valorBruto: total, descontoPercentual: discount, valorLiquido: total * (1 - discount / 100), itens: items,
  };
}

export async function mockLogin(usuario: string, senha: string) {
  await wait();
  if(usuario==="admin"&&senha==="admin123"){currentMockUser={id:1,name:"Administrador Demo",admin:true};return {accessToken:"mock-admin-token",usuario:"admin",admin:true};}
  if (usuario !== data.login.usuario || senha !== data.login.senha) throw new Error("Use demo / demo123 ou admin / admin123 no ambiente de demonstração.");
  currentMockUser={id:data.login.representante.id,name:data.login.representante.nome,admin:false};
  return { accessToken: "mock-access-token", usuario: data.login.usuario, admin: false, representante: data.login.representante };
}

export async function mockApi<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  await wait();
  const pathname = pathnameOf(path);
  if (pathname === "/api/saude") return { status: "ok", ambiente: "mock" } as T;
  if (pathname === "/api/customers" || pathname === "/api/admin/customers") return { customers: structuredClone(mockCustomers) } as T;
  if (pathname === "/api/customer-ids") {
    const query=queryOf(path),date=String(query.get("de")||"").split("/").map(Number),record=goalRecords.find(item=>item.year===date[2]&&item.month===date[1]&&item.seller_id===currentMockUser.id);
    const ids=new Set(ordersInPeriod(path).map(order=>Number(order.idCliente)).filter(Boolean)),target=Number(record?.portfolio_attended||ids.size);
    for(const customer of mockCustomers){if(ids.size>=target)break;if(customer.active)ids.add(customer.id);}
    return { ids: Array.from(ids) } as T;
  }
  if (pathname === "/api/admin/users") return {users:structuredClone(data.users)} as T;
  if (pathname === "/api/price-tables") return { itens: structuredClone(data.priceTables) } as T;
  if (pathname === "/api/payment-terms") return Array.from(new Map(data.priceTables.flatMap((table) => table.condicoesPagamento).map((term) => [term.idCondPagto, { id: term.idCondPagto, descricao: term.descricao }])).values()) as T;
  if (pathname === "/api/order-products") {
    const query = queryOf(path), companyId = Number(query.get("idEmpresa")), tableId = Number(query.get("idTabela"));
    const search=normalized(query.get("busca")),page=Math.max(1,Number(query.get("pagina")||1)),size=Math.min(200,Math.max(1,Number(query.get("tamanho")||50)));
    const found=data.products.filter(item=>(!companyId||item.idEmpresa===companyId)&&(!tableId||item.idTabela===tableId)&&(!search||normalized(`${item.codigo} ${item.descricao}`).includes(search)));
    return {total:found.length,pagina:page,tamanho:size,itens:structuredClone(found.slice((page-1)*size,page*size))} as T;
  }
  if (pathname === "/api/proposals") return { proposals: orders.map(toProposal) } as T;
  const proposalMatch = pathname.match(/^\/api\/proposals\/(\d+)$/);
  if (proposalMatch) return toProposal(orders.find((order) => Number(order.idPedido) === Number(proposalMatch[1])) || orders[0]) as T;
  if (pathname === "/api/orders" && (options.method || "GET").toUpperCase() === "POST") {
    const key = new Headers(options.headers).get("Idempotency-Key") || "", repeated = key ? idempotentOrders.get(key) : undefined;
    if (repeated) return { mensagem: "Pedido já registrado anteriormente.", repetido: true, pedido: structuredClone(repeated) } as T;
    const order = createOrder(bodyOf(options)); orders.unshift(order); if (key) idempotentOrders.set(key, order);
    return { mensagem: "Pedido registrado com status EM ANÁLISE.", repetido: false, pedido: structuredClone(order) } as T;
  }
  const orderMatch = pathname.match(/^\/api\/orders\/(\d+)(\/status)?$/);
  if (orderMatch) { const order = orders.find((item) => Number(item.idPedido) === Number(orderMatch[1])) || orders[0]; return (orderMatch[2] ? { idPedido: order.idPedido, status: order.status, dataPedido: order.dataPedido, entregaPrevista: order.entregaPrevista } : structuredClone(order)) as T; }
  if (pathname === "/api/customer-requests") {
    const payload=bodyOf(options),cnpj=normalized(payload.cnpj).replace(/[^a-z0-9]/g,"");
    const existing=data.customers.find(customer=>normalized(customer.cnpj).replace(/[^a-z0-9]/g,"")===cnpj);
    if(existing)Object.assign(existing,{legal_name:payload.legal_name||existing.legal_name,trade_name:payload.trade_name||existing.trade_name,phone:payload.phone_1||existing.phone,email:payload.purchase_email||existing.email,address:payload.address||existing.address,active:false,statusCadastro:"AGUARDANDO APROVACAO",rejection_reason:null});
    return { id: existing?.id||Date.now(), message: existing?"Cadastro ajustado e reenviado para aprovação.":"Solicitação mock enviada para aprovação." } as T;
  }
  if (pathname === "/api/integrations/cnpj") return { legal_name: "Empresa Consultada no Mock Ltda", trade_name: "Empresa Mock", state_registration: "123.456.789.110", phone: "11988887777", email: "compras@empresamock.test", street: "Rua do Ambiente Web", number: "8081", neighborhood: "Centro", city: "São Paulo", state: "SP", zip_code: "01001000" } as T;
  if (pathname === "/api/notifications/unread-count") return { unread_count: notifications.filter(item=>!item.read_at).length } as T;
  if (pathname === "/api/notifications") return { notifications: structuredClone(notifications) } as T;
  if (pathname === "/api/notifications/read-all") {notifications.forEach(item=>{item.read_at ||= new Date().toISOString();});return { unread_count: 0 } as T;}
  const notificationMatch=pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if(notificationMatch){const item=notifications.find(row=>row.id===Number(notificationMatch[1]));if(item)item.read_at ||= new Date().toISOString();return {unread_count:notifications.filter(row=>!row.read_at).length} as T;}
  if (pathname === "/api/mobile/push-token") return {} as T;
  if(pathname==="/api/occurrences/reasons")return {itens:[
    "Produto avariado","Divergência de produto","Divergência de quantidade","Falta de produto no pedido","Divergência de preços","Problemas com a nota fiscal","Problemas com o boleto","Pagamento de verbas","Descontos não concedidos","Devolução de mercadorias","Atraso na entrega","Cancelamento de pedido","Outros motivos",
  ].map((reason,index)=>({id:index+1,reason}))} as T;
  if(pathname==="/api/occurrences"&&(options.method||"GET").toUpperCase()==="GET")return {occurrences:structuredClone(currentMockUser.admin?occurrences:occurrences.filter(item=>item.seller_id===currentMockUser.id))} as T;
  if(pathname==="/api/occurrences"&&(options.method||"GET").toUpperCase()==="POST"){
    const payload=bodyOf(options),customer=data.customers.find(item=>item.id===Number(payload.customer_id)),sellerId=currentMockUser.admin?Number(payload.seller_id):currentMockUser.id,seller=data.users.find(item=>item.id===sellerId);
    const id=Math.max(0,...occurrences.map(item=>Number(item.id)))+1,createdAt=new Date().toLocaleString("pt-BR");
    const reasonId=Number(payload.reason_id),reason=["Produto avariado","Divergência de produto","Divergência de quantidade","Falta de produto no pedido","Divergência de preços","Problemas com a nota fiscal","Problemas com o boleto","Pagamento de verbas","Descontos não concedidos","Devolução de mercadorias","Atraso na entrega","Cancelamento de pedido","Outros motivos"][reasonId-1]||String(payload.reason||"");
    const occurrence={id,seller_id:sellerId,seller_name:seller?.name||currentMockUser.name,customer_id:customer?.id,customer_name:customer?.trade_name||customer?.legal_name,customer_cnpj:customer?.cnpj,reason_id:reasonId,reason,description:payload.description,status:"aberta",resolution:null,priority:payload.priority||"media",order_id:payload.order_id||null,company_id:payload.company_id||null,created_at:createdAt,attachments:(payload.attachments||[]).map((file:MockOrder,index:number)=>({id:Date.now()+index,filename:file.name,mimetype:file.mime})),timeline:[{id:Date.now(),title:"Ocorrência registrada",notes:"Relato enviado pelo aplicativo.",created_at:createdAt,created_by_name:seller?.name||currentMockUser.name}]};
    occurrences.unshift(occurrence);
    return structuredClone(occurrence) as T;
  }
  const occurrenceDetailMatch=pathname.match(/^\/api\/occurrences\/(\d+)$/);
  if(occurrenceDetailMatch)return structuredClone(occurrences.find(row=>row.id===Number(occurrenceDetailMatch[1]))||{}) as T;
  const occurrenceMatch=pathname.match(/^\/api\/admin\/occurrences\/(\d+)$/);
  if(occurrenceMatch&&(options.method||"GET").toUpperCase()==="PATCH"){const item=occurrences.find(row=>row.id===Number(occurrenceMatch[1])),payload=bodyOf(options);if(item){Object.assign(item,{status:payload.status,resolution:payload.resolution,priority:payload.priority,responsible_user_id:payload.responsible_user_id||null,due_at:payload.due_at||null,order_id:payload.order_id||null,company_id:payload.company_id||null});item.timeline.push({id:Date.now(),title:String(payload.status||"").replaceAll("_"," "),notes:payload.resolution,created_at:new Date().toLocaleString("pt-BR"),created_by_name:currentMockUser.name});}return structuredClone(item||{}) as T;}
  if(pathname==="/api/goals/my"){
    const query=queryOf(path),year=Number(query.get("year")),month=Number(query.get("month")),record=goalRecords.find(item=>item.year===year&&item.month===month&&item.seller_id===currentMockUser.id);
    return {year,month,goals:record?performance(record):undefined} as T;
  }
  if(pathname==="/api/admin/goals"&&(options.method||"GET").toUpperCase()==="GET"){
    const query=queryOf(path),year=Number(query.get("year")),month=Number(query.get("month"));
    return {year,month,rows:data.users.filter(user=>user.role==="seller").map(seller=>({seller,goals:performance(goalRecords.find(item=>item.year===year&&item.month===month&&item.seller_id===seller.id))}))} as T;
  }
  if(pathname==="/api/admin/goals"&&(options.method||"GET").toUpperCase()==="POST"){
    const payload=bodyOf(options),year=Number(payload.year),month=Number(payload.month);
    for(const input of payload.goals||[]){let record=goalRecords.find(item=>item.year===year&&item.month===month&&item.seller_id===Number(input.seller_id));if(!record){record={year,month,seller_id:Number(input.seller_id),sales_realized:0,new_customers_realized:0,positivation_realized:0,portfolio_customers:0,portfolio_attended:0};goalRecords.push(record);}record.sales_goal=input.sales_goal===""||input.sales_goal==null?null:Number(input.sales_goal);record.new_customers_goal=input.new_customers_goal===""||input.new_customers_goal==null?null:Number(input.new_customers_goal);record.positivation_goal=input.customer_positivation_goal===""||input.customer_positivation_goal==null?null:Number(input.customer_positivation_goal);}
    return {message:"Metas da equipe salvas no ambiente de demonstração."} as T;
  }
  if (pathname === "/api/sales") {const periodOrders=ordersInPeriod(path);return { resumo: { qtdPedidos: periodOrders.length, valorTotal: periodOrders.reduce((sum, order) => sum + Number(order.valorLiquido || 0), 0) }, porStatus: [], porEmpresa: [], pedidos: structuredClone(periodOrders) } as T;}
  if (pathname === "/api/admin/executive-dashboard") return { summary: { orders: orders.length, revenue: orders.reduce((sum, order) => sum + Number(order.valorLiquido || 0), 0), customers: data.customers.length, products: data.products.length } } as T;
  return {} as T;
}
