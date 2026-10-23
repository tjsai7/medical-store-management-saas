import * as React from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export async function AppLayout({ children }: { children: React.ReactNode }) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { user, tenant, activeBranch, branches, role } = authContext;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Persistent Collapsible Sidebar */}
      <Sidebar
        isPlatformAdmin={user.isPlatformAdmin}
        tenantName={tenant?.name}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={user}
          role={role}
          activeBranch={activeBranch}
          branches={branches}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
