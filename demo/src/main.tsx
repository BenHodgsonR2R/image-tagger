import { render } from "preact";
import { App } from "./App.tsx";

const root = document.getElementById("app");
if (root !== null) {
  render(<App />, root);
}
