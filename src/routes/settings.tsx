import { createFileRoute } from "@tanstack/react-router";
import { StitchScreen } from "@/components/StitchScreen";
import html from "@/screens/settings.html?raw";
import script from "@/screens/settings.js.txt?raw";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PocketWise" },
      { name: "description", content: "Manage your profile, preferences, security and data." },
      { property: "og:title", content: "Settings — PocketWise" },
      { property: "og:description", content: "Manage your profile, preferences, security and data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StitchScreen html={html} script={script} active="settings" />,
});
