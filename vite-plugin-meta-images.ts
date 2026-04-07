import type { Plugin } from "vite";

export function metaImagesPlugin(): Plugin {
  return {
    name: "meta-images",
    transformIndexHtml(html) {
      return html;
    },
  };
}
