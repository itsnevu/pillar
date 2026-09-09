import { MarketView } from "./MarketView";

export default async function MarketPage({ params }: PageProps<"/app/[asset]">) {
  const { asset } = await params;
  return <MarketView symbol={asset.toUpperCase()} />;
}
