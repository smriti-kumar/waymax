// MSW v3's Node interceptors (including its Node fetch interceptor) work at the
// socket level and corrupt the postgres.js TCP connection. Waymax only calls
// external APIs with global fetch, so tests use the interceptor that patches
// globalThis.fetch alone.
import { FetchInterceptor } from "@mswjs/interceptors/fetch/web";
import { InterceptorSource } from "msw/experimental";
import { defaultNetworkOptions, setupServer } from "msw/node";
import type { AnyHandler } from "msw";

export function setupFetchServer(...handlers: AnyHandler[]) {
  const opts = defaultNetworkOptions as { sources: unknown[]; onUnhandledFrame: unknown };
  // The web FetchInterceptor class is a separate build of the same interceptor type.
  opts.sources = [new InterceptorSource({ interceptors: [new FetchInterceptor() as never] })];
  opts.onUnhandledFrame = "bypass";
  return setupServer(...handlers);
}
