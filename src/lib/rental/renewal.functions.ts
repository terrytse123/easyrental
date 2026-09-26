import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const notifyRenewals = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { mailDueRenewals } = await import("./renewal-mail.server");
    return mailDueRenewals(context.userId);
  });

export const sendRenewalTest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { mailRenewalTest } = await import("./renewal-mail.server");
    return mailRenewalTest(context.userId);
  });
