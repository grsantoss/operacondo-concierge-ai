import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/usuarios")({
  component: () => <Outlet />,
});
