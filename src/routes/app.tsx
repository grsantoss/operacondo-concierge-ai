import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessao } from "@/lib/sessao.functions";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const sessao = await getSessao();
    if (!sessao) throw redirect({ to: "/", search: { redirect: location.href } });
    if (!sessao.tenantId) throw redirect({ to: sessao.admin ? "/admin" : "/" });
    if (sessao.assinaturaPendente) throw redirect({ to: "/assinar" });
    return { sessao };
  },
  component: () => <Outlet />,
});
