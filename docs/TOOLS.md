# Tool reference

Generated from runtime registration. Do not edit by hand.

Default availability is shown below. Mutation tools additionally require an
operator capability and client confirmation. Unavailable legacy tools are not
registered even when called by name. Annotations are hints, not authority.

## browser.set_capture_profile

Set default capture profile used by snapshot/list/query tools in this session.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "type": "string",
      "enum": [
        "light",
        "balanced",
        "full"
      ]
    },
    "responseBudgetBytes": {
      "type": "number"
    }
  },
  "required": [
    "profile"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.get_capture_profile

Get the active capture profile and response payload budget.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.query_dom

Safely query DOM nodes and return structured attributes/states without arbitrary JS execution.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "rootSelector": {
      "type": "string"
    },
    "rootElementId": {
      "type": "number"
    },
    "detail": {
      "type": "string",
      "enum": [
        "low",
        "high"
      ]
    },
    "timeoutMs": {
      "type": "number"
    },
    "limit": {
      "type": "number"
    },
    "attrs": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "includeText": {
      "type": "boolean"
    },
    "includeValue": {
      "type": "boolean"
    },
    "includeBBox": {
      "type": "boolean"
    },
    "includeVisibility": {
      "type": "boolean"
    },
    "includeState": {
      "type": "boolean"
    },
    "includeTagName": {
      "type": "boolean"
    },
    "pierceShadow": {
      "type": "boolean"
    },
    "maxChars": {
      "type": "number"
    },
    "maxPayloadBytes": {
      "type": "number"
    }
  },
  "required": [
    "selector"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.take_snapshot

DevTools-style snapshot based on the accessibility tree. Returns compact nodes with uids.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "detail": {
      "type": "string",
      "enum": [
        "low",
        "high"
      ]
    },
    "interestingOnly": {
      "type": "boolean"
    },
    "interactiveOnly": {
      "type": "boolean"
    },
    "visibleOnly": {
      "type": "boolean"
    },
    "maxDepth": {
      "type": "number"
    },
    "maxNodes": {
      "type": "number"
    },
    "maxNameChars": {
      "type": "number"
    },
    "query": {
      "type": "string"
    },
    "includeUrlTitle": {
      "type": "boolean"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.snapshot

Return a snapshot of the current page (title, url, text, links).

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "detail": {
      "type": "string",
      "enum": [
        "low",
        "high"
      ]
    },
    "maxChars": {
      "type": "number"
    },
    "maxLinks": {
      "type": "number"
    },
    "includeHeadings": {
      "type": "boolean"
    },
    "includeFormsSummary": {
      "type": "boolean"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.list

List visible interactive elements (links, buttons, inputs). Includes role=radio/checkbox.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "detail": {
      "type": "string",
      "enum": [
        "low",
        "high"
      ]
    },
    "limit": {
      "type": "number"
    },
    "maxItems": {
      "type": "number"
    },
    "maxTextChars": {
      "type": "number"
    },
    "visibleOnly": {
      "type": "boolean"
    },
    "interactiveOnly": {
      "type": "boolean"
    },
    "viewportOnly": {
      "type": "boolean"
    },
    "includeSelectors": {
      "type": "boolean"
    },
    "rootSelector": {
      "type": "string"
    },
    "rootElementId": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.set_input_files

Set files on an <input type="file"> by selector or cached elementId.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "paths": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ]
    },
    "selector": {
      "type": "string"
    },
    "elementId": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "paths"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.extract_text

Extract text from a selector. Use all=true to get all matches.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    },
    "all": {
      "type": "boolean"
    },
    "maxChars": {
      "type": "number"
    },
    "limit": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "selector"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.extract_html

Extract outerHTML from a selector.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    },
    "maxChars": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "selector"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.screenshot

Capture a bounded viewport JPEG. Optional relative file output requires write capability and confirmation.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "minLength": 1
    },
    "quality": {
      "type": "integer",
      "minimum": 10,
      "maximum": 80
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.visual_snapshot

Take a screenshot and return an element map with bounding boxes for visual navigation.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "detail": {
      "type": "string",
      "enum": [
        "low",
        "high"
      ]
    },
    "fullPage": {
      "type": "boolean"
    },
    "viewportOnly": {
      "type": "boolean"
    },
    "visibleOnly": {
      "type": "boolean"
    },
    "timeoutMs": {
      "type": "number"
    },
    "limit": {
      "type": "number"
    },
    "maxItems": {
      "type": "number"
    },
    "interactiveOnly": {
      "type": "boolean"
    },
    "maxTextChars": {
      "type": "number"
    },
    "includeText": {
      "type": "boolean"
    },
    "includeSelectors": {
      "type": "boolean"
    },
    "rootSelector": {
      "type": "string"
    },
    "rootElementId": {
      "type": "number"
    },
    "saveMapPath": {
      "type": "string"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    }
  },
  "required": [
    "path"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.launch

Launch Chromium with Playwright and open a new page.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "headless": {
      "type": "boolean"
    },
    "slowMoMs": {
      "type": "number"
    },
    "args": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "stealth": {
      "type": "boolean"
    },
    "channel": {
      "type": "string"
    },
    "executablePath": {
      "type": "string"
    },
    "profileDirectory": {
      "type": "string"
    },
    "viewport": {
      "type": "object",
      "properties": {
        "width": {
          "type": "number"
        },
        "height": {
          "type": "number"
        }
      },
      "required": [
        "width",
        "height"
      ],
      "additionalProperties": false
    },
    "userAgent": {
      "type": "string"
    },
    "userDataDir": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.connect_cdp

Connect to an existing Chrome/Chromium with remote debugging enabled (CDP).

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "endpoint": {
      "type": "string"
    },
    "slowMoMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.launch_chrome_cdp

Launch Chrome with remote debugging enabled and connect via CDP.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chromePath": {
      "type": "string"
    },
    "userDataDir": {
      "type": "string"
    },
    "profileDirectory": {
      "type": "string"
    },
    "port": {
      "type": "number"
    },
    "args": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "headless": {
      "type": "boolean"
    },
    "slowMoMs": {
      "type": "number"
    },
    "stealth": {
      "type": "boolean"
    },
    "waitMs": {
      "type": "number"
    },
    "autoClose": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.new_page

Open a new page/tab in the current context.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.list_pages

List open pages/tabs in the current context.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "includeClosed": {
      "type": "boolean"
    },
    "maxPages": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.list_frames

List frames for the active page (or a specified pageId).

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pageId": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.select_page

Select the active page/tab by pageId.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pageId": {
      "type": "number"
    }
  },
  "required": [
    "pageId"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.close_page

Close a page/tab by pageId (or the active page if omitted).

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pageId": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.close

Close the current browser session.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "terminateChrome": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.goto

Navigate to a URL.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "url": {
      "type": "string"
    },
    "waitUntil": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "url"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.back

Go back in history.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "waitUntil": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.forward

Go forward in history.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "waitUntil": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.reload

Reload the current page.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "waitUntil": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.wait

Wait for a selector or timeout.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    },
    "ms": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.wait_for

Wait for a selector, text, or uid to be ready. Prefer this over fixed sleeps.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    },
    "text": {
      "type": "string"
    },
    "exact": {
      "type": "boolean"
    },
    "uid": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    },
    "state": {
      "type": "string",
      "enum": [
        "attached",
        "visible",
        "hidden",
        "detached",
        "enabled"
      ]
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.list_dialogs

List dialogs captured from the page (alert/confirm/prompt/beforeunload).

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pageId": {
      "type": "number"
    },
    "includeHandled": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.handle_dialog

Handle a pending dialog by dialogId.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dialogId": {
      "type": "string"
    },
    "action": {
      "type": "string",
      "enum": [
        "accept",
        "dismiss"
      ]
    },
    "promptText": {
      "type": "string"
    }
  },
  "required": [
    "dialogId"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.wait_for_download

Wait for the next download event and return its metadata.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "timeoutMs": {
      "type": "number"
    },
    "pageId": {
      "type": "number"
    },
    "peek": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.save_download

Save a captured download to a path (restricted by MCP path rules).

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "downloadId": {
      "type": "string"
    },
    "path": {
      "type": "string"
    }
  },
  "required": [
    "downloadId",
    "path"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.wait_for_popup

Wait for a popup/new tab opened by page actions.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "timeoutMs": {
      "type": "number"
    },
    "openerPageId": {
      "type": "number"
    },
    "peek": {
      "type": "boolean"
    },
    "select": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.expect_event

Wait for a specific browser event, optionally running an allowlisted action first.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "eventType": {
      "type": "string",
      "enum": [
        "navigation",
        "popup",
        "download",
        "response",
        "request"
      ]
    },
    "pattern": {
      "type": "string"
    },
    "regex": {
      "type": "boolean"
    },
    "status": {
      "type": "number"
    },
    "method": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    },
    "selectPopup": {
      "type": "boolean"
    },
    "afterAction": {
      "type": "object",
      "properties": {
        "toolName": {
          "type": "string"
        },
        "args": {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {}
        }
      },
      "required": [
        "toolName"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "eventType"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.get_cookies

List cookie metadata; includeValues requires an explicit request and confirmed session capability.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "urls": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "includeValues": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.set_cookies

Set cookies in the current browser context.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "cookies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "value": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "domain": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "expires": {
            "type": "number"
          },
          "httpOnly": {
            "type": "boolean"
          },
          "secure": {
            "type": "boolean"
          },
          "sameSite": {
            "type": "string",
            "enum": [
              "Strict",
              "Lax",
              "None"
            ]
          }
        },
        "required": [
          "name",
          "value"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "cookies"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.clear_cookies

Clear all cookies in the current browser context.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.export_storage_state

Export state to a new JSON file in configured .mcp-data/auth; no inline data or overwrite.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "includeData": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.import_storage_state

Import allowed-origin state into a fresh managed context and close the previous context.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "closePreviousContext": {
      "type": "boolean"
    }
  },
  "required": [
    "path"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.evaluate

Run arbitrary JS in the page/frame context. Disabled by default; enable with MCP_ALLOW_EVALUATE=true.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "expression": {
      "type": "string"
    },
    "arg": {},
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    },
    "executionTimeoutMs": {
      "type": "number"
    },
    "maxOutputBytes": {
      "type": "number"
    }
  },
  "required": [
    "expression"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.get_scroll_state

Get scroll metrics for the main page (window).

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.scroll_by

Scroll the main page by a delta.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dx": {
      "type": "number"
    },
    "dy": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.scroll_to

Scroll the main page to an absolute position.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "x": {
      "type": "number"
    },
    "y": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.get_scrollables

List scrollable containers on the page.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "limit": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.get_container_scroll_state

Get scroll metrics for a specific scrollable container.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    }
  },
  "required": [
    "selector"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.scroll_container

Scroll a specific container by selector.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "selector": {
      "type": "string"
    },
    "dx": {
      "type": "number"
    },
    "dy": {
      "type": "number"
    }
  },
  "required": [
    "selector"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.hover

Hover an element by uid, elementId, selector, or text.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "uid": {
      "type": "string"
    },
    "elementId": {
      "type": "number"
    },
    "selector": {
      "type": "string"
    },
    "text": {
      "type": "string"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "force": {
      "type": "boolean"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.click

Click an element by elementId, selector, or text.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "uid": {
      "type": "string"
    },
    "elementId": {
      "type": "number"
    },
    "selector": {
      "type": "string"
    },
    "text": {
      "type": "string"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "force": {
      "type": "boolean"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.type

Type into an input by selector or cached elementId.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "text": {
      "type": "string"
    },
    "selector": {
      "type": "string"
    },
    "elementId": {
      "type": "number"
    },
    "clear": {
      "type": "boolean"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "text"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.fill

Fill an input/textarea by selector or cached elementId (sets full value).

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "text": {
      "type": "string"
    },
    "uid": {
      "type": "string"
    },
    "selector": {
      "type": "string"
    },
    "elementId": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "text"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.scroll_to_uid

Scroll the element identified by a uid (from browser.take_snapshot) into view.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "uid": {
      "type": "string"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "uid"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.press

Press a key, optionally focusing selector or elementId.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "key": {
      "type": "string"
    },
    "selector": {
      "type": "string"
    },
    "elementId": {
      "type": "number"
    },
    "frameId": {
      "type": "string"
    },
    "frameSelector": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "key"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.click_at

Click at viewport coordinates (x, y). Use browser.click_at_page for page coordinates.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "x": {
      "type": "number"
    },
    "y": {
      "type": "number"
    },
    "button": {
      "type": "string",
      "enum": [
        "left",
        "middle",
        "right"
      ]
    },
    "clickCount": {
      "type": "number"
    }
  },
  "required": [
    "x",
    "y"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.click_at_page

Click at page coordinates (x, y). Will scroll to bring the point into view first.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "x": {
      "type": "number"
    },
    "y": {
      "type": "number"
    },
    "button": {
      "type": "string",
      "enum": [
        "left",
        "middle",
        "right"
      ]
    },
    "clickCount": {
      "type": "number"
    }
  },
  "required": [
    "x",
    "y"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.form_audit

Audit the current page for missing required form fields (generic HTML forms).

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "maxItems": {
      "type": "number"
    },
    "includeSelectors": {
      "type": "boolean"
    },
    "maxLabelChars": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.fill_form

Fill a set of fields by label or selector (generic HTML forms).

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "fields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "selector": {
            "type": "string"
          },
          "value": {},
          "kind": {
            "type": "string",
            "enum": [
              "text",
              "textarea",
              "select",
              "radio",
              "checkbox",
              "contenteditable"
            ]
          }
        },
        "required": [
          "value"
        ],
        "additionalProperties": false
      }
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "fields"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.list_console_messages

List recent console logs and exceptions captured via CDP.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "limit": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.list_network_requests

List recent network requests captured via CDP.

Default: **enabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "limit": {
      "type": "number"
    },
    "urlContains": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## browser.get_network_request

Get details for a captured network request (optionally includes response body).

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "requestId": {
      "type": "string"
    },
    "includeBody": {
      "type": "boolean"
    },
    "maxBodyChars": {
      "type": "number"
    },
    "saveBodyPath": {
      "type": "string"
    }
  },
  "required": [
    "requestId"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## forms.google_audit

Audit a Google Form page and return compact answer state by question.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "maxQuestions": {
      "type": "number"
    },
    "maxAnswerChars": {
      "type": "number"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## forms.google_set_text

Fill a Google Form text/textarea/date question by matching its title.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "question": {
      "type": "string"
    },
    "value": {
      "type": "string"
    },
    "match": {
      "type": "string",
      "enum": [
        "contains",
        "exact"
      ]
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "question",
    "value"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## forms.google_set_dropdown

Select a Google Form dropdown option by matching its question title.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "question": {
      "type": "string"
    },
    "option": {
      "type": "string"
    },
    "match": {
      "type": "string",
      "enum": [
        "contains",
        "exact"
      ]
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "question",
    "option"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## forms.google_set_checkbox

Set a Google Form checkbox option by question title and option label (idempotent).

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "question": {
      "type": "string"
    },
    "option": {
      "type": "string"
    },
    "checked": {
      "type": "boolean"
    },
    "match": {
      "type": "string",
      "enum": [
        "contains",
        "exact"
      ]
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "question",
    "option"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## forms.google_set_radio

Select a Google Form radio/linear-scale option by question title and option label.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "question": {
      "type": "string"
    },
    "option": {
      "type": "string"
    },
    "match": {
      "type": "string",
      "enum": [
        "contains",
        "exact"
      ]
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "question",
    "option"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## forms.google_set_grid

Select a Google Form multiple-choice grid cell by row and column values.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "question": {
      "type": "string"
    },
    "row": {
      "type": "string"
    },
    "column": {
      "type": "string"
    },
    "match": {
      "type": "string",
      "enum": [
        "contains",
        "exact"
      ]
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "question",
    "row",
    "column"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## files.read_text

Read bounded text using a relative path under the operator read root.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "maxChars": {
      "type": "number"
    }
  },
  "required": [
    "path"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## files.read_pdf_text

Extract bounded PDF text in an isolated child process; explicit PDF capability and read root required.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "maxChars": {
      "type": "number"
    }
  },
  "required": [
    "path"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## files.list_dir

List files in an allowed directory (Applied Jobs, Auto/output, Auto/logs).

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "pattern": {
      "type": "string"
    },
    "recursive": {
      "type": "boolean"
    },
    "maxDepth": {
      "type": "number"
    },
    "limit": {
      "type": "number"
    },
    "includeDirs": {
      "type": "boolean"
    }
  },
  "required": [
    "path"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## files.write_text

Create a new bounded text file under the operator write root; confirmation required, no overwrite.

Default: **disabled**. Per-call confirmation: **required**.

Annotations: `{"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":false}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "text": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "text"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## jobs.extract_indeed

Extract jobs from an Indeed search results page. Optionally save each job to a .txt file.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "limit": {
      "type": "number"
    },
    "saveDir": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## jobs.indeed_next_page

Go to the next Indeed results page (direct URL by default, with optional click mode).

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": [
        "direct",
        "click",
        "auto"
      ]
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## search.extract_google

Extract standard Google search results from the current page. Optionally save to .txt files.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "limit": {
      "type": "number"
    },
    "saveDir": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```

## search.google

Search Google and extract results for a query. Optionally save to .txt files.

Default: **disabled**. Per-call confirmation: **not required**.

Annotations: `{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true}`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "query": {
      "type": "string"
    },
    "limit": {
      "type": "number"
    },
    "saveDir": {
      "type": "string"
    }
  },
  "required": [
    "query"
  ],
  "additionalProperties": false
}
```

Output envelope schema (tool-specific fields vary):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": {}
}
```
