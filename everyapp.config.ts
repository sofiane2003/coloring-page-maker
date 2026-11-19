import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "coloring-page-maker",
  name: "Coloring Page Maker",
  description:
    "Turns a short description into a printable black-and-white coloring page, keeps each member's pages and shares favorites in a team gallery.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    r2: ["files"],
    ai: ["AI"],
  },
  settings: [
    {
      name: "DAILY_GENERATION_LIMIT",
      type: "number",
      default: "25",
      why: "How many pages each member can generate per day (UTC).",
    },
  ],
});
