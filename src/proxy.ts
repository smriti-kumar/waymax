import { NextResponse, type NextRequest } from "next/server";

// Fast cookie-presence check; real session validation happens in the caregiver layout and API.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("wm_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/caregiver", "/caregiver/:path*"] };
