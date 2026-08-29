import { vi } from "vitest";

type FetchInput = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

// Stub the global fetch with a queue of responses. Returns the mock so tests
// can assert on the calls (URLs, headers, etc.).
export function mockFetch(...responses: Response[]): ReturnType<typeof vi.fn> {
  const impl: FetchInput = vi.fn(async () => responses.shift() ?? new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", impl);
  return vi.mocked(impl);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(status = 500, text = "Server Error"): Response {
  return new Response(text, { status });
}

export function afterEachResetFetch(): void {
  vi.unstubAllGlobals();
}