import { useDashboardConfig } from "../../extensions";
import { useAuth } from "../../lib/use-auth";
import { LoginScreen } from "./login-screen";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { auth } = useDashboardConfig();
  const { data, isLoading, isError } = useAuth();
  const path = window.location.pathname;

  if (auth?.acceptInvite && path === "/accept-invite") {
    const Screen = auth.acceptInvite;
    return <Screen />;
  }

  if (isLoading) {
    return (
      <div className="grid h-screen place-items-center bg-canvas text-sm text-muted">Loading…</div>
    );
  }

  if (isError) {
    return (
      <div className="grid h-screen place-items-center bg-canvas px-6 text-center text-sm text-muted">
        <div role="alert">
          <p className="text-ink">Can’t reach the Kew backend.</p>
          <p className="mt-1 text-xs">Is the server running? Check REDIS_URL and retry.</p>
        </div>
      </div>
    );
  }

  if (data?.authRequired && !data.authenticated) {
    if (auth?.signup && path === "/signup") {
      const Screen = auth.signup;
      return <Screen />;
    }
    return <LoginScreen />;
  }

  return <>{children}</>;
}
