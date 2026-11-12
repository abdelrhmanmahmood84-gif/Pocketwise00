import { createFileRoute } from "@tanstack/react-router";
import { StitchScreen } from "@/components/StitchScreen";
import html from "@/screens/wallet.html?raw";
import script from "@/screens/wallet.js.txt?raw";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — PocketWise" },
      { name: "description", content: "Your balance, cash flow and recent transactions." },
      { property: "og:title", content: "Wallet — PocketWise" },
      { property: "og:description", content: "Your balance, cash flow and recent transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StitchScreen html={html} script={script} active="wallet" />,
});
