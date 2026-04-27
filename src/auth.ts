import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

function allowedEmails(): string[] {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string): boolean {
  return allowedEmails().includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER_HOST
        ? {
            host: process.env.EMAIL_SERVER_HOST,
            port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
            auth:
              process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
                ? {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                  }
                : undefined,
          }
        : { host: "localhost", port: 1025 },
      from: process.env.EMAIL_FROM ?? "noreply@localhost",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        if (!process.env.EMAIL_SERVER_HOST) {
          console.log(
            `\n📧 Magic link for ${identifier}\n   ${url}\n   (set EMAIL_SERVER_HOST in .env.local to send real emails)\n`,
          );
          return;
        }
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Your Wedding Hub sign-in link",
          text: `Sign in to Wedding Hub:\n\n${url}\n\nIf you did not request this email, ignore it.`,
          html: `<p>Sign in to <strong>Wedding Hub</strong>:</p><p><a href="${url}">${url}</a></p><p style="color:#888;font-size:12px">If you did not request this email, ignore it.</p>`,
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email || !isAllowed(email)) return false;
      const dbUser = await db.user.findUnique({ where: { email } });
      if (dbUser) {
        user.isCouple = dbUser.isCouple;
        user.role = dbUser.role;
        user.id = dbUser.id;
      }
      return true;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await db.auditLog.create({
          data: { userId: user.id, action: "signin", entity: "user", entityId: user.id },
        });
      } catch (err) {
        console.error("audit log failed", err);
      }
    },
  },
});
