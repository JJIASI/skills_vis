import { createApp } from "vue";
import App from "./App.vue";
import * as api from "./api/client.js";
import i18n from "./i18n.js";
import "./styles.css";

createApp(App).use(i18n).provide("api", api).mount("#app");
