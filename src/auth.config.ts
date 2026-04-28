import type { NextAuthConfig } from "next-auth";
// Side-effect import so TypeScript can resolve the `next-auth/jwt` module
// for the declare-module augmentation below. Without this `import`, the
// module isn't "visible" to the augmentation pass under bundler module
// resolution. Required since next-auth/@auth/core upgraded to a nested
// node_modules layout (>=v5.0.0-beta.25 with @auth/core 0.41+).
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    isCouple?: boolean;
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      isCouple: boolean;
      role: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

// Augment next-auth's JWT type. Earlier versions exposed this as
// "@auth/core/jwt" at the project root; in newer next-auth (>=5.0.0-beta.25
// with @auth/core 0.41+) the public path is "next-auth/jwt" — @auth/core
// is now a private nested dep of next-auth and not resolvable from the
// project root.
declare module "next-auth/jwt" {
  interface JWT {
    isCouple?: boolean;
    role?: string;
  }
}

export const authConfig = {
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/verify",
    error: "/signin/error",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isCouple = user.isCouple ?? false;
        token.role = user.role ?? "VIEWER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.isCouple = token.isCouple ?? false;
        session.user.role = token.role ?? "VIEWER";
      }
      return session;
    },
    authorized({ auth }) {
      return !!auth;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
