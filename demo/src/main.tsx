import { applyStoredTheme } from "@bhodgson/design-system";
import { render } from "preact";
import { App } from "./App.tsx";

applyStoredTheme();
const root = document.getElementById("app");
if (root !== null) {
  render(<App />, root);
}
