# View the HTML walkthrough

The self-contained [workflow guide](style-workflow.html) explains the inputs, one-time voice setup,
and the recurring notes-to-draft process. It includes a prepared example and three reusable
requests, also saved under [prompts](prompts/). The dedicated braindump skill is still a proposal;
the guide does not implement it.

## Start or recover the reading server

Run from the repository root using an existing Python installation:

```bash
python3 -m http.server 4389 --bind 127.0.0.1 --directory docs
```

Read [the walkthrough over HTTP](http://127.0.0.1:4389/style-workflow.html). The server binds only
to the loopback interface and serves the documentation folder. If the port is occupied, check
whether the existing guide server is already running before starting another process.

The delivery session started a detached server that remains available after the chat turn. It stops
if explicitly terminated or when the computer restarts. Its local PID, URL, recovery command, and
log are recorded under `local/workflow-guide/`, which is ignored by Git. A manually started
foreground server stays available while that terminal process runs.

## Portability and verification

The HTML embeds its fonts, styles, scripts, examples, requests, and font license notices. Copying
the HTML alone is sufficient. External source links are citations, not required runtime resources.
Markdown request downloads are embedded data URLs.

The delivered document was checked in an isolated headless Chromium instance:

- HTTP 200 with a `text/html` content type at the exact reading URL.
- Desktop and mobile rendering, including no horizontal overflow at 320 pixels.
- Light and dark appearance before rendering, plus live system-mode switching.
- Rendered text contrast, loaded embedded fonts, and no page-script errors.
- All example and request controls, keyboard activation, copying, and downloads.
- A copy in an otherwise empty folder with networking disabled and no external requests.

The screenshots and verification details are local under `local/workflow-guide/`. No personal
browser, visible desktop window, or app preview was used for this verification. No live model runs
or personal writing samples were used.
