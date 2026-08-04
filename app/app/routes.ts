import { type RouteConfig, index } from "@react-router/dev/routes";

// Phase 5 (TASK-0002, web surface) adds the address form and result route
// (search.tsx) named in plan.md's project structure. This phase only needs
// the composition to serve a page, so the route table is deliberately
// minimal rather than a placeholder for work that isn't this phase's scope.
export default [index("routes/_index.tsx")] satisfies RouteConfig;
