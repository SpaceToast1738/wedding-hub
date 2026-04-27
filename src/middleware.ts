import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/signin", "/api/auth", "/_next", "/favicon.ico"];
const COUPLE_ONLY_PREFIXES = ["/budget", "/payments"];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const session = req.auth;

  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p))) {
    return NextResponse.next();
  }

  if (!session?.user) {
    const url = new URL("/signin", nextUrl);
    if (path !== "/") url.searchParams.set("callbackUrl", path + nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (COUPLE_ONLY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    if (!session.user.isCouple) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
