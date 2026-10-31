/**
 * Neutral staff-app design tokens. Customer-facing branding is NOT set here:
 * storefront colours come from tenant branding CSS variables (--brand-*).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          fg: 'var(--brand-primary-fg)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
        },
        surface: 'var(--surface)',
        content: 'var(--text)',
        muted: 'var(--muted)',
      },
      borderRadius: {
        brand: 'var(--radius)',
      },
      fontFamily: {
        body: 'var(--font-body)',
        heading: 'var(--font-heading)',
      },
    },
  },
};
