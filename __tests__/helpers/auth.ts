const BASE_URL = "http://localhost:3000";

export function createSignInRequest(
  username = "admin",
  password = "admin123",
  extraHeaders?: Record<string, string>,
): Request {
  return new Request(`${BASE_URL}/api/auth/sign-in/username`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ username, password }),
  });
}

export function createGetSessionRequest(cookie: string): Request {
  return new Request(`${BASE_URL}/api/auth/get-session`, {
    headers: { Cookie: cookie },
  });
}

export function createSignOutRequest(cookie: string): Request {
  return new Request(`${BASE_URL}/api/auth/sign-out`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
}

export function createSignUpEmailRequest(name: string, email: string, password: string): Request {
  return new Request(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
}

export function createSignUpUsernameRequest(
  name: string,
  email: string,
  password: string,
  username: string,
): Request {
  return new Request(`${BASE_URL}/api/auth/sign-up/username`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, username }),
  });
}
