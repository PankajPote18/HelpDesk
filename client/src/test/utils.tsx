import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";

type RenderWithQueryOptions = Omit<RenderOptions, "wrapper"> & {
  /** Initial URL to render at, e.g. "/tickets/abc123". Defaults to "/". */
  route?: string;
  /** Route pattern the component is mounted under, e.g. "/tickets/:id". Defaults to "*" (matches any route, no params). */
  path?: string;
};

function renderWithQuery(ui: React.ReactElement, options?: RenderWithQueryOptions) {
  const { route = "/", path = "*", ...renderOptions } = options ?? {};

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export { renderWithQuery };
