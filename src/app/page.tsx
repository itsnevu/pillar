import "../styles/pyris.css";

import { Banner, Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Tabs } from "@/components/Tabs";
import { Markets } from "@/components/Markets";
import { HowItWorks } from "@/components/HowItWorks";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Banner />
      <div className="rusd-shell p2p-app-shell">
        <Header />
        <main className="rusd-frame rusd-main">
          <section className="borrow-hub">
            <Hero />
            <Tabs />
            <Markets />
          </section>
          <HowItWorks />
          <Faq />
        </main>
        <Footer />
      </div>
    </>
  );
}
