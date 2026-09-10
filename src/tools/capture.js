// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerCaptureTools(
  server,
  {
    INTERACTIVE_AX_ROLES,
    assertAllowedReadPath,
    assertAllowedWritePath,
    assertPayloadWithinLimit,
    clampNumber,
    clearElementCache,
    ensureDir,
    ensurePage,
    fs,
    getActiveCaptureProfile,
    getCachedElement,
    getDomContext,
    getFrameScope,
    listCaptureProfiles,
    normalizeCaptureDetail,
    normalizeCaptureProfile,
    resolveCaptureDefaults,
    resolveFrame,
    resolveRootScopeSelector,
    respond,
    setElementCacheContext,
    setUidMapForFrame,
    state,
    takeA11ySnapshot,
    withFrameMeta,
    z,
  },
) {
  server.registerTool(
    "browser.set_capture_profile",
    {
      description:
        "Set default capture profile used by snapshot/list/query tools in this session.",
      inputSchema: {
        profile: z.enum(["light", "balanced", "full"]),
        responseBudgetBytes: z.number().optional(),
      },
    },
    async ({ profile, responseBudgetBytes }) => {
      state.captureProfile = normalizeCaptureProfile(profile);
      if (typeof responseBudgetBytes === "number") {
        state.responseBudgetBytes = clampNumber(
          responseBudgetBytes,
          32768,
          2_000_000,
          state.responseBudgetBytes,
        );
      }

      return respond({
        status: "capture-profile-set",
        profile: state.captureProfile,
        availableProfiles: listCaptureProfiles(),
        responseBudgetBytes: state.responseBudgetBytes,
        defaults: {
          snapshot: resolveCaptureDefaults("snapshot", "low"),
          list: resolveCaptureDefaults("list", "low"),
          queryDom: resolveCaptureDefaults("query_dom", "low"),
          takeSnapshot: resolveCaptureDefaults("take_snapshot", "low"),
          visualSnapshot: resolveCaptureDefaults("visual_snapshot", "low"),
        },
      });
    },
  );

  server.registerTool(
    "browser.get_capture_profile",
    {
      description:
        "Get the active capture profile and response payload budget.",
      inputSchema: {},
    },
    async () => {
      const profile = getActiveCaptureProfile();
      return respond({
        profile,
        availableProfiles: listCaptureProfiles(),
        responseBudgetBytes: state.responseBudgetBytes,
        defaults: {
          snapshot: {
            low: resolveCaptureDefaults("snapshot", "low"),
            high: resolveCaptureDefaults("snapshot", "high"),
          },
          list: {
            low: resolveCaptureDefaults("list", "low"),
            high: resolveCaptureDefaults("list", "high"),
          },
          queryDom: {
            low: resolveCaptureDefaults("query_dom", "low"),
            high: resolveCaptureDefaults("query_dom", "high"),
          },
          takeSnapshot: {
            low: resolveCaptureDefaults("take_snapshot", "low"),
            high: resolveCaptureDefaults("take_snapshot", "high"),
          },
          visualSnapshot: {
            low: resolveCaptureDefaults("visual_snapshot", "low"),
            high: resolveCaptureDefaults("visual_snapshot", "high"),
          },
        },
      });
    },
  );

  server.registerTool(
    "browser.query_dom",
    {
      description:
        "Safely query DOM nodes and return structured attributes/states without arbitrary JS execution.",
      inputSchema: {
        selector: z.string(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        rootSelector: z.string().optional(),
        rootElementId: z.number().optional(),
        detail: z.enum(["low", "high"]).optional(),
        timeoutMs: z.number().optional(),
        limit: z.number().optional(),
        attrs: z.array(z.string()).optional(),
        includeText: z.boolean().optional(),
        includeValue: z.boolean().optional(),
        includeBBox: z.boolean().optional(),
        includeVisibility: z.boolean().optional(),
        includeState: z.boolean().optional(),
        includeTagName: z.boolean().optional(),
        pierceShadow: z.boolean().optional(),
        maxChars: z.number().optional(),
        maxPayloadBytes: z.number().optional(),
      },
    },
    async ({
      selector,
      frameId,
      frameSelector,
      rootSelector,
      rootElementId,
      detail,
      timeoutMs,
      limit,
      attrs,
      includeText,
      includeValue,
      includeBBox,
      includeVisibility,
      includeState,
      includeTagName,
      pierceShadow,
      maxChars,
      maxPayloadBytes,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const resolvedDetail = normalizeCaptureDetail(detail);
      const profileDefaults = resolveCaptureDefaults(
        "query_dom",
        resolvedDetail,
      );
      const resolvedRootSelector = resolveRootScopeSelector(page, frame, {
        rootSelector,
        rootElementId,
      });
      const resolvedLimit = clampNumber(
        limit ?? profileDefaults.limit,
        1,
        500,
        50,
      );
      const resolvedMaxChars = clampNumber(
        maxChars ?? profileDefaults.maxChars,
        20,
        20000,
        1200,
      );
      const resolvedMaxPayloadBytes = clampNumber(
        maxPayloadBytes ?? profileDefaults.maxPayloadBytes,
        2048,
        2_000_000,
        250_000,
      );
      const resolvedAttrs = Array.isArray(attrs)
        ? attrs
            .slice(0, 25)
            .map((v) => String(v || "").trim())
            .filter(Boolean)
        : [];
      const resolvedIncludeText =
        includeText ?? profileDefaults.includeText ?? false;
      const resolvedIncludeValue =
        includeValue ?? profileDefaults.includeValue ?? false;
      const resolvedIncludeBBox =
        includeBBox ?? profileDefaults.includeBBox ?? false;
      const resolvedIncludeVisibility =
        includeVisibility ?? profileDefaults.includeVisibility ?? true;
      const resolvedIncludeState =
        includeState ?? profileDefaults.includeState ?? false;
      const resolvedIncludeTagName =
        includeTagName ?? profileDefaults.includeTagName ?? true;

      const queryResult = await scope.evaluate(
        ({
          selector,
          rootSelector,
          limit,
          attrs,
          includeText,
          includeValue,
          includeBBox,
          includeVisibility,
          includeState,
          includeTagName,
          pierceShadow,
          maxChars,
        }) => {
          const clean = (value) =>
            String(value || "")
              .replace(/\s+/g, " ")
              .trim();
          const trunc = (value) => {
            const text = clean(value);
            if (maxChars <= 0 || text.length <= maxChars) return text;
            if (maxChars <= 3) return text.slice(0, maxChars);
            return `${text.slice(0, maxChars - 3)}...`;
          };
          const isVisible = (el) => {
            try {
              const rect = el.getBoundingClientRect();
              if (!rect || rect.width <= 0 || rect.height <= 0) return false;
              const style = window.getComputedStyle(el);
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                Number(style.opacity || 1) > 0
              );
            } catch {
              return false;
            }
          };
          const getNodes = () => {
            const root = rootSelector
              ? document.querySelector(rootSelector)
              : document;
            if (!root) {
              return {
                nodes: [],
                totalMatches: 0,
                rootFound: false,
              };
            }

            if (!pierceShadow) {
              const all = Array.from(root.querySelectorAll(selector));
              return {
                nodes: all.slice(0, limit),
                totalMatches: all.length,
                rootFound: true,
              };
            }
            const out = [];
            let totalMatches = 0;
            const walk = (root) => {
              if (!root) return;
              const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
              );
              let current = walker.currentNode;
              while (current) {
                let matched = false;
                try {
                  matched = Boolean(
                    current.matches && current.matches(selector),
                  );
                  if (matched) {
                    totalMatches += 1;
                    if (out.length < limit) out.push(current);
                  }
                } catch {
                  // ignore selector-match errors
                }
                if (current.shadowRoot) walk(current.shadowRoot);
                current = walker.nextNode();
              }
            };
            walk(root);
            return {
              nodes: out.slice(0, limit),
              totalMatches,
              rootFound: true,
            };
          };

          const { nodes, totalMatches, rootFound } = getNodes();
          const items = nodes.map((node) => {
            const item = {};
            if (includeTagName)
              item.tagName = String(node.tagName || "").toLowerCase();
            if (includeText)
              item.text = trunc(node.innerText || node.textContent || "");
            if (includeValue) {
              const hasValue = typeof node.value !== "undefined";
              item.value = hasValue ? trunc(node.value) : null;
            }
            if (attrs.length) {
              const attrOut = {};
              for (const key of attrs) {
                attrOut[key] = node.getAttribute
                  ? node.getAttribute(key)
                  : null;
              }
              item.attrs = attrOut;
            }
            if (includeBBox) {
              try {
                const r = node.getBoundingClientRect();
                item.bbox = {
                  x: Math.round((window.scrollX || 0) + r.x),
                  y: Math.round((window.scrollY || 0) + r.y),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                };
              } catch {
                item.bbox = null;
              }
            }
            if (includeVisibility) {
              item.visible = isVisible(node);
            }
            if (includeState) {
              item.enabled = !Boolean(node.disabled);
              item.checked = Boolean(node.checked);
              item.selected = Boolean(node.selected);
            }
            return item;
          });
          return {
            totalMatches,
            nodes: items,
            rootFound,
          };
        },
        {
          selector,
          rootSelector: resolvedRootSelector,
          limit: resolvedLimit,
          attrs: resolvedAttrs,
          includeText: resolvedIncludeText,
          includeValue: resolvedIncludeValue,
          includeBBox: resolvedIncludeBBox,
          includeVisibility: resolvedIncludeVisibility,
          includeState: resolvedIncludeState,
          includeTagName: resolvedIncludeTagName,
          pierceShadow: pierceShadow ?? false,
          maxChars: resolvedMaxChars,
        },
      );

      if (resolvedRootSelector && queryResult.rootFound === false) {
        throw new Error(
          `Root selector not found for query_dom: ${resolvedRootSelector}`,
        );
      }

      const payload = {
        selector,
        rootSelector: resolvedRootSelector,
        detail: resolvedDetail,
        profile: getActiveCaptureProfile(),
        totalMatches: queryResult.totalMatches,
        returned: queryResult.nodes.length,
        limit: resolvedLimit,
        nodes: queryResult.nodes,
      };
      const payloadBytes = assertPayloadWithinLimit(
        payload,
        resolvedMaxPayloadBytes,
      );
      payload.payloadBytes = payloadBytes;
      payload.maxPayloadBytes = resolvedMaxPayloadBytes;

      return respond(withFrameMeta(page, frame, payload));
    },
  );

  server.registerTool(
    "browser.take_snapshot",
    {
      description:
        "DevTools-style snapshot based on the accessibility tree. Returns compact nodes with uids.",
      inputSchema: {
        detail: z.enum(["low", "high"]).optional(),
        interestingOnly: z.boolean().optional(),
        interactiveOnly: z.boolean().optional(),
        visibleOnly: z.boolean().optional(),
        maxDepth: z.number().optional(),
        maxNodes: z.number().optional(),
        maxNameChars: z.number().optional(),
        query: z.string().optional(),
        includeUrlTitle: z.boolean().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      detail,
      interestingOnly,
      interactiveOnly,
      visibleOnly,
      maxDepth,
      maxNodes,
      maxNameChars,
      query,
      includeUrlTitle,
      frameId,
      frameSelector,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const mainFrame = page.mainFrame();
      if (frame !== mainFrame) {
        throw new Error(
          "browser.take_snapshot currently supports main-frame AX snapshots only. Omit frameId/frameSelector.",
        );
      }
      const resolvedDetail = normalizeCaptureDetail(detail);
      const profileDefaults = resolveCaptureDefaults(
        "take_snapshot",
        resolvedDetail,
      );
      const resolvedInterestingOnly =
        interestingOnly ?? profileDefaults.interestingOnly ?? true;
      const resolvedInteractiveOnly =
        interactiveOnly ?? profileDefaults.interactiveOnly ?? false;
      const resolvedVisibleOnly =
        visibleOnly ?? profileDefaults.visibleOnly ?? false;
      const resolvedMaxDepth = clampNumber(
        maxDepth ?? profileDefaults.maxDepth,
        1,
        64,
        24,
      );
      const resolvedMaxNodes = clampNumber(
        maxNodes ?? profileDefaults.maxNodes,
        1,
        2000,
        400,
      );
      const resolvedMaxNameChars = clampNumber(
        maxNameChars ?? profileDefaults.maxNameChars,
        20,
        500,
        120,
      );
      const {
        nodes,
        uidToBackend,
        truncated: sourceTruncated,
      } = await takeA11ySnapshot(page, {
        interestingOnly: resolvedInterestingOnly,
        maxNodes: resolvedMaxNodes,
        maxNameChars: resolvedMaxNameChars,
        query: query || null,
        maxDepth: resolvedMaxDepth,
      });

      // AX snapshot is currently page-wide; keep UID map scoped to main frame context only.
      setUidMapForFrame(page, mainFrame, uidToBackend);

      let filteredNodes = nodes;
      if (resolvedInteractiveOnly) {
        filteredNodes = filteredNodes.filter((node) =>
          INTERACTIVE_AX_ROLES.has(String(node.role || "").toLowerCase()),
        );
      }
      if (resolvedVisibleOnly) {
        filteredNodes = filteredNodes.filter((node) => node.hidden !== true);
      }

      const payload = {
        detail: resolvedDetail,
        profile: getActiveCaptureProfile(),
        interestingOnly: resolvedInterestingOnly,
        interactiveOnly: resolvedInteractiveOnly,
        visibleOnly: resolvedVisibleOnly,
        maxDepth: resolvedMaxDepth,
        count: filteredNodes.length,
        nodes: filteredNodes,
        truncated: Boolean(sourceTruncated),
        uidMapFrameId: getDomContext(page, mainFrame).frameId,
      };
      if (resolvedVisibleOnly) {
        payload.visibilityNote =
          "visibleOnly filters nodes with AX hidden=true; some offscreen/inert nodes may still appear.";
      }

      if (includeUrlTitle ?? true) {
        payload.url = page.url();
        payload.title = await page.title();
      }

      return respond(withFrameMeta(page, mainFrame, payload));
    },
  );

  server.registerTool(
    "browser.snapshot",
    {
      description:
        "Return a snapshot of the current page (title, url, text, links).",
      inputSchema: {
        detail: z.enum(["low", "high"]).optional(),
        maxChars: z.number().optional(),
        maxLinks: z.number().optional(),
        includeHeadings: z.boolean().optional(),
        includeFormsSummary: z.boolean().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      detail,
      maxChars,
      maxLinks,
      includeHeadings,
      includeFormsSummary,
      frameId,
      frameSelector,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const resolvedDetail = normalizeCaptureDetail(detail);
      const profileDefaults = resolveCaptureDefaults(
        "snapshot",
        resolvedDetail,
      );
      const resolvedMaxChars = clampNumber(
        maxChars ?? profileDefaults.maxChars,
        0,
        20000,
        8000,
      );
      const resolvedMaxLinks = clampNumber(
        maxLinks ?? profileDefaults.maxLinks,
        0,
        100,
        50,
      );
      const resolvedIncludeHeadings =
        includeHeadings ?? profileDefaults.includeHeadings ?? false;
      const resolvedIncludeFormsSummary =
        includeFormsSummary ?? profileDefaults.includeFormsSummary ?? false;
      const snapshot = await scope.evaluate(
        ({ maxChars, maxLinks, includeHeadings, includeFormsSummary }) => {
          const clean = (value) =>
            String(value || "")
              .replace(/\s+/g, " ")
              .trim();
          const title = document.title || "";
          const textRaw = document.body ? document.body.innerText : "";
          const text = clean(textRaw);
          const textTruncated = text.length > maxChars;
          const links = Array.from(document.querySelectorAll("a[href]"))
            .slice(0, maxLinks)
            .map((link) => ({
              text: clean(
                link.innerText || link.getAttribute("aria-label") || "",
              ),
              href: link.href,
            }));
          const totalLinks = document.querySelectorAll("a[href]").length;
          const linksTruncated = totalLinks > maxLinks;

          let headings = null;
          if (includeHeadings) {
            headings = Array.from(document.querySelectorAll("h1, h2, h3"))
              .slice(0, 20)
              .map((el) => clean(el.innerText || el.textContent))
              .filter(Boolean);
          }

          let formsSummary = null;
          if (includeFormsSummary) {
            const forms = Array.from(document.querySelectorAll("form"));
            const hasFormLikeInputs =
              document.querySelectorAll("input, textarea, select").length > 0;
            formsSummary = {
              forms: forms.length,
              hasFormLikeInputs,
              requiredFields: Array.from(
                document.querySelectorAll(
                  "input[required], textarea[required], select[required]",
                ),
              ).length,
            };
          }

          return {
            title,
            text: text.slice(0, maxChars),
            links,
            textTruncated,
            linksTruncated,
            totalLinks,
            headings,
            formsSummary,
          };
        },
        {
          maxChars: resolvedMaxChars,
          maxLinks: resolvedMaxLinks,
          includeHeadings: resolvedIncludeHeadings,
          includeFormsSummary: resolvedIncludeFormsSummary,
        },
      );

      return respond(
        withFrameMeta(page, frame, {
          detail: resolvedDetail,
          profile: getActiveCaptureProfile(),
          title:
            snapshot.title ||
            (frame === page.mainFrame() ? await page.title() : null),
          url: frame.url(),
          text: snapshot.text,
          links: snapshot.links,
          textTruncated: snapshot.textTruncated,
          linksTruncated: snapshot.linksTruncated,
          totalLinks: snapshot.totalLinks,
          truncated: Boolean(snapshot.textTruncated || snapshot.linksTruncated),
          ...(resolvedIncludeHeadings
            ? { headings: snapshot.headings || [] }
            : {}),
          ...(resolvedIncludeFormsSummary
            ? { formsSummary: snapshot.formsSummary || null }
            : {}),
        }),
      );
    },
  );

  server.registerTool(
    "browser.list",
    {
      description:
        "List visible interactive elements (links, buttons, inputs). Includes role=radio/checkbox.",
      inputSchema: {
        detail: z.enum(["low", "high"]).optional(),
        limit: z.number().optional(),
        maxItems: z.number().optional(),
        maxTextChars: z.number().optional(),
        visibleOnly: z.boolean().optional(),
        interactiveOnly: z.boolean().optional(),
        viewportOnly: z.boolean().optional(),
        includeSelectors: z.boolean().optional(),
        rootSelector: z.string().optional(),
        rootElementId: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      detail,
      limit,
      maxItems,
      maxTextChars,
      visibleOnly,
      interactiveOnly,
      viewportOnly,
      includeSelectors,
      rootSelector,
      rootElementId,
      frameId,
      frameSelector,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const resolvedDetail = normalizeCaptureDetail(detail);
      const profileDefaults = resolveCaptureDefaults("list", resolvedDetail);
      const resolvedLimit = clampNumber(
        maxItems ?? limit ?? profileDefaults.maxItems,
        1,
        500,
        200,
      );
      const resolvedMaxTextChars = clampNumber(
        maxTextChars ?? profileDefaults.maxTextChars,
        20,
        500,
        160,
      );
      const resolvedIncludeSelectors =
        includeSelectors ?? profileDefaults.includeSelectors ?? false;
      const resolvedVisibleOnly =
        visibleOnly ?? profileDefaults.visibleOnly ?? true;
      const resolvedInteractiveOnly =
        interactiveOnly ?? profileDefaults.interactiveOnly ?? true;
      const resolvedViewportOnly =
        viewportOnly ?? profileDefaults.viewportOnly ?? false;
      const resolvedRootSelector = resolveRootScopeSelector(page, frame, {
        rootSelector,
        rootElementId,
      });
      const interactiveSelector =
        'a[href], button, input, select, textarea, label[for], label[data-test-text-selectable-option__label], [role="button"], [role="link"], [onclick], [role="radio"], [role="checkbox"]';
      const baseSelector = resolvedInteractiveOnly ? interactiveSelector : "*";

      clearElementCache();
      const contextKey = setElementCacheContext(page, frame);
      let elements = [];
      if (resolvedRootSelector) {
        const root = scope.locator(resolvedRootSelector).first();
        if ((await root.count()) === 0) {
          throw new Error(
            `Root selector not found for list: ${resolvedRootSelector}`,
          );
        }
        elements = await root.locator(baseSelector).elementHandles();
      } else {
        elements = await scope.$$(baseSelector);
      }

      const viewport = await scope.evaluate(() => ({
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
      }));
      const items = [];
      let id = 1;
      const totalCandidates = elements.length;
      let visibleCandidates = 0;
      let viewportFilteredOut = 0;
      let acceptedCandidates = 0;

      for (const handle of elements) {
        const info = await handle.evaluate((node, maxTextChars) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden";

          const clean = (s) =>
            String(s || "")
              .replace(/\s+/g, " ")
              .trim();
          const trunc = (s) => {
            const t = clean(s);
            return t.length > maxTextChars && maxTextChars > 0
              ? t.slice(0, Math.max(0, maxTextChars - 3)) + "..."
              : t;
          };

          const escapeCss = (value) => {
            if (window.CSS && CSS.escape) return CSS.escape(value);
            return String(value || "").replace(
              /([ #;?%&,.+*~':"!^$\\[\\]()=>|\/@])/g,
              "\\\\$1",
            );
          };

          const makeSelector = (el) => {
            if (!el || el.nodeType !== 1) return "";
            if (el.id) return `#${escapeCss(el.id)}`;
            const testId = el.getAttribute("data-testid");
            if (testId) return `[data-testid="${escapeCss(testId)}"]`;
            const aria = el.getAttribute("aria-label");
            if (aria && aria.length <= 120)
              return `${el.tagName.toLowerCase()}[aria-label="${escapeCss(aria)}"]`;
            const name = el.getAttribute("name");
            if (name && name.length <= 120)
              return `${el.tagName.toLowerCase()}[name="${escapeCss(name)}"]`;
            const role = el.getAttribute("role");
            if (role)
              return `${el.tagName.toLowerCase()}[role="${escapeCss(role)}"]`;

            const parts = [];
            let cur = el;
            while (
              cur &&
              cur.nodeType === 1 &&
              cur !== document.body &&
              cur !== document.documentElement
            ) {
              let part = cur.tagName.toLowerCase();
              const parent = cur.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(
                  (n) => n.tagName === cur.tagName,
                );
                if (siblings.length > 1) {
                  const index = siblings.indexOf(cur) + 1;
                  part += `:nth-of-type(${index})`;
                }
              }
              parts.unshift(part);
              cur = cur.parentElement;
              if (parts.length >= 6) break;
            }
            return parts.join(" > ");
          };

          const ariaLabelRaw = node.getAttribute("aria-label") || "";
          const titleRaw = node.getAttribute("title") || "";
          const roleRaw = node.getAttribute("role") || "";
          const hrefRaw = node.getAttribute("href") || "";
          const ariaCheckedRaw = node.getAttribute("aria-checked") || "";
          const tag = node.tagName.toLowerCase();
          const type = tag === "input" ? node.getAttribute("type") || "" : "";
          const rawValue =
            tag === "input" || tag === "textarea"
              ? String(node.value || "")
              : node.getAttribute("value") || "";

          const rawText =
            ariaLabelRaw || node.innerText || titleRaw || rawValue;
          const selector = makeSelector(node);

          return {
            visible,
            selector,
            tag,
            role: clean(roleRaw),
            type,
            text: trunc(rawText),
            href: trunc(hrefRaw),
            ariaLabel: trunc(ariaLabelRaw),
            ariaChecked: clean(ariaCheckedRaw),
            value: trunc(rawValue),
            valueLength: rawValue.length,
            viewportBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        }, resolvedMaxTextChars);

        if (info.visible) visibleCandidates += 1;
        if (resolvedVisibleOnly && !info.visible) continue;
        if (resolvedViewportOnly) {
          const box = info.viewportBox;
          const intersectsViewport =
            box &&
            box.width > 0 &&
            box.height > 0 &&
            box.x < viewport.width &&
            box.y < viewport.height &&
            box.x + box.width > 0 &&
            box.y + box.height > 0;
          if (!intersectsViewport) {
            viewportFilteredOut += 1;
            continue;
          }
        }

        acceptedCandidates += 1;
        const canCollect = !resolvedLimit || items.length < resolvedLimit;
        if (!canCollect) {
          // Continue scanning to compute accurate coverage counters.
          continue;
        }

        state.elements.set(id, {
          contextKey,
          selector: info.selector || null,
          tag: info.tag,
          type: info.type,
          role: info.role,
          text: info.text,
          href: info.href,
          ariaLabel: info.ariaLabel,
        });
        const outputInfo = { ...info };
        if (!resolvedIncludeSelectors) delete outputInfo.selector;
        delete outputInfo.viewportBox;
        if (resolvedDetail === "low") {
          delete outputInfo.href;
          delete outputInfo.value;
          delete outputInfo.valueLength;
        }
        items.push({ id, ...outputInfo });
        id += 1;
      }

      const scrollMetrics = await scope.evaluate((rootSelector) => {
        const readMetrics = (el) => {
          const scrollTop = el?.scrollTop || 0;
          const scrollHeight = el?.scrollHeight || 0;
          const clientHeight = el?.clientHeight || 0;
          return {
            scrollTop,
            scrollHeight,
            clientHeight,
            atBottom: scrollTop + clientHeight >= scrollHeight - 2,
          };
        };

        const docEl = document.scrollingElement || document.documentElement;
        const documentMetrics = readMetrics(docEl);
        const isScrollableContainer = (el) => {
          if (!el || el === docEl) return false;
          const style = window.getComputedStyle(el);
          const overflowY = String(style.overflowY || "");
          const overflow = /(auto|scroll|overlay)/i.test(overflowY);
          return (
            overflow &&
            el.scrollHeight > el.clientHeight + 2 &&
            el.clientHeight > 0
          );
        };

        let container = null;
        if (rootSelector) {
          const root = document.querySelector(rootSelector);
          if (isScrollableContainer(root)) {
            const metrics = readMetrics(root);
            container = {
              kind: "root",
              ...metrics,
            };
          }
        }

        if (!container) {
          let bestEl = null;
          let bestRange = 0;
          const all = document.querySelectorAll("body *");
          const cap = Math.min(all.length, 500);
          for (let i = 0; i < cap; i += 1) {
            const el = all[i];
            if (!isScrollableContainer(el)) continue;
            const range = (el.scrollHeight || 0) - (el.clientHeight || 0);
            if (range > bestRange) {
              bestRange = range;
              bestEl = el;
            }
          }
          if (bestEl) {
            container = {
              kind: "auto",
              ...readMetrics(bestEl),
            };
          }
        }

        return {
          // Backward-compatible top-level fields (document scroll).
          scrollTop: documentMetrics.scrollTop,
          scrollHeight: documentMetrics.scrollHeight,
          clientHeight: documentMetrics.clientHeight,
          atBottom: documentMetrics.atBottom,
          // Extended metrics.
          document: documentMetrics,
          container,
          primaryScrollTarget:
            container && !container.atBottom ? "container" : "document",
        };
      }, resolvedRootSelector || null);

      const hasOffViewportCandidates =
        resolvedViewportOnly && viewportFilteredOut > 0;
      const containerNeedsScroll = Boolean(
        scrollMetrics.container && !scrollMetrics.container.atBottom,
      );
      const needsScrollForMore =
        hasOffViewportCandidates &&
        (!scrollMetrics.atBottom || containerNeedsScroll);

      return respond(
        withFrameMeta(page, frame, {
          detail: resolvedDetail,
          profile: getActiveCaptureProfile(),
          rootSelector: resolvedRootSelector,
          visibleOnly: resolvedVisibleOnly,
          interactiveOnly: resolvedInteractiveOnly,
          viewportOnly: resolvedViewportOnly,
          limit: resolvedLimit,
          count: items.length,
          totalCandidates,
          visibleCandidates,
          acceptedCandidates,
          viewportFilteredOut,
          hasOffViewportCandidates,
          needsScrollForMore,
          scrollState: scrollMetrics,
          truncated: Boolean(
            resolvedLimit && acceptedCandidates > items.length,
          ),
          coverageHint: needsScrollForMore
            ? containerNeedsScroll
              ? "Additional off-viewport candidates exist in a scrollable container. Scroll container and run browser.list again."
              : "Additional off-viewport candidates exist. Scroll and run browser.list again."
            : null,
          items,
        }),
      );
    },
  );

  server.registerTool(
    "browser.set_input_files",
    {
      description:
        'Set files on an <input type="file"> by selector or cached elementId.',
      inputSchema: {
        paths: z.union([z.string(), z.array(z.string())]),
        selector: z.string().optional(),
        elementId: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      paths,
      selector,
      elementId,
      frameId,
      frameSelector,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const filePaths = Array.isArray(paths) ? paths : [paths];
      const resolvedPaths = [];
      for (const filePath of filePaths) {
        resolvedPaths.push(await assertAllowedReadPath(filePath));
      }

      if (elementId) {
        const cached = getCachedElement(page, frame, elementId);
        if (!cached.selector)
          throw new Error(
            `Cached element ${elementId} has no selector. Run browser.list again.`,
          );
        const locator = scope.locator(cached.selector).first();
        if ((await locator.count()) === 0)
          throw new Error(
            `No element found for cached selector (elementId ${elementId}). Run browser.list again.`,
          );
        await locator.setInputFiles(resolvedPaths);
      } else if (selector) {
        await scope.setInputFiles(selector, resolvedPaths);
      } else {
        throw new Error("Provide selector or elementId.");
      }

      return respond(
        withFrameMeta(page, frame, {
          status: "files-set",
          count: resolvedPaths.length,
        }),
      );
    },
  );

  server.registerTool(
    "browser.extract_text",
    {
      description:
        "Extract text from a selector. Use all=true to get all matches.",
      inputSchema: {
        selector: z.string(),
        all: z.boolean().optional(),
        maxChars: z.number().optional(),
        limit: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      selector,
      all,
      maxChars,
      limit,
      frameId,
      frameSelector,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const maxCharsPerItem = clampNumber(maxChars, 0, 5000, 2000);
      const maxItems = clampNumber(limit, 1, 200, 50);
      if (all) {
        const result = await scope.$$eval(
          selector,
          (nodes, maxItems) => {
            const total = nodes.length;
            const texts = nodes
              .slice(0, maxItems)
              .map((node) =>
                (node.textContent || "").replace(/\s+/g, " ").trim(),
              )
              .filter(Boolean);
            return { total, texts };
          },
          maxItems,
        );

        const truncated =
          maxCharsPerItem > 0
            ? result.texts.map((t) =>
                t.length > maxCharsPerItem ? t.slice(0, maxCharsPerItem) : t,
              )
            : result.texts;

        return respond(
          withFrameMeta(page, frame, {
            selector,
            totalMatches: result.total,
            returned: result.texts.length,
            limit: maxItems,
            maxChars: maxCharsPerItem,
            texts: truncated,
          }),
        );
      }

      const text = await scope.$eval(selector, (node) =>
        (node.textContent || "").replace(/\s+/g, " ").trim(),
      );
      const sliced =
        maxCharsPerItem > 0 && text.length > maxCharsPerItem
          ? text.slice(0, maxCharsPerItem)
          : text;
      return respond(
        withFrameMeta(page, frame, {
          selector,
          maxChars: maxCharsPerItem,
          text: sliced,
        }),
      );
    },
  );

  server.registerTool(
    "browser.extract_html",
    {
      description: "Extract outerHTML from a selector.",
      inputSchema: {
        selector: z.string(),
        maxChars: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ selector, maxChars, frameId, frameSelector, timeoutMs }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const html = await scope.$eval(selector, (node) => node.outerHTML || "");
      const limit = clampNumber(maxChars, 0, 20000, 5000);
      const truncated = limit > 0 && html.length > limit;
      const sliced = limit === 0 ? "" : truncated ? html.slice(0, limit) : html;
      return respond(
        withFrameMeta(page, frame, {
          selector,
          length: html.length,
          truncated,
          html: sliced,
        }),
      );
    },
  );

  server.registerTool(
    "browser.screenshot",
    {
      description: "Save a screenshot to a path.",
      inputSchema: {
        path: z.string(),
        fullPage: z.boolean().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ path: targetPath, fullPage, timeoutMs }) => {
      const page = ensurePage();
      const absPath = await assertAllowedWritePath(targetPath);
      await ensureDir(absPath);
      const resolvedFullPage = fullPage ?? true;
      const resolvedTimeout = clampNumber(
        timeoutMs,
        1000,
        300000,
        resolvedFullPage ? 90000 : 30000,
      );
      await page.screenshot({
        path: absPath,
        fullPage: resolvedFullPage,
        timeout: resolvedTimeout,
      });
      return respond({ status: "saved", path: absPath });
    },
  );

  server.registerTool(
    "browser.visual_snapshot",
    {
      description:
        "Take a screenshot and return an element map with bounding boxes for visual navigation.",
      inputSchema: {
        path: z.string(),
        detail: z.enum(["low", "high"]).optional(),
        fullPage: z.boolean().optional(),
        viewportOnly: z.boolean().optional(),
        visibleOnly: z.boolean().optional(),
        timeoutMs: z.number().optional(),
        limit: z.number().optional(),
        maxItems: z.number().optional(),
        interactiveOnly: z.boolean().optional(),
        maxTextChars: z.number().optional(),
        includeText: z.boolean().optional(),
        includeSelectors: z.boolean().optional(),
        rootSelector: z.string().optional(),
        rootElementId: z.number().optional(),
        saveMapPath: z.string().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
      },
    },
    async ({
      path: targetPath,
      detail,
      fullPage,
      viewportOnly,
      visibleOnly,
      timeoutMs,
      limit,
      maxItems,
      interactiveOnly,
      maxTextChars,
      includeText,
      includeSelectors,
      rootSelector,
      rootElementId,
      saveMapPath,
      frameId,
      frameSelector,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const resolvedDetail = normalizeCaptureDetail(detail);
      const profileDefaults = resolveCaptureDefaults(
        "visual_snapshot",
        resolvedDetail,
      );
      const resolvedRootSelector = resolveRootScopeSelector(page, frame, {
        rootSelector,
        rootElementId,
      });
      const absPath = await assertAllowedWritePath(targetPath);
      await ensureDir(absPath);
      const resolvedFullPage = fullPage ?? profileDefaults.fullPage ?? false;
      const resolvedViewportOnly =
        viewportOnly ?? profileDefaults.viewportOnly ?? !resolvedFullPage;
      const resolvedVisibleOnly =
        visibleOnly ?? profileDefaults.visibleOnly ?? true;
      const resolvedInteractiveOnly =
        interactiveOnly ?? profileDefaults.interactiveOnly ?? true;
      const resolvedIncludeText =
        includeText ?? profileDefaults.includeText ?? false;
      const resolvedIncludeSelectors =
        includeSelectors ?? profileDefaults.includeSelectors ?? false;
      const resolvedLimit = clampNumber(
        maxItems ?? limit ?? profileDefaults.maxItems,
        1,
        500,
        200,
      );
      const resolvedMaxTextChars = clampNumber(
        maxTextChars ?? profileDefaults.maxTextChars,
        20,
        500,
        160,
      );
      const resolvedTimeout = clampNumber(
        timeoutMs,
        1000,
        300000,
        resolvedFullPage ? 90000 : 30000,
      );
      await page.screenshot({
        path: absPath,
        fullPage: resolvedFullPage,
        timeout: resolvedTimeout,
      });

      // Use top-level viewport metrics for spatial filtering because Playwright boundingBox()
      // returns coordinates in the page viewport coordinate space (even for iframe elements).
      const scroll = await page.evaluate(() => ({
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        innerWidth: window.innerWidth || 0,
        innerHeight: window.innerHeight || 0,
      }));
      const coordSpace = resolvedFullPage ? "page" : "viewport";

      clearElementCache();
      const contextKey = setElementCacheContext(page, frame);
      const selector =
        resolvedInteractiveOnly === false
          ? "*"
          : 'a[href], button, input, select, textarea, label[for], label[data-test-text-selectable-option__label], [role="button"], [role="link"], [onclick], [role="radio"], [role="checkbox"]';

      let handles = [];
      if (resolvedRootSelector) {
        const root = scope.locator(resolvedRootSelector).first();
        if ((await root.count()) === 0) {
          throw new Error(
            `Root selector not found for visual_snapshot: ${resolvedRootSelector}`,
          );
        }
        handles = await root.locator(selector).elementHandles();
      } else {
        handles = await scope.$$(selector);
      }
      const items = [];
      let id = 1;

      for (const handle of handles) {
        const box = await handle.boundingBox();
        if (!box || box.width < 1 || box.height < 1) continue;

        if (resolvedViewportOnly && box) {
          const isInViewport =
            box.x < scroll.innerWidth &&
            box.y < scroll.innerHeight &&
            box.x + box.width > 0 &&
            box.y + box.height > 0;
          if (!isInViewport) continue;
        }

        const info = await handle.evaluate(
          (node, maxTextChars, includeText) => {
            const clean = (s) =>
              String(s || "")
                .replace(/\s+/g, " ")
                .trim();
            const trunc = (s) => {
              const t = clean(s);
              return t.length > maxTextChars && maxTextChars > 0
                ? t.slice(0, Math.max(0, maxTextChars - 3)) + "..."
                : t;
            };

            const escapeCss = (value) => {
              if (window.CSS && CSS.escape) return CSS.escape(value);
              return String(value || "").replace(
                /([ #;?%&,.+*~':"!^$\\[\\]()=>|\/@])/g,
                "\\\\$1",
              );
            };

            const makeSelector = (el) => {
              if (!el || el.nodeType !== 1) return "";
              if (el.id) return `#${escapeCss(el.id)}`;
              const testId = el.getAttribute("data-testid");
              if (testId) return `[data-testid="${escapeCss(testId)}"]`;
              const aria = el.getAttribute("aria-label");
              if (aria && aria.length <= 120)
                return `${el.tagName.toLowerCase()}[aria-label="${escapeCss(aria)}"]`;
              const name = el.getAttribute("name");
              if (name && name.length <= 120)
                return `${el.tagName.toLowerCase()}[name="${escapeCss(name)}"]`;
              const role = el.getAttribute("role");
              if (role)
                return `${el.tagName.toLowerCase()}[role="${escapeCss(role)}"]`;

              const parts = [];
              let cur = el;
              while (
                cur &&
                cur.nodeType === 1 &&
                cur !== document.body &&
                cur !== document.documentElement
              ) {
                let part = cur.tagName.toLowerCase();
                const parent = cur.parentElement;
                if (parent) {
                  const siblings = Array.from(parent.children).filter(
                    (n) => n.tagName === cur.tagName,
                  );
                  if (siblings.length > 1) {
                    const index = siblings.indexOf(cur) + 1;
                    part += `:nth-of-type(${index})`;
                  }
                }
                parts.unshift(part);
                cur = cur.parentElement;
                if (parts.length >= 6) break;
              }
              return parts.join(" > ");
            };

            const ariaLabelRaw = node.getAttribute("aria-label") || "";
            const titleRaw = node.getAttribute("title") || "";
            const roleRaw = node.getAttribute("role") || "";
            const hrefRaw = node.getAttribute("href") || "";
            const ariaCheckedRaw = node.getAttribute("aria-checked") || "";
            const tag = node.tagName.toLowerCase();
            const type = tag === "input" ? node.getAttribute("type") || "" : "";
            const rawValue =
              tag === "input" || tag === "textarea"
                ? String(node.value || "")
                : node.getAttribute("value") || "";
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            const visible =
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity || 1) > 0;

            const rawText =
              ariaLabelRaw || node.innerText || titleRaw || rawValue;
            const selector = makeSelector(node);

            return {
              text: includeText ? trunc(rawText) : "",
              selector,
              tag,
              role: clean(roleRaw),
              type,
              href: trunc(hrefRaw),
              ariaLabel: trunc(ariaLabelRaw),
              ariaChecked: clean(ariaCheckedRaw),
              value: trunc(rawValue),
              valueLength: rawValue.length,
              visible,
            };
          },
          resolvedMaxTextChars,
          resolvedIncludeText,
        );

        if (resolvedVisibleOnly && !info.visible) continue;

        state.elements.set(id, {
          contextKey,
          selector: info.selector || null,
          tag: info.tag,
          type: info.type,
          role: info.role,
          text: info.text || info.ariaLabel || "",
          href: info.href,
          ariaLabel: info.ariaLabel,
        });
        const outputInfo = { ...info };
        if (!resolvedIncludeSelectors) delete outputInfo.selector;
        if (!resolvedIncludeText) delete outputInfo.text;
        if (!resolvedVisibleOnly) delete outputInfo.visible;
        if (resolvedDetail === "low") {
          delete outputInfo.href;
          delete outputInfo.value;
          delete outputInfo.valueLength;
        }
        items.push({
          id,
          ...outputInfo,
          bbox: {
            x: Math.round(
              coordSpace === "page"
                ? (box?.x ?? 0) + scroll.scrollX
                : (box?.x ?? 0),
            ),
            y: Math.round(
              coordSpace === "page"
                ? (box?.y ?? 0) + scroll.scrollY
                : (box?.y ?? 0),
            ),
            width: Math.round(box?.width ?? 0),
            height: Math.round(box?.height ?? 0),
          },
        });
        id += 1;

        if (resolvedLimit && items.length >= resolvedLimit) break;
      }

      const payload = {
        detail: resolvedDetail,
        profile: getActiveCaptureProfile(),
        screenshotPath: absPath,
        rootSelector: resolvedRootSelector,
        fullPage: resolvedFullPage,
        viewportOnly: resolvedViewportOnly,
        visibleOnly: resolvedVisibleOnly,
        interactiveOnly: resolvedInteractiveOnly,
        includeText: resolvedIncludeText,
        count: items.length,
        totalCandidates: handles.length,
        truncated:
          items.length >= resolvedLimit && handles.length > items.length,
        items,
        coordSpace,
        scrollX: scroll.scrollX,
        scrollY: scroll.scrollY,
        viewport: page.viewportSize(),
      };

      if (saveMapPath) {
        const absMap = await assertAllowedWritePath(saveMapPath);
        await ensureDir(absMap);
        await fs.writeFile(absMap, JSON.stringify(payload, null, 2), "utf8");
        payload.mapSavedTo = absMap;
      }

      return respond(withFrameMeta(page, frame, payload));
    },
  );
}
