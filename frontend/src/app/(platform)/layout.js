import AppShell from "@/components/layout/AppShell";
import AuthGate from "@/components/layout/AuthGate";

export default function PlatformLayout({ children }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
