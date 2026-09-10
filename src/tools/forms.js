// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerFormsTools(
  server,
  { clampNumber, ensurePage, escapeRegex, respond, z },
) {
  server.registerTool(
    "forms.google_audit",
    {
      description:
        "Audit a Google Form page and return compact answer state by question.",
      inputSchema: {
        maxQuestions: z.number().optional(),
        maxAnswerChars: z.number().optional(),
      },
    },
    async ({ maxQuestions, maxAnswerChars }) => {
      const page = ensurePage();
      const maxQ = clampNumber(maxQuestions, 1, 500, 200);
      const maxA = clampNumber(maxAnswerChars, 20, 2000, 400);

      const payload = await page.evaluate(
        ({ maxQ, maxA }) => {
          const clean = (s) =>
            String(s || "")
              .replace(/\s+/g, " ")
              .trim();
          const trunc = (s) => {
            const t = clean(s);
            if (maxA <= 0 || t.length <= maxA) return t;
            if (maxA <= 3) return t.slice(0, maxA);
            return t.slice(0, maxA - 3) + "...";
          };

          const blocks = Array.from(document.querySelectorAll(".Qr7Oae")).slice(
            0,
            maxQ,
          );
          const questions = [];

          for (let i = 0; i < blocks.length; i += 1) {
            const block = blocks[i];
            const titleEl = block.querySelector("[role=heading]");
            const title = clean(titleEl?.textContent);
            if (!title) continue;

            const listbox = block.querySelector(
              "[role=listbox], [role=combobox]",
            );
            const textarea = block.querySelector("textarea");
            const textInput = block.querySelector(
              "input[type=text], input[type=email], input[type=url], input[type=date], input:not([type])",
            );

            const checkboxEls = Array.from(
              block.querySelectorAll("div[role=checkbox]"),
            ).filter((el) => clean(el.getAttribute("aria-label")));
            const radioEls = Array.from(
              block.querySelectorAll("div[role=radio]"),
            ).filter((el) => clean(el.getAttribute("aria-label")));

            const q = {
              index: questions.length + 1,
              title,
              type: "unknown",
              answered: false,
              answer: null,
            };

            if (textarea) {
              const val = textarea.value || "";
              q.type = "textarea";
              q.answer = trunc(val);
              q.answered = clean(val).length > 0;
            } else if (listbox) {
              q.type = "dropdown";

              // Google Forms dropdowns typically have an aria-selected option even when unanswered
              // (e.g., "Choose"). Treat placeholders as unanswered.
              const placeholders = new Set([
                "choose",
                "select",
                "choose an option",
                "select an option",
              ]);
              const selectedOptions = Array.from(
                block.querySelectorAll("[role=option][aria-selected=true]"),
              );
              const selectedLabels = selectedOptions
                .map((el) =>
                  clean(
                    el.getAttribute("data-value") ||
                      el.getAttribute("aria-label") ||
                      el.textContent,
                  ),
                )
                .filter(Boolean);
              const chosen =
                selectedLabels.find(
                  (v) => !placeholders.has(v.toLowerCase()),
                ) || "";

              q.answer = chosen ? trunc(chosen) : null;
              q.answered = Boolean(chosen);
            } else if (checkboxEls.length > 0) {
              const selected = checkboxEls
                .filter((el) => el.getAttribute("aria-checked") === "true")
                .map((el) => clean(el.getAttribute("aria-label")))
                .filter(Boolean);
              q.type = "checkbox";
              q.answer = selected;
              q.answered = selected.length > 0;
            } else if (radioEls.length > 0) {
              const labels = radioEls
                .map((el) => clean(el.getAttribute("aria-label")))
                .filter(Boolean);
              const isGrid = labels.some((l) => l.includes(", response for "));
              if (isGrid) {
                const rows = Array.from(
                  new Set(
                    labels
                      .map((l) => {
                        const parts = l.split(", response for ");
                        return parts.length === 2 ? clean(parts[1]) : "";
                      })
                      .filter(Boolean),
                  ),
                );

                const selectedByRow = {};
                for (const row of rows) {
                  const chosen = radioEls.find((el) => {
                    const label = clean(el.getAttribute("aria-label"));
                    return (
                      label.endsWith(`, response for ${row}`) &&
                      el.getAttribute("aria-checked") === "true"
                    );
                  });
                  if (chosen) {
                    const label = clean(chosen.getAttribute("aria-label"));
                    const parts = label.split(", response for ");
                    selectedByRow[row] = parts.length ? clean(parts[0]) : label;
                  }
                }

                q.type = "grid";
                q.answer = selectedByRow;
                q.answered =
                  rows.length > 0 &&
                  rows.every((row) => Boolean(selectedByRow[row]));
              } else {
                const selected = radioEls.find(
                  (el) => el.getAttribute("aria-checked") === "true",
                );
                const selectedLabel = selected
                  ? clean(selected.getAttribute("aria-label"))
                  : "";
                const isLinearScale =
                  labels.length > 0 && labels.every((l) => /^\d+$/.test(l));
                q.type = isLinearScale ? "linear_scale" : "radio";
                q.answer = selectedLabel || null;
                q.answered = Boolean(selectedLabel);
              }
            } else if (textInput) {
              const val = textInput.value || "";
              q.type =
                textInput.getAttribute("type") === "date" ? "date" : "text";
              q.answer = trunc(val);
              q.answered = clean(val).length > 0;
            }

            questions.push(q);
          }

          const missing = questions
            .filter((q) => !q.answered)
            .map((q) => q.title);
          return {
            url: window.location.href,
            title: document.title,
            count: questions.length,
            unansweredCount: missing.length,
            missing,
            questions,
          };
        },
        { maxQ, maxA },
      );

      return respond(payload);
    },
  );

  server.registerTool(
    "forms.google_set_text",
    {
      description:
        "Fill a Google Form text/textarea/date question by matching its title.",
      inputSchema: {
        question: z.string(),
        value: z.string(),
        match: z.enum(["contains", "exact"]).optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ question, value, match, timeoutMs }) => {
      const page = ensurePage();
      const mode = match || "contains";
      const qPattern =
        mode === "exact"
          ? new RegExp(`^\\s*${escapeRegex(question)}\\s*$`, "i")
          : new RegExp(escapeRegex(question), "i");

      const block = page
        .locator("div.Qr7Oae")
        .filter({
          has: page.locator("[role=heading]").filter({ hasText: qPattern }),
        })
        .first();

      if ((await block.count()) === 0) {
        throw new Error(`Google Form question not found: ${question}`);
      }

      const field = block
        .locator(
          "textarea, input[type=text], input[type=email], input[type=url], input[type=date], input:not([type])",
        )
        .first();
      await field.scrollIntoViewIfNeeded();
      await field.fill(value, { timeout: timeoutMs || 30000 });
      const actual = await field.inputValue();

      return respond({
        status: "filled",
        question,
        valueLength: value.length,
        actualLength: actual.length,
      });
    },
  );

  server.registerTool(
    "forms.google_set_dropdown",
    {
      description:
        "Select a Google Form dropdown option by matching its question title.",
      inputSchema: {
        question: z.string(),
        option: z.string(),
        match: z.enum(["contains", "exact"]).optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ question, option, match, timeoutMs }) => {
      const page = ensurePage();
      const mode = match || "contains";
      const qPattern =
        mode === "exact"
          ? new RegExp(`^\\s*${escapeRegex(question)}\\s*$`, "i")
          : new RegExp(escapeRegex(question), "i");

      const block = page
        .locator("div.Qr7Oae")
        .filter({
          has: page.locator("[role=heading]").filter({ hasText: qPattern }),
        })
        .first();

      if ((await block.count()) === 0) {
        throw new Error(`Google Form dropdown question not found: ${question}`);
      }

      const listbox = block.locator("[role=listbox], [role=combobox]").first();
      await listbox.scrollIntoViewIfNeeded();
      await listbox.click({ timeout: timeoutMs || 30000 });

      // The page may contain multiple hidden dropdown option lists. Click the first visible match.
      const desiredOptions = page.getByRole("option", {
        name: option,
        exact: true,
      });
      const deadline = Date.now() + (timeoutMs || 30000);
      let clicked = false;
      let matches = 0;

      while (!clicked && Date.now() < deadline) {
        matches = await desiredOptions.count();
        for (let i = 0; i < matches; i += 1) {
          const candidate = desiredOptions.nth(i);
          if (await candidate.isVisible()) {
            await candidate.click({ timeout: timeoutMs || 30000 });
            clicked = true;
            break;
          }
        }
        if (!clicked) await page.waitForTimeout(100);
      }

      if (!clicked) {
        throw new Error(
          `Dropdown option not visible: ${option} (matches=${matches})`,
        );
      }

      // Determine the actual selected option. Google Forms often keeps a placeholder like "Choose"
      // selected; ignore placeholders when deciding if the dropdown is answered.
      const placeholders = new Set([
        "choose",
        "select",
        "choose an option",
        "select an option",
      ]);
      const clean = (s) =>
        String(s || "")
          .replace(/\s+/g, " ")
          .trim();
      const desired = clean(option);

      const selectedLabels = (
        await block
          .locator("[role=option][aria-selected=true]")
          .allTextContents()
      )
        .map(clean)
        .filter(Boolean);
      const chosen =
        selectedLabels.find((v) => !placeholders.has(v.toLowerCase())) || "";
      const ok =
        Boolean(chosen) && chosen.toLowerCase() === desired.toLowerCase();

      return respond({
        status: ok ? "selected" : "failed",
        question,
        option,
        chosen,
        selectedLabels: selectedLabels.slice(0, 10),
      });
    },
  );

  server.registerTool(
    "forms.google_set_checkbox",
    {
      description:
        "Set a Google Form checkbox option by question title and option label (idempotent).",
      inputSchema: {
        question: z.string(),
        option: z.string(),
        checked: z.boolean().optional(),
        match: z.enum(["contains", "exact"]).optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ question, option, checked, match, timeoutMs }) => {
      const page = ensurePage();
      const desired = checked ?? true;
      const mode = match || "contains";
      const qPattern =
        mode === "exact"
          ? new RegExp(`^\\s*${escapeRegex(question)}\\s*$`, "i")
          : new RegExp(escapeRegex(question), "i");

      const block = page
        .locator("div.Qr7Oae")
        .filter({
          has: page.locator("[role=heading]").filter({ hasText: qPattern }),
        })
        .first();

      if ((await block.count()) === 0) {
        throw new Error(`Google Form checkbox question not found: ${question}`);
      }

      const cb = block
        .getByRole("checkbox", { name: option, exact: true })
        .first();
      await cb.scrollIntoViewIfNeeded();
      const before = (await cb.getAttribute("aria-checked")) || "false";
      const want = desired ? "true" : "false";
      if (before !== want) {
        await cb.click({ timeout: timeoutMs || 30000 });
      }
      const after = (await cb.getAttribute("aria-checked")) || "false";

      return respond({
        status: after === want ? "set" : "failed",
        question,
        option,
        desired,
        before,
        after,
      });
    },
  );

  server.registerTool(
    "forms.google_set_radio",
    {
      description:
        "Select a Google Form radio/linear-scale option by question title and option label.",
      inputSchema: {
        question: z.string(),
        option: z.string(),
        match: z.enum(["contains", "exact"]).optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ question, option, match, timeoutMs }) => {
      const page = ensurePage();
      const mode = match || "contains";
      const qPattern =
        mode === "exact"
          ? new RegExp(`^\\s*${escapeRegex(question)}\\s*$`, "i")
          : new RegExp(escapeRegex(question), "i");

      const block = page
        .locator("div.Qr7Oae")
        .filter({
          has: page.locator("[role=heading]").filter({ hasText: qPattern }),
        })
        .first();

      if ((await block.count()) === 0) {
        throw new Error(`Google Form radio question not found: ${question}`);
      }

      const radio = block
        .getByRole("radio", { name: option, exact: true })
        .first();
      await radio.scrollIntoViewIfNeeded();
      await radio.click({ timeout: timeoutMs || 30000 });
      const after = (await radio.getAttribute("aria-checked")) || "false";

      return respond({
        status: after === "true" ? "selected" : "failed",
        question,
        option,
        ariaChecked: after,
      });
    },
  );

  server.registerTool(
    "forms.google_set_grid",
    {
      description:
        "Select a Google Form multiple-choice grid cell by row and column values.",
      inputSchema: {
        question: z.string(),
        row: z.string(),
        column: z.string(),
        match: z.enum(["contains", "exact"]).optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ question, row, column, match, timeoutMs }) => {
      const page = ensurePage();
      const mode = match || "contains";
      const qPattern =
        mode === "exact"
          ? new RegExp(`^\\s*${escapeRegex(question)}\\s*$`, "i")
          : new RegExp(escapeRegex(question), "i");

      const block = page
        .locator("div.Qr7Oae")
        .filter({
          has: page.locator("[role=heading]").filter({ hasText: qPattern }),
        })
        .first();

      if ((await block.count()) === 0) {
        throw new Error(`Google Form grid question not found: ${question}`);
      }

      const cellLabel = `${column}, response for ${row}`;
      const radio = block
        .getByRole("radio", { name: cellLabel, exact: true })
        .first();
      await radio.scrollIntoViewIfNeeded();
      await radio.click({ timeout: timeoutMs || 30000 });
      const after = (await radio.getAttribute("aria-checked")) || "false";

      return respond({
        status: after === "true" ? "selected" : "failed",
        question,
        row,
        column,
        cellLabel,
        ariaChecked: after,
      });
    },
  );
}
