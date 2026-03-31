const BASE_URL = "http://localhost:3000";

export function createSignInRequest(
  username = "admin",
  password = "admin123",
): Request {
  return new Request(`${BASE_URL}/api/auth/sign-in/username`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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