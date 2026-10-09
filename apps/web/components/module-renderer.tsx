"use client";

import type { SessionUser } from "../lib/api";
import type { ModuleId } from "../lib/navigation";
import { CatalogEditor } from "./catalog-editor";
import CustomerEditor from "./customer-editor";
import CustomerRequest from "./customer-request";
import DashboardView from "./dashboard-view";
import GoalsView from "./goals-view";
import OccurrenceEditor from "./occurrence-editor";
import OrdersView from "./orders-view";
import ReadOnlyCatalog from "./read-only-catalog";
import RegistrationApprovals from "./registration-approvals";
import ReportsView from "./reports-view";
import SettingsEditor from "./settings-editor";
import UsersEditor from "./users-editor";

type ModuleRendererProps = {
  module: ModuleId;
  user: SessionUser;
};

export default function ModuleRenderer({ module, user }: ModuleRendererProps) {
  const isAdmin = user.role === "admin";

  switch (module) {
    case "dashboard":
      return <DashboardView user={user} />;
    case "orders":
      return <OrdersView user={user} />;
    case "occurrences":
      return <OccurrenceEditor user={user} />;
    case "goals":
      return <GoalsView user={user} />;
    case "requestCustomer":
      return isAdmin ? null : <CustomerRequest />;
    case "customers":
      return isAdmin ? <CustomerEditor /> : <ReadOnlyCatalog section="customers" />;
    case "companies":
    case "products":
      return isAdmin ? (
        <CatalogEditor key={module} kind={module} />
      ) : (
        <ReadOnlyCatalog section={module} />
      );
    default:
      break;
  }

  // The server API enforces permissions as well; hiding a screen is not authorization.
  if (!isAdmin) {
    return (
      <p role="alert" className="rounded-xl border bg-white p-6">
        Acesso não autorizado.
      </p>
    );
  }

  switch (module) {
    case "approvals":
      return <RegistrationApprovals />;
    case "reports":
      return <ReportsView />;
    case "users":
      return <UsersEditor />;
    case "admin":
      return <SettingsEditor />;
    default:
      return null;
  }
}
