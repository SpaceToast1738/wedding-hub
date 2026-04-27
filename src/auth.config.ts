import type { NextAuthConfig } from "next-auth";

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

declare module "@auth/core/jwt" {
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
