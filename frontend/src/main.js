import { createApp } from "vue";
import App from "./App.vue";
import * as api from "./api/client.js";
import "./styles.css";

createApp(App).provide("api", api).mount("#app");
