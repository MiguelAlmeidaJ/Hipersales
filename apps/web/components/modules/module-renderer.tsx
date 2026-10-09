"use client";

import { CatalogEditor } from "@/components/catalog/catalog-editor";
import ReadOnlyCatalog from "@/components/catalog/read-only-catalog";
import CustomerEditor from "@/components/customers/customer-editor";
import CustomerRequest from "@/components/customers/customer-request";
import RegistrationApprovals from "@/components/customers/registration-approvals";
import DashboardView from "@/components/dashboard/dashboard-view";
import GoalsView from "@/components/goals/goals-view";
import OccurrenceEditor from "@/components/occurrences/occurrence-editor";
import OrdersView from "@/components/orders/orders-view";
import ReportsView from "@/components/reports/reports-view";
import SettingsEditor from "@/components/settings/settings-editor";
import UsersEditor from "@/components/users/users-editor";
import type { SessionUser } from "@/lib/api";
import type { ModuleId } from "@/lib/navigation";

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
