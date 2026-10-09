export type ModuleId="dashboard"|"orders"|"occurrences"|"customers"|"companies"|"products"|"reports"|"goals"|"users"|"admin"|"approvals"|"requestCustomer";
export type ModuleDefinition={id:ModuleId;slug:string;title:string;icon:string;group:"Ações"|"Gestão";adminOnly?:boolean};
export const modules:ModuleDefinition[]=[
 {id:"dashboard",slug:"painel",title:"Dashboard",icon:"▥",group:"Ações"},
 {id:"orders",slug:"pedidos",title:"Pedidos",icon:"▤",group:"Ações"},
 {id:"occurrences",slug:"ocorrencias",title:"Ocorrências",icon:"◫",group:"Ações"},
 {id:"customers",slug:"clientes",title:"Clientes",icon:"◉",group:"Ações"},
 {id:"companies",slug:"empresas",title:"Empresas",icon:"▦",group:"Ações"},
 {id:"products",slug:"produtos",title:"Produtos",icon:"◇",group:"Ações"},
 {id:"approvals",slug:"aprovacoes",title:"Aprovações",icon:"✓",group:"Gestão",adminOnly:true},
 {id:"reports",slug:"relatorios",title:"Relatórios",icon:"▥",group:"Gestão",adminOnly:true},
 {id:"goals",slug:"metas",title:"Metas",icon:"◎",group:"Gestão"},
 {id:"users",slug:"usuarios",title:"Usuários",icon:"♧",group:"Gestão",adminOnly:true},
 {id:"admin",slug:"configuracoes",title:"Configurações",icon:"⚙",group:"Gestão",adminOnly:true},
 {id:"requestCustomer",slug:"solicitar-cliente",title:"Solicitar cliente",icon:"+",group:"Gestão"}
];
export const modulePath=(module:ModuleDefinition)=>`/app/${module.slug}`;
export function getModuleFromPath(path:string){return modules.find(m=>modulePath(m)===path)||null}
export function visibleModules(role:string){return modules.filter(m=>role==="admin"?m.id!=="requestCustomer":!m.adminOnly&&m.id!=="users"&&m.id!=="reports"&&m.id!=="admin"&&m.id!=="approvals")}
