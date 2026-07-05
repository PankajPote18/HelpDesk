import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import "./index.css";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry client errors (4xx) — they won't succeed on retry (e.g. a
        // deleted/nonexistent ticket), so retrying just delays the error message.
        if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
