import { CartView } from "./cart-view";

export const metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <h1 className="mb-5 text-[26px] font-extrabold tracking-tight sm:text-3xl">Your cart</h1>
      <CartView />
    </main>
  );
}
