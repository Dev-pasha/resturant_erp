import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

function Shell() {
  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 bg-brand p-3 text-brand-fg">
        <Link to="/pos">POS</Link>
        <Link to="/kds">Kitchen</Link>
        <Link to="/admin">Back Office</Link>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl">{title}</h1>
      <Button variant="outline">Coming soon</Button>
    </section>
  );
}

const rootRoute = createRootRoute({ component: Shell });

const routes = (['pos', 'kds', 'admin'] as const).map((segment) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: `/${segment}`,
    component: () => <Placeholder title={segment.toUpperCase()} />,
  }),
);

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Placeholder title="Restaurant ERP" />,
});

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, ...routes]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
