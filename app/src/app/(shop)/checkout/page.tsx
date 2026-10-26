import { CheckoutView } from "./checkout-view";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <h1 className="mb-5 text-[26px] font-extrabold tracking-tight sm:text-3xl">Checkout</h1>
      <CheckoutView />
    </main>
  );
}
