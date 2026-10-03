import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { ApiError, STATUS } from "./errors";

type Params = Record<string, string | string[] | undefined>;
export type RouteCtx = { params: Promise<Params> };

export interface HandlerArgs<B, Q> {
  req: NextRequest;
  params: Record<string, string>;
  body: B;
  query: Q;
  requestId: string;
}

interface RouteOptions<B, Q> {
  body?: ZodType<B>;
  query?: ZodType<Q>;
}

export function json(data: unknown, status = 200, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(err: ApiError, requestId: string) {
  return NextResponse.json(
    { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } },
    { status: err.status, headers: { "x-request-id": requestId } },
  );
}

/** Maps any thrown value to the §6 error shape. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return new ApiError("VALIDATION", "Some fields are missing or invalid", z.flattenError(err));
  }
  const pg = (err as { cause?: { code?: string }; code?: string }) ?? {};
  const code = pg.code ?? pg.cause?.code;
  if (code === "23505") return new ApiError("CONFLICT", "That already exists");
  if (code === "23514" || code === "23503") return new ApiError("UNPROCESSABLE", "That change isn't allowed");
  if (code === "22P02") return new ApiError("VALIDATION", "Invalid identifier");
  return new ApiError("INTERNAL", "Something went wrong");
}

async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION", "Body must be valid JSON");
  }
}

/**
 * Wraps a route handler: parses params/body/query with zod, maps errors to the
 * §6 shape, and logs one line per request with a request id.
 */
export function route<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q>,
  fn: (args: HandlerArgs<B, Q>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    const requestId = randomUUID().slice(0, 8);
    const started = Date.now();
    let status = 500;
    try {
      const raw = ((await ctx?.params) ?? {}) as Params;
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params[k] = v;
      const body = opts.body ? opts.body.parse(await readJson(req)) : (undefined as B);
      const query = opts.query
        ? opts.query.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
        : (undefined as Q);
      const result = await fn({ req, params, body, query, requestId });
      const res = result instanceof Response ? result : json(result ?? {});
      status = res.status;
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      const apiErr = toApiError(err);
      status = apiErr.status;
      if (apiErr.code === "INTERNAL") console.error(`[api ${requestId}] unhandled error`, err);
      return errorResponse(apiErr, requestId);
    } finally {
      if (process.env.NODE_ENV !== "test") {
        console.log(`[api ${requestId}] ${req.method} ${req.nextUrl.pathname} ${status} ${Date.now() - started}ms`);
      }
    }
  };
}

export { STATUS };
