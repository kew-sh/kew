import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { authInfo, server } from "@/test/handlers";
import { renderWithClient } from "@/test/render";
import { LoginScreen } from "./login-screen";

describe("LoginScreen", () => {
  it("renders the access-key form by default (password only, no email)", async () => {
    renderWithClient(<LoginScreen />);
    expect(await screen.findByText(/enter the access key to continue/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Email")).not.toBeInTheDocument();
  });

  it("disables Sign in until a password is typed", async () => {
    const user = userEvent.setup();
    renderWithClient(<LoginScreen />);

    const submit = await screen.findByRole("button", { name: /sign in/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Password"), "hunter2");
    expect(submit).toBeEnabled();
  });

  it("POSTs the password to /api/auth/login on submit", async () => {
    const user = userEvent.setup();
    const box: { body?: unknown } = {};
    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        box.body = await request.clone().json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithClient(<LoginScreen />);
    await user.type(await screen.findByPlaceholderText("Password"), "s3cret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(box.body).toBeDefined());
    expect(box.body).toMatchObject({ password: "s3cret" });
    expect((box.body as { email?: string }).email).toBeUndefined();
  });

  it("shows an error message when the server responds 401", async () => {
    const user = userEvent.setup();
    server.use(http.post("*/api/auth/login", () => new HttpResponse(null, { status: 401 })));

    renderWithClient(<LoginScreen />);
    await user.type(await screen.findByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/incorrect email or password/i);
  });

  it("shows the email field when the server requires a user", async () => {
    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({
          ...authInfo,
          authRequired: true,
          authenticated: false,
          mode: "password",
          requiresUser: true,
        }),
      ),
    );

    renderWithClient(<LoginScreen />);
    expect(await screen.findByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByText(/sign in to continue/i)).toBeInTheDocument();
  });

  it("keeps Sign in disabled until both email and password are filled in user mode", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({
          ...authInfo,
          authRequired: true,
          authenticated: false,
          mode: "password",
          requiresUser: true,
        }),
      ),
    );

    renderWithClient(<LoginScreen />);
    const email = await screen.findByPlaceholderText("Email");
    const submit = screen.getByRole("button", { name: /sign in/i });

    await user.type(screen.getByPlaceholderText("Password"), "pw");
    expect(submit).toBeDisabled();

    await user.type(email, "a@b.com");
    expect(submit).toBeEnabled();
  });
});
