import "./style.css";
import { mount } from "./app.ts";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("missing #app");
mount(app);
