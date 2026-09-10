// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerInteractionTools(
  server,
  {
    ENV_DEFAULTS,
    assertPayloadWithinLimit,
    auditForm,
    clampNumber,
    clearElementCache,
    clickByBackendNodeId,
    ensurePage,
    fillForm,
    getBackendNodeIdForUid,
    getCachedElement,
    getFrameScope,
    getOriginOrNull,
    hoverByBackendNodeId,
    isOriginAllowed,
    normalizeKey,
    resolveFrame,
    respond,
    scrollIntoViewIfNeeded,
    setValueByBackendNodeId,
    withFrameMeta,
    z,
  },
) {
  server.registerTool(
    "browser.evaluate",
    {
      description:
        "Run arbitrary JS in the page/frame context. Disabled by default; enable with MCP_ALLOW_EVALUATE=true.",
      inputSchema: {
        expression: z.string(),
        arg: z.any().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
        executionTimeoutMs: z.number().optional(),
        maxOutputBytes: z.number().optional(),
      },
    },
    async ({
      expression,
      arg,
      frameId,
      frameSelector,
      timeoutMs,
      executionTimeoutMs,
      maxOutputBytes,
    }) => {
      if (!(ENV_DEFAULTS.allowEvaluate ?? false)) {
        throw new Error(
          "browser.evaluate is disabled. Set MCP_ALLOW_EVALUATE=true to enable.",
        );
      }

      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const origin = getOriginOrNull(frame.url());
      if (!isOriginAllowed(origin, ENV_DEFAULTS.evaluateAllowOrigins)) {
        throw new Error(`Evaluate not allowed on origin "${origin}".`);
      }

      const resolvedExecutionTimeoutMs = clampNumber(
        executionTimeoutMs,
        100,
        120000,
        ENV_DEFAULTS.evaluateTimeoutMs ?? 5000,
      );
      const resolvedMaxOutputBytes = clampNumber(
        maxOutputBytes,
        256,
        2_000_000,
        ENV_DEFAULTS.evaluateMaxBytes ?? 200_000,
      );

      let timer = null;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Evaluation timeout (${resolvedExecutionTimeoutMs}ms).`,
              ),
            ),
          resolvedExecutionTimeoutMs,
        );
      });

      const evalPromise = scope.evaluate(
        ({ expression, arg }) => {
          try {
            const source = String(expression || "").trim();
            if (!source) throw new Error("Empty expression.");

            let evaluated = null;
            try {
              const maybeFn = (0, eval)(`(${source})`);
              if (typeof maybeFn === "function") {
                evaluated = maybeFn(arg);
              } else {
                evaluated = maybeFn;
              }
            } catch {
              evaluated = (0, eval)(source);
            }
            return { ok: true, value: evaluated };
          } catch (error) {
            return {
              ok: false,
              message: String(error && error.message ? error.message : error),
            };
          }
        },
        { expression, arg },
      );

      let evalResult;
      try {
        evalResult = await Promise.race([evalPromise, timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      if (!evalResult || evalResult.ok !== true) {
        throw new Error(
          `Evaluation failed: ${evalResult?.message || "unknown error"}`,
        );
      }

      const payloadBytes = assertPayloadWithinLimit(
        evalResult.value,
        resolvedMaxOutputBytes,
      );
      return respond(
        withFrameMeta(page, frame, {
          status: "evaluated",
          origin,
          payloadBytes,
          maxOutputBytes: resolvedMaxOutputBytes,
          executionTimeoutMs: resolvedExecutionTimeoutMs,
          result: evalResult.value,
        }),
      );
    },
  );

  server.registerTool(
    "browser.get_scroll_state",
    {
      description: "Get scroll metrics for the main page (window).",
      inputSchema: {},
    },
    async () => {
      const page = ensurePage();
      const metrics = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        const scrollTop = el.scrollTop || 0;
        const scrollHeight = el.scrollHeight || 0;
        const clientHeight = el.clientHeight || 0;
        return {
          scrollTop,
          scrollHeight,
          clientHeight,
          atBottom: scrollTop + clientHeight >= scrollHeight - 2,
        };
      });
      return respond(metrics);
    },
  );

  server.registerTool(
    "browser.scroll_by",
    {
      description: "Scroll the main page by a delta.",
      inputSchema: {
        dx: z.number().optional(),
        dy: z.number().optional(),
      },
    },
    async ({ dx, dy }) => {
      const page = ensurePage();
      const deltaX = dx ?? 0;
      const deltaY = dy ?? 0;
      if (!deltaX && !deltaY) {
        throw new Error("Provide dx or dy for scrolling.");
      }
      const metrics = await page.evaluate(
        ({ deltaX, deltaY }) => {
          window.scrollBy(deltaX, deltaY);
          const el = document.scrollingElement || document.documentElement;
          const scrollTop = el.scrollTop || 0;
          const scrollHeight = el.scrollHeight || 0;
          const clientHeight = el.clientHeight || 0;
          return {
            scrollTop,
            scrollHeight,
            clientHeight,
            atBottom: scrollTop + clientHeight >= scrollHeight - 2,
          };
        },
        { deltaX, deltaY },
      );
      clearElementCache();
      return respond({ status: "scrolled", ...metrics });
    },
  );

  server.registerTool(
    "browser.scroll_to",
    {
      description: "Scroll the main page to an absolute position.",
      inputSchema: {
        x: z.number().optional(),
        y: z.number().optional(),
      },
    },
    async ({ x, y }) => {
      const page = ensurePage();
      const targetX = x ?? 0;
      const targetY = y ?? 0;
      const metrics = await page.evaluate(
        ({ targetX, targetY }) => {
          window.scrollTo(targetX, targetY);
          const el = document.scrollingElement || document.documentElement;
          const scrollTop = el.scrollTop || 0;
          const scrollHeight = el.scrollHeight || 0;
          const clientHeight = el.clientHeight || 0;
          return {
            scrollTop,
            scrollHeight,
            clientHeight,
            atBottom: scrollTop + clientHeight >= scrollHeight - 2,
          };
        },
        { targetX, targetY },
      );
      clearElementCache();
      return respond({ status: "scrolled", ...metrics });
    },
  );

  server.registerTool(
    "browser.get_scrollables",
    {
      description: "List scrollable containers on the page.",
      inputSchema: {
        limit: z.number().optional(),
      },
    },
    async ({ limit }) => {
      const page = ensurePage();
      const items = await page.evaluate(
        ({ limit }) => {
          const maxItems = limit || 25;
          const results = [];
          const escapeCss = (value) => {
            if (window.CSS && CSS.escape) return CSS.escape(value);
            return value.replace(
              /([ #;?%&,.+*~':"!^$\\[\\]()=>|\/@])/g,
              "\\\\$1",
            );
          };
          const makeSelector = (el) => {
            if (el.id) return `#${escapeCss(el.id)}`;
            const testId = el.getAttribute("data-testid");
            if (testId) return `[data-testid="${escapeCss(testId)}"]`;
            const aria = el.getAttribute("aria-label");
            if (aria) return `[aria-label="${escapeCss(aria)}"]`;
            const role = el.getAttribute("role");
            if (role)
              return `${el.tagName.toLowerCase()}[role="${escapeCss(role)}"]`;
            const parts = [];
            let node = el;
            while (
              node &&
              node.nodeType === 1 &&
              node !== document.body &&
              node !== document.documentElement
            ) {
              let part = node.tagName.toLowerCase();
              const siblings = Array.from(
                node.parentElement?.children || [],
              ).filter((n) => n.tagName === node.tagName);
              if (siblings.length > 1) {
                const index = siblings.indexOf(node) + 1;
                part += `:nth-of-type(${index})`;
              }
              parts.unshift(part);
              node = node.parentElement;
              if (parts.length >= 5) break;
            }
            return parts.join(" > ") || el.tagName.toLowerCase();
          };

          const elements = Array.from(document.querySelectorAll("body *"));
          for (const el of elements) {
            if (results.length >= maxItems) break;
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden")
              continue;
            const rect = el.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) continue;
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;
            const scrollableY =
              (overflowY === "auto" || overflowY === "scroll") &&
              el.scrollHeight - el.clientHeight > 2;
            const scrollableX =
              (overflowX === "auto" || overflowX === "scroll") &&
              el.scrollWidth - el.clientWidth > 2;
            if (!scrollableY && !scrollableX) continue;
            const selector = makeSelector(el);
            results.push({
              selector,
              tag: el.tagName.toLowerCase(),
              id: el.id || "",
              className: el.className || "",
              ariaLabel: el.getAttribute("aria-label") || "",
              role: el.getAttribute("role") || "",
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              bbox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            });
          }
          return results;
        },
        { limit },
      );
      return respond({ count: items.length, items });
    },
  );

  server.registerTool(
    "browser.get_container_scroll_state",
    {
      description: "Get scroll metrics for a specific scrollable container.",
      inputSchema: {
        selector: z.string(),
      },
    },
    async ({ selector }) => {
      const page = ensurePage();
      const metrics = await page.evaluate(
        ({ selector }) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const scrollTop = el.scrollTop || 0;
          const scrollHeight = el.scrollHeight || 0;
          const clientHeight = el.clientHeight || 0;
          return {
            scrollTop,
            scrollHeight,
            clientHeight,
            atBottom: scrollTop + clientHeight >= scrollHeight - 2,
          };
        },
        { selector },
      );
      if (!metrics) {
        throw new Error(`No element found for selector: ${selector}`);
      }
      return respond(metrics);
    },
  );

  server.registerTool(
    "browser.scroll_container",
    {
      description: "Scroll a specific container by selector.",
      inputSchema: {
        selector: z.string(),
        dx: z.number().optional(),
        dy: z.number().optional(),
      },
    },
    async ({ selector, dx, dy }) => {
      const page = ensurePage();
      const deltaX = dx ?? 0;
      const deltaY = dy ?? 0;
      if (!deltaX && !deltaY) {
        throw new Error("Provide dx or dy for scrolling.");
      }
      const metrics = await page.evaluate(
        ({ selector, deltaX, deltaY }) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          el.scrollBy(deltaX, deltaY);
          const scrollTop = el.scrollTop || 0;
          const scrollHeight = el.scrollHeight || 0;
          const clientHeight = el.clientHeight || 0;
          return {
            scrollTop,
            scrollHeight,
            clientHeight,
            atBottom: scrollTop + clientHeight >= scrollHeight - 2,
          };
        },
        { selector, deltaX, deltaY },
      );
      if (!metrics) {
        throw new Error(`No element found for selector: ${selector}`);
      }
      clearElementCache();
      return respond({ status: "scrolled", ...metrics });
    },
  );

  server.registerTool(
    "browser.hover",
    {
      description: "Hover an element by uid, elementId, selector, or text.",
      inputSchema: {
        uid: z.string().optional(),
        elementId: z.number().optional(),
        selector: z.string().optional(),
        text: z.string().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        force: z.boolean().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      uid,
      elementId,
      selector,
      text,
      frameId,
      frameSelector,
      force,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const hoverOptions = {
        force: force ?? false,
        timeout: clampNumber(timeoutMs, 1000, 120000, 30000),
      };

      if (uid) {
        const backendNodeId = getBackendNodeIdForUid(page, uid, frame);
        await hoverByBackendNodeId(page, backendNodeId);
        clearElementCache();
        return respond(
          withFrameMeta(page, frame, {
            status: "hovered",
            via: "uid",
            uid,
            changed: true,
          }),
        );
      }

      if (elementId) {
        const cached = getCachedElement(page, frame, elementId);
        if (cached.selector) {
          const locator = scope.locator(cached.selector).first();
          if ((await locator.count()) === 0) {
            throw new Error(
              `No element found for cached selector (elementId ${elementId}). Run browser.list again.`,
            );
          }
          await locator.hover(hoverOptions);
        } else if (cached.text) {
          await scope
            .getByText(cached.text, { exact: false })
            .first()
            .hover(hoverOptions);
        } else {
          throw new Error(
            `Cached element ${elementId} has no selector/text to hover. Run browser.list again.`,
          );
        }
        clearElementCache();
        return respond(
          withFrameMeta(page, frame, {
            status: "hovered",
            via: "elementId",
            elementId,
            changed: true,
          }),
        );
      }

      if (selector) {
        await scope.hover(selector, hoverOptions);
        clearElementCache();
        return respond(
          withFrameMeta(page, frame, {
            status: "hovered",
            via: "selector",
            selector,
            changed: true,
          }),
        );
      }

      if (text) {
        await scope
          .getByText(text, { exact: false })
          .first()
          .hover(hoverOptions);
        clearElementCache();
        return respond(
          withFrameMeta(page, frame, {
            status: "hovered",
            via: "text",
            text,
            changed: true,
          }),
        );
      }

      throw new Error("Provide uid, elementId, selector, or text to hover.");
    },
  );

  server.registerTool(
    "browser.click",
    {
      description: "Click an element by elementId, selector, or text.",
      inputSchema: {
        uid: z.string().optional(),
        elementId: z.number().optional(),
        selector: z.string().optional(),
        text: z.string().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        force: z.boolean().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      uid,
      elementId,
      selector,
      text,
      frameId,
      frameSelector,
      force,
      timeoutMs,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const clickOptions = {
        force: force ?? false,
        timeout: clampNumber(timeoutMs, 1000, 120000, 30000),
      };

      if (uid) {
        const backendNodeId = getBackendNodeIdForUid(page, uid, frame);
        const result = await clickByBackendNodeId(page, backendNodeId);
        clearElementCache();
        return respond(
          withFrameMeta(page, frame, {
            status: "clicked",
            via: "uid",
            uid,
            ...result,
          }),
        );
      }

      if (elementId) {
        const cached = getCachedElement(page, frame, elementId);

        if (cached.selector) {
          const locator = scope.locator(cached.selector).first();
          if ((await locator.count()) === 0) {
            throw new Error(
              `No element found for cached selector (elementId ${elementId}). Run browser.list again.`,
            );
          }

          // Many UIs render radios/checkboxes as obstructed inputs with a clickable <label>.
          if (
            cached.tag === "input" &&
            (cached.type === "radio" || cached.type === "checkbox")
          ) {
            const clickedLabel = await locator.evaluate((node) => {
              const input = node;
              let label = null;
              try {
                if (input?.labels && input.labels.length)
                  label = input.labels[0];
              } catch {
                label = null;
              }
              if (!label) {
                const id = input?.id;
                if (id && window.CSS && CSS.escape) {
                  label = document.querySelector(
                    `label[for="${CSS.escape(id)}"]`,
                  );
                }
              }
              if (!label && input?.closest) {
                label = input.closest("label");
              }
              if (label) {
                try {
                  label.scrollIntoView({ block: "center", inline: "center" });
                } catch {}
                label.click();
                return true;
              }
              return false;
            });
            if (clickedLabel) {
              clearElementCache();
              return respond(
                withFrameMeta(page, frame, {
                  status: "clicked",
                  via: "label",
                  elementId,
                }),
              );
            }
          }

          try {
            await locator.scrollIntoViewIfNeeded();
            await locator.click(clickOptions);
          } catch (err) {
            const msg =
              err && typeof err === "object" && "message" in err
                ? String(err.message)
                : String(err);
            throw new Error(
              `Click failed for elementId ${elementId}. Details: ${msg}`,
            );
          }
        } else if (cached.text) {
          const locator = scope
            .getByText(cached.text, { exact: false })
            .first();
          await locator.click(clickOptions);
        } else {
          throw new Error(
            `Cached element ${elementId} has no selector/text to click. Run browser.list again.`,
          );
        }
      } else if (selector) {
        try {
          await scope.click(selector, clickOptions);
        } catch (err) {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String(err.message)
              : String(err);
          throw new Error(
            `Click failed for selector "${selector}". Details: ${msg}`,
          );
        }
      } else if (text) {
        const locator = scope.getByText(text, { exact: false });
        try {
          await locator.first().click(clickOptions);
        } catch (err) {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String(err.message)
              : String(err);
          throw new Error(`Click failed for text "${text}". Details: ${msg}`);
        }
      } else {
        throw new Error("Provide elementId, selector, or text to click.");
      }

      clearElementCache();
      return respond(withFrameMeta(page, frame, { status: "clicked" }));
    },
  );

  server.registerTool(
    "browser.type",
    {
      description: "Type into an input by selector or cached elementId.",
      inputSchema: {
        text: z.string(),
        selector: z.string().optional(),
        elementId: z.number().optional(),
        clear: z.boolean().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      text,
      selector,
      elementId,
      clear,
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
        if (clear) await locator.fill("");
        await locator.type(text);
      } else if (selector) {
        if (clear) await scope.fill(selector, "");
        await scope.type(selector, text);
      } else {
        throw new Error("Provide selector or elementId.");
      }

      return respond(
        withFrameMeta(page, frame, {
          status: "typed",
          textLength: text.length,
        }),
      );
    },
  );

  server.registerTool(
    "browser.fill",
    {
      description:
        "Fill an input/textarea by selector or cached elementId (sets full value).",
      inputSchema: {
        text: z.string(),
        uid: z.string().optional(),
        selector: z.string().optional(),
        elementId: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({
      text,
      uid,
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

      if (uid) {
        const backendNodeId = getBackendNodeIdForUid(page, uid, frame);
        const payload = await setValueByBackendNodeId(
          page,
          backendNodeId,
          text,
        );
        return respond(
          withFrameMeta(page, frame, {
            status: "filled",
            via: "uid",
            uid,
            textLength: text.length,
            actualLength: String(payload.value || "").length,
          }),
        );
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
        await locator.fill(text);
      } else if (selector) {
        await scope.fill(selector, text);
      } else {
        throw new Error("Provide selector or elementId.");
      }

      return respond(
        withFrameMeta(page, frame, {
          status: "filled",
          textLength: text.length,
        }),
      );
    },
  );

  server.registerTool(
    "browser.scroll_to_uid",
    {
      description:
        "Scroll the element identified by a uid (from browser.take_snapshot) into view.",
      inputSchema: {
        uid: z.string(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ uid, frameId, frameSelector, timeoutMs }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const backendNodeId = getBackendNodeIdForUid(page, uid, frame);
      await scrollIntoViewIfNeeded(page, backendNodeId);
      clearElementCache();
      return respond(withFrameMeta(page, frame, { status: "scrolled", uid }));
    },
  );

  server.registerTool(
    "browser.press",
    {
      description: "Press a key, optionally focusing selector or elementId.",
      inputSchema: {
        key: z.string(),
        selector: z.string().optional(),
        elementId: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ key, selector, elementId, frameId, frameSelector, timeoutMs }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      const normalizedKey = normalizeKey(key);

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
        await locator.focus();
      } else if (selector) {
        await scope.focus(selector);
      }

      await page.keyboard.press(normalizedKey);
      return respond(
        withFrameMeta(page, frame, { status: "pressed", key: normalizedKey }),
      );
    },
  );

  server.registerTool(
    "browser.click_at",
    {
      description:
        "Click at viewport coordinates (x, y). Use browser.click_at_page for page coordinates.",
      inputSchema: {
        x: z.number(),
        y: z.number(),
        button: z.enum(["left", "middle", "right"]).optional(),
        clickCount: z.number().optional(),
      },
    },
    async ({ x, y, button, clickCount }) => {
      const page = ensurePage();
      await page.mouse.click(x, y, {
        button: button || "left",
        clickCount: clickCount || 1,
      });
      clearElementCache();
      return respond({ status: "clicked", x, y });
    },
  );

  server.registerTool(
    "browser.click_at_page",
    {
      description:
        "Click at page coordinates (x, y). Will scroll to bring the point into view first.",
      inputSchema: {
        x: z.number(),
        y: z.number(),
        button: z.enum(["left", "middle", "right"]).optional(),
        clickCount: z.number().optional(),
      },
    },
    async ({ x, y, button, clickCount }) => {
      const page = ensurePage();
      const viewport = page.viewportSize() || { width: 0, height: 0 };

      // Scroll so the target point is roughly centered.
      const targetScrollX = Math.max(0, Math.floor(x - viewport.width / 2));
      const targetScrollY = Math.max(0, Math.floor(y - viewport.height / 2));
      await page.evaluate(({ sx, sy }) => window.scrollTo(sx, sy), {
        sx: targetScrollX,
        sy: targetScrollY,
      });

      const scroll = await page.evaluate(() => ({
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
      }));

      const vx = Math.round(x - scroll.scrollX);
      const vy = Math.round(y - scroll.scrollY);

      await page.mouse.click(vx, vy, {
        button: button || "left",
        clickCount: clickCount || 1,
      });
      clearElementCache();
      return respond({
        status: "clicked",
        coordSpace: "page",
        x,
        y,
        viewportX: vx,
        viewportY: vy,
      });
    },
  );

  server.registerTool(
    "browser.form_audit",
    {
      description:
        "Audit the current page for missing required form fields (generic HTML forms).",
      inputSchema: {
        maxItems: z.number().optional(),
        includeSelectors: z.boolean().optional(),
        maxLabelChars: z.number().optional(),
      },
    },
    async ({ maxItems, includeSelectors, maxLabelChars }) => {
      const page = ensurePage();
      const payload = await auditForm(page, {
        maxItems,
        includeSelectors,
        maxLabelChars,
      });
      return respond(payload);
    },
  );

  server.registerTool(
    "browser.fill_form",
    {
      description:
        "Fill a set of fields by label or selector (generic HTML forms).",
      inputSchema: {
        fields: z.array(
          z.object({
            label: z.string().optional(),
            selector: z.string().optional(),
            value: z.any(),
            kind: z
              .enum([
                "text",
                "textarea",
                "select",
                "radio",
                "checkbox",
                "contenteditable",
              ])
              .optional(),
          }),
        ),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ fields, timeoutMs }) => {
      const page = ensurePage();
      const payload = await fillForm(page, fields, { timeoutMs });
      clearElementCache();
      return respond(payload);
    },
  );
}
