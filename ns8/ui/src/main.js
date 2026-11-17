import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import CarbonComponentsVue from "@carbon/vue";
Vue.use(CarbonComponentsVue);

import axios from "axios";
axios.defaults.timeout = 10000;
import VueAxios from "vue-axios";
Vue.use(VueAxios, axios);

import ns8Lib from "@nethserver/ns8-ui-lib";
Vue.use(ns8Lib);

import VueDateFns from "vue-date-fns";
Vue.use(VueDateFns);

import LottieAnimation from "lottie-web-vue";
Vue.use(LottieAnimation);

import vueDebounce from "vue-debounce";
Vue.use(vueDebounce);

import { Filters } from "@nethserver/ns8-ui-lib";
for (const f in Filters) {
  Vue.filter(f, Filters[f]);
}

Vue.config.productionTip = false;

import VueI18n from "vue-i18n";
import { loadLanguage } from "./i18n";

loadI18n();

async function loadI18n() {
  const navigatorLang = (navigator.language || "en").substring(0, 2);
  const enModule = await loadLanguage("en");
  const enMessages = (enModule && enModule.default) || enModule || {};
  const messages = {
    en: enMessages,
  };

  let activeLocale = "en";
  if (navigatorLang !== "en") {
    const activeModule = await loadLanguage(navigatorLang);
    const activeMessages =
      (activeModule && activeModule.default) || activeModule;
    if (activeMessages) {
      messages[navigatorLang] = activeMessages;
      activeLocale = navigatorLang;
    }
  }

  Vue.use(VueI18n);
  const i18n = new VueI18n({
    locale: activeLocale,
    fallbackLocale: "en",
    messages,
    silentFallbackWarn: true,
  });

  new Vue({
    router,
    store,
    i18n,
    render: (h) => h(App),
  }).$mount("#ns8-app");
}
