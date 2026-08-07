import type { Config } from "@react-router/dev/config";

export default {
  // SSR is R1 (plan.md): React Router owns the HTTP server and degrades to
  // working HTML with JavaScript disabled. SPA mode would ship an empty
  // shell for a population where that is a safety property, not an
  // ergonomic one -- and that is still the reason, now that the client
  // bundle is shipped again (TASK-0008.01). The answer is complete in the
  // first response; hydration only makes it interactive.
  ssr: true,
} satisfies Config;
