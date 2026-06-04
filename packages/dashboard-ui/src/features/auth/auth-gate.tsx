import { useAuth } from "../../lib/use-auth";
import { LoginScreen } from "./login-screen";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useAuth();

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

  if (data?.authRequired && !data.authenticated) return <LoginScreen />;

  return <>{children}</>;
}
