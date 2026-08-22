/**
 * The docs and the setup wizard have moved to the commercial site.
 *
 * Two copies of the same manual on two domains compete with each other for the
 * same searches and split whatever authority either earns — the one mistake
 * that would undercut an SEO strategy built on that content. So this app
 * redirects them permanently to the canonical site and keeps only /dashboard,
 * which is the app surface rather than a marketing page.
 *
 * Gated on LEAS_CANONICAL_SITE. Unset, nothing redirects and this site behaves
 * exactly as before — so it is safe to deploy before the domain exists. Set it
 * to the marketing origin (no trailing slash) to switch the redirects on.
 */
const canonical = process.env.LEAS_CANONICAL_SITE?.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async redirects() {
    if (!canonical) return [];
    return [
      { source: '/', destination: canonical, permanent: true },
      { source: '/setup', destination: `${canonical}/setup`, permanent: true },
      { source: '/docs', destination: `${canonical}/docs`, permanent: true },
      { source: '/docs/:slug', destination: `${canonical}/docs/:slug`, permanent: true },
    ];
  },
};
