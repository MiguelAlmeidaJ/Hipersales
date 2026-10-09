"use client";
import type {SessionUser} from "../lib/api";
import type {ModuleId} from "../lib/navigation";
import {CatalogEditor} from "./catalog-editor";
import CustomerEditor from "./customer-editor";
import OccurrenceEditor from "./occurrence-editor";
import CustomerRequest from "./customer-request";
import OrdersView from "./orders-view";
import UsersEditor from "./users-editor";
import RegistrationApprovals from "./registration-approvals";
import GoalsView from "./goals-view";
import ReportsView from "./reports-view";
import SettingsEditor from "./settings-editor";
import DashboardView from "./dashboard-view";
import ReadOnlyCatalog from "./read-only-catalog";

export default function ModuleRenderer({module,user}:{module:ModuleId;user:SessionUser}){
 const admin=user.role==="admin";
 if(module==="dashboard")return <DashboardView user={user}/>;
 if(module==="orders")return <OrdersView user={user}/>;
 if(module==="occurrences")return <OccurrenceEditor user={user}/>;
 if(module==="goals")return <GoalsView user={user}/>;
 if(module==="requestCustomer")return !admin?<CustomerRequest/>:null;
 if(module==="customers")return admin?<CustomerEditor/>:<ReadOnlyCatalog section="customers"/>;
 if(module==="companies"||module==="products")return admin?<CatalogEditor key={module} kind={module}/>:<ReadOnlyCatalog section={module}/>;
 if(!admin)return <p role="alert" className="rounded-xl border bg-white p-6">Acesso não autorizado.</p>;
 if(module==="approvals")return <RegistrationApprovals/>;
 if(module==="reports")return <ReportsView/>;
 if(module==="users")return <UsersEditor/>;
 if(module==="admin")return <SettingsEditor/>;
 return null;
}
