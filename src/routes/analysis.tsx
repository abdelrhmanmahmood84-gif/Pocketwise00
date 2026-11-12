import { createFileRoute } from "@tanstack/react-router";
import { StitchScreen } from "@/components/StitchScreen";
import html from "@/screens/analysis.html?raw";
import script from "@/screens/analysis.js.txt?raw";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Financial Analysis — PocketWise" },
      { name: "description", content: "Income vs expenses, spending breakdown and smart insights." },
      { property: "og:title", content: "Financial Analysis — PocketWise" },
      { property: "og:description", content: "Income vs expenses, spending breakdown and smart insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StitchScreen html={html} script={script} active="analysis" />,
});
