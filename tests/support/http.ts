import { NextRequest } from "next/server";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  cookie?: string;
  params?: Record<string, string>;
}

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
  res: Response;
  /** name=value pairs from Set-Cookie, ready to pass back as `cookie`. */
  cookies: Record<string, string>;
}

export async function call<T = any>(handler: Handler, opts: CallOptions = {}): Promise<CallResult<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  let body: BodyInit | undefined = opts.rawBody;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] ??= "application/json";
  }
  const req = new NextRequest(new URL(opts.path ?? "/api/test", "http://localhost:3000"), {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const ct = res.headers.get("content-type") ?? "";
  const parsed = res.status === 204 ? null : ct.includes("json") ? await res.json() : await res.arrayBuffer();
  const cookies: Record<string, string> = {};
  for (const sc of res.headers.getSetCookie()) {
    const [pair] = sc.split(";");
    const i = pair.indexOf("=");
    cookies[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return { status: res.status, body: parsed as T, headers: res.headers, res, cookies };
}

export const cookieHeader = (name: string, value: string) => `${name}=${value}`;
