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
  var import_react2 = __require("react");

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
    accountLabel: "\u98CE\u63D2\u96C6\u6210",
    targetsItemTitle: "\u98CE\u63D2\u76EE\u6807\u6A21\u578B",
    targetsSummary: "\u5DF2\u9009 {count} \u4E2A\u76EE\u6807\u6A21\u578B\uFF1B\u70B9\u51FB\u914D\u7F6E\u3002",
    targetsTitle: "\u76EE\u6807\u6A21\u578B",
    targetsDescription: "\u53EA\u6709\u52FE\u9009\u7684\u6A21\u578B\u4F1A\u542F\u7528\u98CE\u63D2\u884C\u4E3A\uFF1B\u9009\u9879\u6765\u81EA\u5F53\u524D\u5DF2\u5BFC\u5165\u7684\u6A21\u578B\u670D\u52A1\u5546\u3002",
    targetsCatalogHint: "\u5DF2\u9009 {count} \u4E2A\u6A21\u578B",
    targetsCatalogLoading: "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u2026",
    targetsCatalogError: "\u6A21\u578B\u76EE\u5F55\u8BFB\u53D6\u5931\u8D25\uFF0C\u53EF\u7A0D\u540E\u91CD\u8BD5\u3002",
    targetsEmpty: "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B\u670D\u52A1\u5546\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u5BFC\u5165\u6A21\u578B\u3002",
    targetsStale: "\u5DF2\u914D\u7F6E\u4F46\u5F53\u524D\u76EE\u5F55\u672A\u63D0\u4F9B",
    targetsSave: "\u4FDD\u5B58",
    targetsSaving: "\u4FDD\u5B58\u4E2D\u2026",
    targetsDiscard: "\u653E\u5F03\u4FEE\u6539",
    targetsReadonly: "\u5F53\u524D\u914D\u7F6E\u4E0D\u53EF\u5199\uFF08Host \u672A\u5F00\u542F\u8BBE\u7F6E\u5199\u5165\uFF09\u3002"
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
    accountLabel: "Wind integration",
    targetsItemTitle: "Wind target models",
    targetsSummary: "{count} target model(s) selected; open to configure.",
    targetsTitle: "Target models",
    targetsDescription: "Wind behavior engages only for the checked models; options come from the imported model providers.",
    targetsCatalogHint: "{count} model(s) selected",
    targetsCatalogLoading: "Reading the model catalogue\u2026",
    targetsCatalogError: "Model catalogue unavailable; retry later.",
    targetsEmpty: "No model provider is available; import a provider first.",
    targetsStale: "Configured but not advertised by the catalogue",
    targetsSave: "Save",
    targetsSaving: "Saving\u2026",
    targetsDiscard: "Discard",
    targetsReadonly: "This configuration is not writable (Host settings writes are disabled)."
  };

  // client/settings-page.tsx
  var import_react = __require("react");
  var import_jsx_runtime = __require("react/jsx-runtime");
  function isWindValue(value) {
    if (typeof value !== "object" || value === null) return false;
    return Array.isArray(value.targetModels) && typeof value.matchV4Fallback === "boolean";
  }
  function findWindNamespace(forms) {
    const view = forms.describe().getSnapshot().view;
    return view?.namespaces.find((entry) => isWindValue(entry.value))?.ns;
  }
  function configuredModels(snapshot) {
    const value = snapshot.value;
    if (value === null || typeof value !== "object") return [];
    const models = value.targetModels;
    return Array.isArray(models) ? models.filter((model) => typeof model === "string") : [];
  }
  function fallbackT(key) {
    return key;
  }
  function mergedGroups(groups, configured) {
    const known = new Set(groups.flatMap((group) => group.models.map((model) => model.id)));
    const stale = configured.filter((model) => !known.has(model));
    if (stale.length === 0) return [...groups];
    return [...groups, { id: "", name: "", models: stale.map((id) => ({ id, name: id })) }];
  }
  function WindTargetsPage({ view, windForm, loadCatalog, t: tf }) {
    const t = tf ?? fallbackT;
    const snapshot = (0, import_react.useSyncExternalStore)(
      (listener) => windForm.subscribe(listener),
      () => windForm.getSnapshot()
    );
    const configured = configuredModels(snapshot);
    const [catalog, setCatalog] = (0, import_react.useState)({ status: "idle", groups: [] });
    const [draft, setDraft] = (0, import_react.useState)(void 0);
    const [saving, setSaving] = (0, import_react.useState)(false);
    const [error, setError] = (0, import_react.useState)(void 0);
    const revision = snapshot.revision;
    (0, import_react.useEffect)(() => {
      setDraft(void 0);
    }, [revision]);
    (0, import_react.useEffect)(() => {
      let alive = true;
      setCatalog({ status: "loading", groups: [] });
      loadCatalog().then((result) => {
        if (!alive) return;
        if (result.ok) setCatalog({ status: "ready", groups: result.value.groups });
        else setCatalog({ status: "error", groups: [] });
      }).catch(() => {
        if (alive) setCatalog({ status: "error", groups: [] });
      });
      return () => {
        alive = false;
      };
    }, [loadCatalog]);
    const selected = (0, import_react.useMemo)(() => draft ?? configured, [draft, configured]);
    const selectedSet = (0, import_react.useMemo)(() => new Set(selected), [selected]);
    const groups = (0, import_react.useMemo)(() => mergedGroups(catalog.groups, configured), [catalog.groups, configured]);
    const dirty = selected.length !== configured.length || selected.some((model) => !configured.includes(model));
    if (view === "summary") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("targetsSummary", { count: String(configured.length) }) });
    }
    const toggle = (model) => {
      const next = selectedSet.has(model) ? selected.filter((item) => item !== model) : [...selected, model];
      setDraft(next);
      setError(void 0);
    };
    const save = async () => {
      if (saving || !dirty) return;
      setSaving(true);
      setError(void 0);
      try {
        await windForm.mutate([{ op: "set", path: ["targetModels"], value: selected }], revision);
        setDraft(void 0);
      } catch (failure) {
        setError(String(failure));
      } finally {
        setSaving(false);
      }
    };
    const readonly = snapshot.writable === false;
    const statusText = catalog.status === "loading" ? t("targetsCatalogLoading") : catalog.status === "error" ? t("targetsCatalogError") : t("targetsCatalogHint", { count: String(selected.length) });
    const row = { display: "flex", alignItems: "center", gap: 8, padding: "4px 0" };
    const section = { display: "grid", gap: 4, marginTop: 6 };
    const provider = { fontSize: 12, opacity: 0.7, marginTop: 10 };
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gap: 10, maxWidth: 560 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 14, fontWeight: 600 }, children: t("targetsTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 2 }, children: t("targetsDescription") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.8 }, children: statusText }),
      groups.length === 0 && catalog.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.7 }, children: t("targetsEmpty") }) : null,
      groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: section, children: [
        group.name !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: provider, children: group.name }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: provider, children: t("targetsStale") }),
        group.models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { ...row, cursor: readonly ? "default" : "pointer" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: selectedSet.has(model.id),
              disabled: readonly || saving,
              onChange: () => toggle(model.id)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 13 }, children: model.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, opacity: 0.5 }, children: model.id })
        ] }, group.id + ":" + model.id))
      ] }, group.id || "__stale")),
      error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-danger, #c0392b)" }, children: error }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: readonly || saving || !dirty, onClick: () => {
          void save();
        }, children: saving ? t("targetsSaving") : t("targetsSave") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: saving || draft === void 0, onClick: () => {
          setDraft(void 0);
          setError(void 0);
        }, children: t("targetsDiscard") })
      ] }),
      readonly ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.7 }, children: t("targetsReadonly") }) : null
    ] });
  }
  function registerWindTargetsPage(forms, slots, remote, translate) {
    let pageOff;
    let watched;
    const loadCatalog = () => {
      const session = remote.session;
      if (session === void 0) return Promise.resolve({ ok: false, error: "model catalogue unavailable" });
      return session.modelCatalog();
    };
    const sync = () => {
      const entries = forms.describe().getSnapshot().view?.namespaces;
      const namespace = findWindNamespace(forms);
      if (namespace === watched) return;
      pageOff?.();
      pageOff = void 0;
      watched = namespace;
      if (namespace === void 0) return;
      const form = forms.get(namespace);
      pageOff = forms.whileServed([namespace], () => slots.inject("plugins.item", () => slots.register({
        name: "plugins.item",
        id: "wind-targets",
        order: 60,
        label: () => translate("targetsItemTitle"),
        locale: "wind",
        inject: () => ({ windForm: form, loadCatalog })
      }, WindTargetsPage)));
    };
    const describe = forms.describe();
    const unsubscribe = describe.subscribe(sync);
    void describe.ensure();
    sync();
    return () => {
      unsubscribe();
      pageOff?.();
    };
  }

  // client/index.tsx
  var import_jsx_runtime2 = __require("react/jsx-runtime");
  var name = "dsh-wind-client";
  var inject = ["slots", "locale", "configForms", "remote", "remote.session"];
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
    ctx.effect(() => {
      if (typeof ctx.get !== "function" || ctx.slots === void 0) return void 0;
      const forms = ctx.get("configForms");
      const remote = ctx.get("remote");
      if (forms === void 0 || remote === void 0) return void 0;
      const translate = ctx.locale?.bind !== void 0 ? ctx.locale.bind("wind") : dictT(resolveLang());
      return registerWindTargetsPage(forms, ctx.slots, remote, translate);
    }, "dsh-wind: target-model configuration page");
  }
  function useWindStatus() {
    const [status, setStatus] = (0, import_react2.useState)(void 0);
    (0, import_react2.useEffect)(() => {
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
    const [enabled, setEnabled] = (0, import_react2.useState)(null);
    (0, import_react2.useEffect)(() => {
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
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          role: "status",
          title: tt("statusTitle") + " \u2014 " + primary,
          "aria-label": tt("statusTitle") + " \u2014 " + primary,
          style: { display: "flex", alignItems: "center", justifyContent: "center", height: 28, cursor: "default" },
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "status", style: { paddingTop: 2, paddingBottom: 2, maxWidth: 240 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: title, children: tt("statusTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: detail, children: primary }),
      secondary ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: detail, children: secondary }) : null,
      latest ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, cursor: "pointer" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            type: "checkbox",
            checked: enabled ?? status?.latest?.enabled ?? true,
            onChange: handleToggle,
            style: { accentColor: "currentColor", width: 13, height: 13 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 12, opacity: 0.85, whiteSpace: "nowrap" }, children: tt("windToggle") })
      ] }) : null
    ] });
  }
  return __toCommonJS(client_exports);
})();

		return windClientBundle;
	}
});
