import type { Metadata } from "next";
import AdminPanelShell from "./AdminPanelShell";

export const metadata: Metadata = {
  title: "لوحة الإدارة",
  robots: { index: false, follow: false },
};

export default function AdminPanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminPanelShell
      databaseConfigured={Boolean(process.env.MONGODB_URI)}
    >
      {children}
    </AdminPanelShell>
  );
}
