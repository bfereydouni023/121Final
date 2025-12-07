/**
 * Simple UI manager for DOM buttons and overlays.
 *
 * Usage:
 *   import { createUIManager } from './uiManager';
 *   const ui = createUIManager();
 *   const btn = ui.createButton('hold', 'Hold Ball', () => { console.log('hold'); });
 *   ui.showOverlay('Paused');
 */

export type ButtonOptions = {
    className?: string;
    title?: string;
    ariaLabel?: string;
    // quick style overrides
    style?: Partial<CSSStyleDeclaration>;
};

export type HUDMode = "light" | "dark";
export type HUDColors = {
    background: string;
    foreground: string;
    accent: string;
    buttonBg: string;
    buttonText: string;
    bubbleBg: string;
    bubbleText: string;
    border: string;
    shadow: string;
};

export type UIManager = {
    container: HTMLDivElement;
    overlay?: HTMLDivElement | undefined;
    createButton: (
        id: string,
        label: string,
        onClick: (e: MouseEvent) => void,
        opts?: ButtonOptions,
        parent?: HTMLElement,
    ) => HTMLButtonElement;
    createToggleButton: (
        id: string,
        labelOn: string,
        labelOff: string,
        initial: boolean,
        onToggle: (state: boolean) => void,
    ) => HTMLButtonElement;
    setButtonEnabled: (id: string, enabled: boolean) => void;
    showOverlay: (text?: string) => void;
    hideOverlay: () => void;
    clearButtons: () => void;
    setHUDMode: (mode: "light" | "dark") => void;
    createModeToggleButton: (parent?: HTMLElement) => HTMLButtonElement;
    onThemeChange: (
        listener: (mode: "light" | "dark", colors: HUDColors) => void,
    ) => void;
    dispose: () => void;
};

export function createUIManager(
    parent: HTMLElement = document.body,
): UIManager {
    // Standardized HUD color palettes for light/dark mode
    const HUD_THEMES: Record<HUDMode, HUDColors> = {
        light: {
            background: "rgba(243,244,246,0.95)",
            foreground: "#111827",
            accent: "#0ea5a4", // teal-500
            buttonBg: "rgba(255,255,255,0.95)",
            buttonText: "#111827",
            bubbleBg: "rgba(255,255,255,0.98)",
            bubbleText: "#111827",
            border: "rgba(0,0,0,0.08)",
            shadow: "0 6px 18px rgba(15,23,42,0.08)",
        },
        dark: {
            background: "rgba(17,24,39,0.72)",
            foreground: "#f8fafc",
            accent: "#38bdf8", // sky-400
            buttonBg: "rgba(24,24,27,0.9)",
            buttonText: "#f8fafc",
            bubbleBg: "rgba(24,24,27,0.95)",
            bubbleText: "#f8fafc",
            border: "rgba(255,255,255,0.06)",
            shadow: "0 10px 30px rgba(2,6,23,0.7)",
        },
    };
    let hudMode: HUDMode = "light";
    let hudColors: HUDColors = HUD_THEMES[hudMode];
    const themeListeners: Array<(mode: HUDMode, colors: HUDColors) => void> = [];

    let modeToggleBtn: HTMLButtonElement | null = null;

    function setHUDMode(mode: HUDMode) {
        hudMode = mode;
        hudColors = HUD_THEMES[mode];
        // apply to existing UI chrome
        // container buttons
        const btns = container.querySelectorAll("button.ui-btn, button");
        btns.forEach((b) => {
            const el = b as HTMLButtonElement;
            el.style.background = hudColors.buttonBg;
            el.style.color = hudColors.buttonText;
            el.style.border = `1px solid ${hudColors.border}`;
            (el.style as CSSStyleDeclaration).boxShadow = hudColors.shadow;
        });
        // update key bubble if present
        if (keyAnimEl) {
            keyAnimEl.style.background = hudColors.bubbleBg;
            keyAnimEl.style.color = hudColors.bubbleText;
            keyAnimEl.style.border = `1px solid ${hudColors.border}`;
            keyAnimEl.style.boxShadow = hudColors.shadow;
        }
        // also update the mode toggle if present
        if (modeToggleBtn) {
            modeToggleBtn.style.background = hudColors.buttonBg;
            modeToggleBtn.style.color = hudColors.buttonText;
            modeToggleBtn.style.border = `1px solid ${hudColors.border}`;
            (modeToggleBtn.style as CSSStyleDeclaration).boxShadow =
                hudColors.shadow;
            modeToggleBtn.textContent = hudMode === "dark" ? "🌙" : "🌞";
            modeToggleBtn.setAttribute(
                "aria-pressed",
                hudMode === "dark" ? "true" : "false",
            );
        }

        themeListeners.forEach((listener) => listener(mode, hudColors));
    }
    // prefer to detect system preference initially
    try {
        const prefersDark =
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
        setHUDMode(prefersDark ? "dark" : "light");
    } catch (err) {
        console.warn("Could not detect system color scheme preference:", err);
    }

    // container for buttons
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.right = "16px";
    container.style.top = "16px";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    container.style.zIndex = "10000";
    container.style.pointerEvents = "auto";
    // subtle background for HUD area (helps with contrast)
    container.style.backdropFilter = "saturate(120%) blur(6px)";
    container.style.background = "transparent";
    parent.appendChild(container);

    let overlay: HTMLDivElement | undefined = undefined;

    function onThemeChange(listener: (mode: HUDMode, colors: HUDColors) => void) {
        themeListeners.push(listener);
        listener(hudMode, hudColors);
    }

    function createModeToggleButton(parentEl: HTMLElement = container) {
        const btn = document.createElement("button");
        btn.className = "ui-mode-toggle";
        btn.type = "button";
        btn.id = "ui-mode-toggle";
        btn.title = "Toggle light / dark mode";
        btn.style.padding = "8px";
        btn.style.borderRadius = "8px";
        btn.style.border = `1px solid ${hudColors.border}`;
        btn.style.background = hudColors.buttonBg;
        btn.style.color = hudColors.buttonText;
        btn.style.cursor = "pointer";
        btn.style.fontSize = "32px";
        btn.style.lineHeight = "1";
        (btn.style as CSSStyleDeclaration).boxShadow = hudColors.shadow;
        btn.setAttribute("aria-pressed", hudMode === "dark" ? "true" : "false");
        btn.textContent = hudMode === "dark" ? "🌙" : "🌞";
        btn.addEventListener("click", () => {
            const next = hudMode === "dark" ? "light" : "dark";
            setHUDMode(next);
            btn.textContent = next === "dark" ? "🌙" : "🌞";
            btn.setAttribute(
                "aria-pressed",
                next === "dark" ? "true" : "false",
            );
        });
        modeToggleBtn = btn;
        parentEl.appendChild(btn);
        return btn;
    }

    // bottom-left key-emoji animator (triggered by pressing "8")
    let keyAnimEl: HTMLDivElement | null = null;
    let keyAnimTimers: number[] = [];

    function createKeyEmojiElement(): HTMLDivElement {
        const el = document.createElement("div");
        el.textContent = "🔑";
        el.style.position = "fixed";
        el.style.left = "32px";
        el.style.bottom = "32px";
        el.style.zIndex = "20001";
        el.style.pointerEvents = "none";
        el.style.fontSize = "128px";
        el.style.lineHeight = "1";

        // initial hidden state (appear animation will transition from this)
        el.style.opacity = "0";
        el.style.transform = "translateY(18px) scale(0.9)";
        // set a default transition that will be overridden per-phase
        el.style.transition =
            "transform 320ms cubic-bezier(.2,.8,.2,1), opacity 320ms ease";

        // bubble background and padding (uses HUD theme colors)
        el.style.background = hudColors.bubbleBg;
        el.style.color = hudColors.bubbleText;
        el.style.padding = "12px";
        el.style.borderRadius = "12px";
        el.style.border = `1px solid ${hudColors.border}`;
        el.style.boxShadow = hudColors.shadow;
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";

        // make the bubble a bit larger than the emoji so it looks like a HUD element
        el.style.gap = "8px";
        return el;
    }

    function clearKeyTimers() {
        for (const t of keyAnimTimers) {
            try {
                window.clearTimeout(t);
            } catch (err) {
                console.error("Error clearing key animation timer:", err);
            }
        }
        keyAnimTimers = [];
    }

    function animateKeyEmoji() {
        // timings (ms)
        const APPEAR_MS = 320;
        const HOLD_MS = 900;
        const DISAPPEAR_MS = 420;

        // start clean
        clearKeyTimers();
        try {
            if (keyAnimEl && keyAnimEl.parentElement)
                keyAnimEl.parentElement.removeChild(keyAnimEl);
        } catch (err) {
            console.error("Error removing keyAnimEl:", err);
        }
        keyAnimEl = createKeyEmojiElement();
        parent.appendChild(keyAnimEl);

        // Force layout then perform appear transition
        requestAnimationFrame(() => {
            if (!keyAnimEl) return;
            // set appear transition timing
            keyAnimEl.style.transition = `transform ${APPEAR_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${APPEAR_MS}ms ease`;
            // final visible state for appear
            keyAnimEl.style.opacity = "1";
            keyAnimEl.style.transform = "translateY(0px) scale(1)";
        });

        // After appear + hold, run disappear animation
        const disappearStarter = window.setTimeout(() => {
            if (!keyAnimEl) return;
            // configure disappear timing
            keyAnimEl.style.transition = `transform ${DISAPPEAR_MS}ms cubic-bezier(.22,.9,.3,1), opacity ${DISAPPEAR_MS}ms ease`;
            // target disappear state: slide up and fade out
            keyAnimEl.style.opacity = "0";
            keyAnimEl.style.transform = "translateY(-18px) scale(0.85)";

            // remove element after the disappear transition completes
            const remover = window.setTimeout(() => {
                try {
                    if (keyAnimEl && keyAnimEl.parentElement)
                        keyAnimEl.parentElement.removeChild(keyAnimEl);
                } catch (err) {
                    console.error("Error removing keyAnimEl:", err);
                }
                keyAnimEl = null;
            }, DISAPPEAR_MS + 24);
            keyAnimTimers.push(remover);
        }, APPEAR_MS + HOLD_MS);
        keyAnimTimers.push(disappearStarter);
    }

    function onKeyPressForKeyEmoji(e: KeyboardEvent) {
        if (e.key === "8") {
            animateKeyEmoji();
        }
    }
    window.addEventListener("keydown", onKeyPressForKeyEmoji);

    function createButton(
        id: string,
        label: string,
        onClick: (e: MouseEvent) => void,
        opts: ButtonOptions = {},
        parentEl: HTMLElement = container,
    ) {
        const btn = document.createElement("button");
        btn.id = id;
        btn.type = "button";
        btn.textContent = label;
        btn.className = opts.className ?? "ui-btn";
        btn.title = opts.title ?? "";
        if (opts.ariaLabel) btn.setAttribute("aria-label", opts.ariaLabel);
        // default styling (light, unobtrusive)
        btn.style.padding = "8px 12px";
        btn.style.borderRadius = "6px";
        btn.style.border = `1px solid ${hudColors.border}`;
        btn.style.background = hudColors.buttonBg;
        btn.style.color = hudColors.buttonText;
        btn.style.cursor = "pointer";
        btn.style.fontFamily = "system-ui, Arial, sans-serif";
        btn.style.fontSize = "14px";
        (btn.style as CSSStyleDeclaration).boxShadow = hudColors.shadow;
        if (opts.style) Object.assign(btn.style, opts.style);

        btn.addEventListener("click", (e) => {
            try {
                onClick(e);
            } catch (err) {
                console.error("UI button handler error", err);
            }
        });

        parentEl.appendChild(btn);
        return btn;
    }

    function createToggleButton(
        id: string,
        labelOn: string,
        labelOff: string,
        initial: boolean,
        onToggle: (state: boolean) => void,
    ) {
        let state = initial;
        const btn = createButton(id, state ? labelOn : labelOff, () => {
            state = !state;
            btn.textContent = state ? labelOn : labelOff;
            onToggle(state);
        });
        return btn;
    }

    function setButtonEnabled(id: string, enabled: boolean) {
        const el = container.querySelector(
            `#${CSS.escape(id)}`,
        ) as HTMLButtonElement | null;
        if (el) el.disabled = !enabled;
    }

    function showOverlay(text?: string) {
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.left = "0";
            overlay.style.top = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.zIndex = "20000";
            overlay.style.pointerEvents = "auto";
            overlay.style.background = "rgba(0,0,0,0.0)";
            overlay.style.transition = "background 360ms ease";
            const txt = document.createElement("div");
            txt.style.color = "white";
            txt.style.fontFamily = "system-ui, Arial, sans-serif";
            txt.style.fontSize = "3rem";
            txt.style.padding = "24px";
            txt.style.borderRadius = "8px";
            txt.style.opacity = "0";
            txt.style.transform = "translateY(6px)";
            txt.style.transition = "opacity 360ms ease, transform 360ms ease";
            overlay.appendChild(txt);
            parent.appendChild(overlay);
            // animate in
            requestAnimationFrame(() => {
                overlay!.style.background = "rgba(0,0,0,0.7)";
                txt.style.opacity = "1";
                txt.style.transform = "translateY(0)";
                txt.textContent = text ?? "";
            });
        } else {
            const txt = overlay.querySelector("div");
            if (txt) txt.textContent = text ?? "";
            overlay.style.display = "flex";
        }
    }

    function hideOverlay() {
        if (!overlay) return;
        const txt = overlay.querySelector("div");
        if (txt) {
            txt.style.opacity = "0";
            txt.style.transform = "translateY(6px)";
        }
        overlay.style.background = "rgba(0,0,0,0)";
        setTimeout(() => {
            if (overlay) overlay.style.display = "none";
        }, 360);
    }

    function clearButtons() {
        container.innerHTML = "";
    }

    function dispose() {
        clearButtons();
        if (overlay && overlay.parentElement)
            overlay.parentElement.removeChild(overlay);
        if (container.parentElement)
            container.parentElement.removeChild(container);
        // cleanup key animation & listener
        try {
            window.removeEventListener("keydown", onKeyPressForKeyEmoji);
        } catch (err) {
            console.error("Error removing keydown listener:", err);
        }
        try {
            if (keyAnimEl && keyAnimEl.parentElement)
                keyAnimEl.parentElement.removeChild(keyAnimEl);
        } catch (err) {
            console.error("Error removing keyAnimEl:", err);
        }
        clearKeyTimers();
        overlay = undefined;
    }

    return {
        container,
        overlay,
        createButton,
        createToggleButton,
        setButtonEnabled,
        setHUDMode,
        createModeToggleButton,
        onThemeChange,
        showOverlay,
        hideOverlay,
        clearButtons,
        dispose,
    };
}

export default createUIManager;
