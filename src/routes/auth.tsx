import { createFileRoute } from "@tanstack/react-router";
import { StitchScreen } from "@/components/StitchScreen";
import html from "@/screens/auth.html?raw";
import script from "@/screens/auth.js.txt?raw";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — PocketWise" },
      { name: "description", content: "Sign in or create your PocketWise account." },
      { property: "og:title", content: "Sign In — PocketWise" },
      { property: "og:description", content: "Sign in or create your PocketWise account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StitchScreen html={html} script={script} active="account" />,
});
