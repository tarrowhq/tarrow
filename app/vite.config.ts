import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Tailwind runs entirely at BUILD time: it resolves `@import "tailwindcss"` in
// app/styles.css into one same-origin stylesheet under build/client/assets/.
// It adds no runtime of its own and no font request -- app/app/styles.css
// overrides its default families with a system stack so that no utility class
// can reintroduce one, and app/scripts/scan-external-origins.mjs fails the
// image build if any external origin reaches the output regardless.
//
// The client bundle beside that stylesheet is React Router's, and it is served
// from this origin like everything else (TASK-0008.01).
export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
});
