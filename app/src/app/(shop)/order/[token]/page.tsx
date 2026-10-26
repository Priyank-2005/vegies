import { notFound } from "next/navigation";
import { OrderDetails } from "@/components/shop/order-details";
import { isRecent } from "@/lib/format";
import { db } from "@/server/db/client";
import { getOrderByTrackingToken } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  const order = await getOrderByTrackingToken(db(), token);
  if (!order) notFound();
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <OrderDetails order={order} cancelUrl={`/api/v1/orders/${token}/cancel`} justPlaced={sp.new === "1" || isRecent(order.createdAt, 120)} />
    </main>
  );
}
