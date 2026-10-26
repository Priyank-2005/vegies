import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderDetails } from "@/components/shop/order-details";
import { isRecent } from "@/lib/format";
import { currentCustomer } from "@/server/auth/customer-guards";
import { db } from "@/server/db/client";
import { getOrderForCustomer } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await currentCustomer();
  if (!customer) redirect("/my-orders");
  const { id } = await params;
  const order = await getOrderForCustomer(db(), customer.id, id);
  if (!order) notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <p className="mb-4 text-sm">
        <Link className="font-medium text-brand underline underline-offset-2" href="/my-orders">All my orders</Link>
      </p>
      <OrderDetails order={order} cancelUrl={`/api/v1/my-orders/${order.id}/cancel`} justPlaced={isRecent(order.createdAt, 120)} />
    </main>
  );
}
