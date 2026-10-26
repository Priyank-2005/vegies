import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { currentCustomer } from "@/server/auth/customer-guards";
import { db } from "@/server/db/client";
import { listCustomerOrders } from "@/server/services/orders";
import { MyOrdersSignIn } from "./sign-in";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders", robots: { index: false, follow: false } };

const LABEL: Record<string, { text: string; tone: "brand" | "danger" | "accent" | "neutral" }> = {
  DELIVERED: { text: "Delivered", tone: "brand" },
  CANCELLED: { text: "Cancelled", tone: "danger" },
  EXPIRED: { text: "Expired", tone: "danger" },
  OUT_FOR_DELIVERY: { text: "On the way", tone: "accent" },
  DELIVERY_FAILED: { text: "Delivery failed", tone: "danger" },
};

export default async function MyOrdersPage() {
  const customer = await currentCustomer();
  if (!customer) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-[26px] font-extrabold tracking-tight">My orders</h1>
            <p className="text-muted">Sign in with your mobile number to see your orders.</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
            <MyOrdersSignIn />
          </div>
        </div>
      </main>
    );
  }
  const orders = await listCustomerOrders(db(), customer.id);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-5 text-[26px] font-extrabold tracking-tight">My orders</h1>
      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <p className="font-semibold">No orders yet</p>
          <p className="mt-1 text-muted">Your orders will appear here.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-2" href="/shop">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
          {orders.map((o) => {
            const plain = o.status.replace(/_/g, " ").toLowerCase();
            const l = LABEL[o.status] ?? { text: plain.charAt(0).toUpperCase() + plain.slice(1), tone: "neutral" as const };
            return (
              <li key={o.id}>
                <Link href={`/my-orders/${o.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold tracking-wide">{o.publicCode}</p>
                    <p className="text-[13px] text-muted">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatINR(o.totalPaise)}</p>
                    <Badge tone={l.tone}>{l.text}</Badge>
                  </div>
                  <IconChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
