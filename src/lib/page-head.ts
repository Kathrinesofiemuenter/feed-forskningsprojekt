export function pageHead(title: string, description: string) {
  return { meta: [
    { title: `${title} – Feed-forskningsprojekt` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} – Feed-forskningsprojekt` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}
