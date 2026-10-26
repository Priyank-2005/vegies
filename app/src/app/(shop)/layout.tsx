import { ShopProvider } from "@/components/shop/shop-context";
import { CartBar, Footer, Header } from "@/components/shop/site-chrome";
import { ServiceabilityProvider } from "@/components/shop/use-serviceability";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <ServiceabilityProvider>
        <div className="flex min-h-dvh flex-col">
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-3">
            Skip to content
          </a>
          <Header />
          <div id="main" className="flex-1 pb-20 lg:pb-0">
            {children}
          </div>
          <Footer />
          <CartBar />
        </div>
      </ServiceabilityProvider>
    </ShopProvider>
  );
}
