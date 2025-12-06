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

export type UIManager = {
    container: HTMLDivElement;
    overlay?: HTMLDivElement | undefined;
    createButton: (
        id: string,
        label: string,
        onClick: (e: MouseEvent) => void,
        opts?: ButtonOptions,
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
    dispose: () => void;
};

export function createUIManager(
    parent: HTMLElement = document.body,
): UIManager {
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
    parent.appendChild(container);

    let overlay: HTMLDivElement | undefined;

    function createButton(
        id: string,
        label: string,
        onClick: (e: MouseEvent) => void,
        opts: ButtonOptions = {},
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
        btn.style.border = "1px solid rgba(0,0,0,0.15)";
        btn.style.background = "rgba(255,255,255,0.95)";
        btn.style.cursor = "pointer";
        btn.style.fontFamily = "system-ui, Arial, sans-serif";
        btn.style.fontSize = "14px";
        btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
        if (opts.style) Object.assign(btn.style, opts.style);

        btn.addEventListener("click", (e) => {
            try {
                onClick(e);
            } catch (err) {
                console.error("UI button handler error", err);
            }
        });

        container.appendChild(btn);
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
        overlay = undefined;
    }

    return {
        container,
        overlay,
        createButton,
        createToggleButton,
        setButtonEnabled,
        showOverlay,
        hideOverlay,
        clearButtons,
        dispose,
    };
}

export default createUIManager;
