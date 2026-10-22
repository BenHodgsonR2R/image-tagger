import starlight from "@astrojs/starlight";
import { docsTheme } from "@bhodgson/docs";
import { apiSidebar } from "@bhodgson/docs/api";
import { defineConfig } from "astro/config";
import { api } from "./src/api.ts";
import { base } from "./src/site.ts";

export default defineConfig({
  site: "https://bhodgs.github.io",
  base,
  integrations: [
    starlight({
      title: "image-tagger",
      description:
        "Tags images from a vocabulary you define, with a decision model that can't invent its own tags.",
      favicon: "/favicon.png",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/bhodgs/image-tagger",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/bhodgs/image-tagger/edit/main/docs/",
      },
      plugins: [docsTheme()],
      sidebar: [
        { label: "Guides", items: [{ autogenerate: { directory: "guides" } }] },
        { label: "Playground", link: "/playground/" },
        apiSidebar(api),
        {
          label: "Contributing",
          items: [{ autogenerate: { directory: "contributing" } }],
        },
      ],
    }),
  ],
});
