import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessao } from "@/lib/sessao.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const sessao = await getSessao();
    if (!sessao) throw redirect({ to: "/", search: { redirect: location.href } });
    if (!sessao.admin) throw redirect({ to: "/app" });
    return { sessao };
  },
  component: () => <Outlet />,
});
