import { createCn } from "cn/config"

// Class merging (clsx + tailwind-merge semantics). The app adds its own font sizes
// (text-11 = 11px ... see index.css); without telling the merger, it takes text-13 for a
// colour and drops it when a text colour class comes after it.
// The shadcn CLI imports cn straight from the "cn" package in new components: point those
// imports at this module instead.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["11", "12", "13", "14", "15", "19", "24"] }],
    },
  },
})
