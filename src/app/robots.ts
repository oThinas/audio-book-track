import type { MetadataRoute } from "next";

// Permissive policy: a blocking `Disallow: /` would fail Lighthouse's
// is-crawlable audit (SEO < 100). Private content is protected by auth — the
// proxy redirects every unauthenticated request to /login — so allowing
// crawlers here only exposes the login page, which is fine to index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
