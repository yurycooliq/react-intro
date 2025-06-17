import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// Minimal customisation: start from defaultConfig and enable dark appearance.
// Chakra UI v3 relies on Panda CSS tokens; we can customise tokens via defineConfig.
// For now we just set color-scheme preference to dark (appearance attribute on <html>).

const customConfig = defineConfig({
  theme: {
    // Place for future custom tokens / recipes
  },
  // Set initial `appearance` to dark. This mirrors the previous initialColorMode.
  conditions: {
    appearance: "dark",
  },
});

const chakraSystem = createSystem(defaultConfig, customConfig);

export default chakraSystem;
