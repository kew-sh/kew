import { Layers } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useAuth, useLogin } from "../../lib/use-auth";

function loginError(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401) return "Incorrect email or password.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  return "Could not reach the server.";
}

export function LoginScreen() {
  const { data: auth } = useAuth();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const requiresUser = auth?.requiresUser ?? false;
  const canSubmit = password.length > 0 && (!requiresUser || email.length > 0);

  return (
    <div className="grid h-screen place-items-center bg-canvas px-6 text-ink">
      <div className="w-full max-w-76">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-ink">
            <Layers className="size-5" strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-base font-semibold tracking-tight">Kew</div>
            <p className="mt-1 text-xs text-muted">
              {requiresUser ? "Sign in to continue." : "Enter the access key to continue."}
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) login.mutate({ email: requiresUser ? email : undefined, password });
          }}
          className="space-y-2.5"
        >
          {requiresUser && (
            <input
              type="email"
              value={email}
              // biome-ignore lint/a11y/noAutofocus: first field on a dedicated gate
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="username"
              className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong"
            />
          )}
          <input
            type="password"
            value={password}
            // biome-ignore lint/a11y/noAutofocus: sole field when no email is required
            autoFocus={!requiresUser}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-line-strong"
          />
          <Button
            type="submit"
            variant="accent"
            size="md"
            disabled={!canSubmit || login.isPending}
            className="h-9 w-full"
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
          {login.isError && (
            <p role="alert" className="text-center text-xs text-failed">
              {loginError(login.error)}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
