import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/moradores")({
  component: () => <Outlet />,
});
