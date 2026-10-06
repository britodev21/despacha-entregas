import { createBrowserRouter } from "react-router";

import { NotFoundPage } from "@/features/system/NotFoundPage";
import { RouteErrorPage } from "@/features/system/RouteErrorPage";
import { SystemStatusPage } from "@/features/system/SystemStatusPage";

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/", element: <SystemStatusPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
