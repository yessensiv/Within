import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Root } from "./App";
import { initializeReadingSize } from "./ReadingSettings";

initializeReadingSize();

const router = createBrowserRouter([{ path: "*", element: <Root /> }]);
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
