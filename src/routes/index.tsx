import { createFileRoute } from "@tanstack/react-router";
import { StitchScreen } from "@/components/StitchScreen";
import html from "@/screens/landing.html?raw";
import script from "@/screens/landing.js.txt?raw";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PocketWise — Take Control of Your Money" },
      { name: "description", content: "Calm, institutional-grade clarity for your personal finances." },
      { property: "og:title", content: "PocketWise — Take Control of Your Money" },
      { property: "og:description", content: "Calm, institutional-grade clarity for your personal finances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StitchScreen html={html} script={script} active="home" />,
});
