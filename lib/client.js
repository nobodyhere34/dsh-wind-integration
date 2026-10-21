window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-wind-integration",
	factory: (require) => {
		"use strict";
var windClientBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // client/index.tsx
  var client_exports = {};
  __export(client_exports, {
    NS: () => NS,
    apply: () => apply,
    en: () => en,
    inject: () => inject,
    name: () => name,
    zh: () => zh
  });
  var import_react = __require("react");

  // client/dicts.ts
  var zh = {
    statusTitle: "\u98CE\u63D2\u96C6\u6210\uFF08ds v4 0731\uFF09",
    statusActive: "\u5DF2\u751F\u6548\uFF1A{model}",
    statusInactive: "\u672A\u751F\u6548\uFF08\u6A21\u578B\u4E0D\u5339\u914D\uFF1A{model}\uFF09",
    statusIdle: "\u672A\u751F\u6548\uFF08\u6682\u65E0\u6D3B\u52A8\u4F1A\u8BDD\uFF09",
    statusDisabled: "\u672C\u4F1A\u8BDD\u5DF2\u624B\u52A8\u505C\u7528\uFF1A{model}",
    statusEnded: "\u5DF2\u7ED3\u675F\uFF1A{model}",
    statusModelUnknown: "\u672A\u751F\u6548\uFF08\u6A21\u578B\u672A\u77E5\uFF09",
    statusPresetSkipped: "\u8DF3\u8FC7\u53E0\u52A0\uFF1A\u8BE5\u9884\u8BBE\u5DF2\u662F\u98CE\u63D2\u539F\u751F\u5448\u73B0\uFF08{preset}\uFF09",
    statusPreserveTools: "\u4EC5\u884C\u4E3A\u6CE8\u5165\uFF1A\u5F53\u524D\u5448\u73B0\u6A21\u5F0F\u4E0D\u63A5\u7BA1\u5DE5\u5177\uFF08{presentation}\uFF09",
    statusStage: "\u5F53\u524D\u9636\u6BB5\uFF1A{stage}",
    statusBand: "\u4EFB\u52A1\u5E26\uFF1A{band}",
    statusGuided: "\u8FD1\u573A\u5F15\u5BFC\uFF1A\u5DF2\u6CE8\u5165",
    statusRestricted: "\u5DE5\u5177\u62AB\u9732\uFF1A\u9636\u6BB5\u6027\u6536\u7A84",
    windToggle: "\u98CE\u63D2\uFF08\u5F53\u524D\u4F1A\u8BDD\uFF09",
    accountLabel: "\u98CE\u63D2\u96C6\u6210"
  };
  var en = {
    statusTitle: "Wind integration (ds v4 0731)",
    statusActive: "Active: {model}",
    statusInactive: "Inactive (model mismatch: {model})",
    statusPresetSkipped: "Overlay skipped: preset already wind-native ({preset})",
    statusPreserveTools: "Behavior only: presentation mode keeps tool control ({presentation})",
    statusStage: "Current stage: {stage}",
    statusBand: "Task band: {band}",
    statusGuided: "Near-field guide: injected",
    statusRestricted: "Tool disclosure: staged",
    windToggle: "Wind (this session)",
    accountLabel: "Wind integration"
  };

  // client/index.tsx
  var import_jsx_runtime = __require("react/jsx-runtime");
  var name = "dsh-wind-client";
  var inject = ["slots", "locale"];
  var NS = "wind";
  function apply(ctx) {
    ctx.effect(() => {
      if (ctx.locale && typeof ctx.locale.register === "function") {
        ctx.locale.register("wind", { zh, en });
      }
    }, "dsh-wind: copy dictionaries");
    ctx.effect(() => {
      if (ctx.slots && typeof ctx.slots.inject === "function" && typeof ctx.slots.register === "function") {
        return ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
          name: "sidebar.footer.action",
          id: "wind-status",
          order: 200,
          locale: "wind"
        }, WindStatusCard));
      }
      return void 0;
    }, "dsh-wind: sidebar footer status indicator");
  }
  function useWindStatus() {
    const [status, setStatus] = (0, import_react.useState)(void 0);
    (0, import_react.useEffect)(() => {
      let alive = true;
      const load = () => {
        fetch("/wind/status", { credentials: "same-origin" }).then((res) => res.ok ? res.json() : null).then((data) => {
          if (alive) setStatus(data);
        }).catch(() => {
          if (alive) setStatus(void 0);
        });
      };
      load();
      const timer = setInterval(load, 4e3);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, []);
    return status;
  }
  function resolveLang() {
    try {
      const lang = (typeof navigator !== "undefined" ? navigator.language : "zh").toLowerCase();
      return lang.startsWith("en") ? "en" : "zh";
    } catch {
      return "zh";
    }
  }
  function dictT(lang) {
    const dict = lang === "en" ? en : zh;
    return (key, vars) => {
      let text = dict[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) text = text.split("{" + k + "}").join(v);
      }
      return text;
    };
  }
  function detailOf(status, tt) {
    const latest = status?.latest ?? null;
    if (!latest) return tt("statusIdle");
    const model = latest.model ?? status?.targetModels?.[0] ?? "";
    const withModel = (key) => tt(key, model === "" ? {} : { model });
    if (latest.engaged && latest.lastSkip === void 0) return tt("statusActive", model === "" ? {} : { model });
    switch (latest.lastSkip?.reason) {
      case "preset":
        return tt("statusPresetSkipped", { preset: latest.lastSkip?.preset ?? "" });
      case "session":
        return withModel("statusDisabled");
      case "ended":
        return withModel("statusEnded");
      default:
        return model === "" ? tt("statusModelUnknown") : withModel("statusInactive");
    }
  }
  var detail = { fontSize: 13, opacity: 0.85, lineHeight: "18px", whiteSpace: "nowrap" };
  var title = { fontSize: 13, lineHeight: "18px", whiteSpace: "nowrap" };
  function WindStatusCard(props) {
    const { wide, t: tf } = props;
    const status = useWindStatus();
    const tt = tf ?? dictT(resolveLang());
    const latest = status?.latest ?? null;
    const primary = detailOf(status, tt);
    const [enabled, setEnabled] = (0, import_react.useState)(null);
    (0, import_react.useEffect)(() => {
      if (status?.latest?.enabled !== void 0) setEnabled(status.latest.enabled);
    }, [status]);
    const handleToggle = (e) => {
      const sid = latest?.sid;
      if (!sid) return;
      const next = e.target.checked;
      setEnabled(next);
      fetch("/wind/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sid, enabled: next })
      }).catch(() => setEnabled(!next));
    };
    if (wide === false) {
      const active = !!(status && status.active && latest);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          role: "status",
          title: tt("statusTitle") + " \u2014 " + primary,
          "aria-label": tt("statusTitle") + " \u2014 " + primary,
          style: { display: "flex", alignItems: "center", justifyContent: "center", height: 28, cursor: "default" },
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "currentColor",
                opacity: active ? 1 : 0.35
              }
            }
          )
        }
      );
    }
    const secondary = status && latest && status.active && latest.band !== void 0 ? tt("statusBand", { band: latest.band }) + " \xB7 " + tt("statusStage", { stage: String(latest.stage ?? 1) + "/" + String(latest.stageTotal ?? 3) }) + (latest.guided ? " \xB7 " + tt("statusGuided") : "") + (latest.restrictApplied ? " \xB7 " + tt("statusRestricted") : "") : null;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { role: "status", style: { paddingTop: 2, paddingBottom: 2, maxWidth: 240 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: title, children: tt("statusTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: detail, children: primary }),
      secondary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: detail, children: secondary }) : null,
      latest ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, cursor: "pointer" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: enabled ?? status?.latest?.enabled ?? true,
            onChange: handleToggle,
            style: { accentColor: "currentColor", width: 13, height: 13 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, opacity: 0.85, whiteSpace: "nowrap" }, children: tt("windToggle") })
      ] }) : null
    ] });
  }
  return __toCommonJS(client_exports);
})();

		return windClientBundle;
	}
});
