/* =========================================================
   GEN-Z.AI
   MOBILE MODEL PICKER
   ---------------------------------------------------------
   Daftar model bergaya dropdown desktop untuk layar HP.
   Native #modelSelect tetap ada dan menjadi sumber nilai.
   Modul ini hanya membuat tampilan alternatif dan meneruskan
   pilihan sebagai event "change" ke handler aplikasi lama.
========================================================= */

const MOBILE_QUERY = "(max-width: 768px)";
const ENHANCED_CLASS = "is-mobile-picker-enhanced";

export function initializeMobileModelPicker() {
    const select = document.getElementById("modelSelect");
    const wrap = select?.closest(".generate-model-select-wrap");

    if (!select || !wrap || wrap.dataset.mobilePickerReady === "true") {
        return null;
    }

    const media = window.matchMedia(MOBILE_QUERY);
    const selector = document.getElementById("modelSelector");
    const logoPreview = document.getElementById("selectedModelLogo");
    const trigger = document.createElement("button");
    const triggerValue = document.createElement("span");
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const menu = document.createElement("div");
    const list = document.createElement("div");

    let open = false;
    let activeIndex = -1;
    let optionElements = [];
    let positionFrame = 0;
    let optionSignature = "";

    wrap.dataset.mobilePickerReady = "true";

    trigger.type = "button";
    trigger.className = "generate-model-picker-trigger";
    trigger.hidden = true;
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "mobileModelPickerList");
    trigger.setAttribute("aria-label", "Pilih model AI");

    triggerValue.className = "generate-model-picker-trigger-value";
    arrow.classList.add("generate-model-picker-trigger-arrow");
    arrow.setAttribute("viewBox", "0 0 20 20");
    arrow.setAttribute("fill", "none");
    arrow.setAttribute("aria-hidden", "true");
    arrowPath.setAttribute("d", "m5 7.5 5 5 5-5");
    arrowPath.setAttribute("stroke", "currentColor");
    arrowPath.setAttribute("stroke-width", "1.8");
    arrowPath.setAttribute("stroke-linecap", "round");
    arrowPath.setAttribute("stroke-linejoin", "round");
    arrow.append(arrowPath);
    trigger.append(triggerValue, arrow);

    menu.className = "generate-model-picker-menu";
    menu.hidden = true;
    list.id = "mobileModelPickerList";
    list.className = "generate-model-picker-list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Pilih model AI");
    list.tabIndex = -1;
    menu.append(list);
    wrap.append(trigger);
    // Lepas dari card generate yang memakai overflow:hidden agar daftar
    // tidak terpotong di layar kecil.
    document.body.append(menu);

    function visibleOptions() {
        return Array.from(select.options).filter(option => !option.hidden);
    }

    function hasEnabledOption() {
        return visibleOptions().some(option => !option.disabled);
    }

    function isSelectHidden() {
        return select.hidden || select.style.display === "none" || Boolean(selector?.hidden);
    }

    function getSignature() {
        return JSON.stringify([
            select.value,
            select.disabled,
            isSelectHidden(),
            Array.from(select.options).map(option => [
                option.value,
                option.textContent.trim(),
                option.disabled,
                option.hidden
            ])
        ]);
    }

    function updateTrigger() {
        const selected = select.selectedOptions[0] || select.options[0];
        const label = selected?.textContent.trim() || "Pilih model...";
        triggerValue.textContent = label;
        trigger.setAttribute("aria-label", `Pilih model AI: ${label}`);
        trigger.disabled = select.disabled || !hasEnabledOption();
        trigger.hidden = !media.matches || isSelectHidden();
    }

    function setActive(index, scroll = true) {
        if (!optionElements.length) return;
        activeIndex = Math.max(0, Math.min(index, optionElements.length - 1));

        optionElements.forEach((element, i) => {
            element.classList.toggle("is-active", i === activeIndex);
        });

        const active = optionElements[activeIndex];
        list.setAttribute("aria-activedescendant", active.id);
        if (scroll) active.scrollIntoView({ block: "nearest" });
    }

    function moveActive(direction) {
        if (!optionElements.length) return;
        let next = activeIndex;

        for (let count = 0; count < optionElements.length; count += 1) {
            next = (next + direction + optionElements.length) % optionElements.length;
            if (optionElements[next].getAttribute("aria-disabled") !== "true") {
                setActive(next);
                return;
            }
        }
    }

    function closeMenu({ restoreFocus = false } = {}) {
        if (!open) return;
        open = false;
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        list.removeAttribute("aria-activedescendant");
        selector?.classList.remove("is-picker-open");
        if (restoreFocus && !trigger.hidden) trigger.focus({ preventScroll: true });
    }

    function positionMenu() {
        if (!open || !media.matches) return;

        const viewport = window.visualViewport;
        const viewportLeft = viewport?.offsetLeft || 0;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportWidth = viewport?.width || window.innerWidth;
        const viewportHeight = viewport?.height || window.innerHeight;
        const gutter = 12;
        const gap = 6;
        const rect = wrap.getBoundingClientRect();

        if (rect.bottom < viewportTop || rect.top > viewportTop + viewportHeight) {
            closeMenu();
            return;
        }

        const width = Math.max(0, Math.min(rect.width, viewportWidth - gutter * 2));
        const left = Math.max(
            viewportLeft + gutter,
            Math.min(rect.left, viewportLeft + viewportWidth - width - gutter)
        );
        const below = viewportTop + viewportHeight - rect.bottom - gap - gutter;
        const above = rect.top - viewportTop - gap - gutter;
        const opensAbove = below < 176 && above > below;
        const available = Math.max(0, opensAbove ? above : below);
        const maxHeight = Math.min(352, available);

        menu.style.width = `${width}px`;
        menu.style.left = `${left}px`;
        menu.style.maxHeight = `${maxHeight}px`;
        menu.style.bottom = "auto";
        menu.dataset.placement = opensAbove ? "top" : "bottom";

        const height = Math.min(menu.scrollHeight, maxHeight);
        const desiredTop = opensAbove ? rect.top - gap - height : rect.bottom + gap;
        const top = Math.max(
            viewportTop + gutter,
            Math.min(desiredTop, viewportTop + viewportHeight - height - gutter)
        );
        menu.style.top = `${top}px`;
    }

    function schedulePosition() {
        if (positionFrame) return;
        positionFrame = window.requestAnimationFrame(() => {
            positionFrame = 0;
            positionMenu();
        });
    }

    function chooseOption(index) {
        const option = visibleOptions()[index];
        if (!option || option.disabled || select.disabled) return;

        const changed = select.value !== option.value;
        select.value = option.value;
        updateTrigger();
        closeMenu({ restoreFocus: true });

        if (changed) {
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function renderOptions() {
        const options = visibleOptions();
        const fragment = document.createDocumentFragment();

        optionElements = options.map((option, index) => {
            const element = document.createElement("div");
            element.id = `mobileModelOption-${index}`;
            element.className = "generate-model-picker-option";
            element.setAttribute("role", "option");
            element.setAttribute("aria-selected", String(option.value === select.value));
            element.setAttribute("aria-disabled", String(option.disabled));
            element.dataset.value = option.value;
            element.textContent = option.textContent.trim();
            element.addEventListener("click", () => chooseOption(index));
            fragment.append(element);
            return element;
        });

        list.replaceChildren(fragment);
        const selectedIndex = options.findIndex(option => option.value === select.value);
        setActive(selectedIndex >= 0 ? selectedIndex : 0, false);
    }

    function openMenu() {
        if (trigger.disabled || trigger.hidden || !media.matches || open) return;
        renderOptions();
        if (!optionElements.length) return;

        open = true;
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        selector?.classList.add("is-picker-open");
        positionMenu();
        list.focus({ preventScroll: true });
        optionElements[activeIndex]?.scrollIntoView({ block: "nearest" });
    }

    function sync() {
        const signature = getSignature();
        if (signature === optionSignature) return;
        optionSignature = signature;
        updateTrigger();

        if (select.disabled || isSelectHidden()) {
            closeMenu();
        }

        if (open) {
            renderOptions();
            positionMenu();
        }
    }

    function applyMode() {
        const enhanced = media.matches;
        wrap.classList.toggle(ENHANCED_CLASS, enhanced);
        trigger.hidden = !enhanced || isSelectHidden();
        select.tabIndex = enhanced ? -1 : 0;

        if (enhanced) {
            select.setAttribute("aria-hidden", "true");
        } else {
            select.removeAttribute("aria-hidden");
            closeMenu();
        }
        sync();
    }

    trigger.addEventListener("click", () => {
        if (open) closeMenu({ restoreFocus: true });
        else openMenu();
    });

    trigger.addEventListener("keydown", event => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            openMenu();
        }
    });

    list.addEventListener("keydown", event => {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                moveActive(1);
                break;
            case "ArrowUp":
                event.preventDefault();
                moveActive(-1);
                break;
            case "Home":
                event.preventDefault();
                setActive(0);
                break;
            case "End":
                event.preventDefault();
                setActive(optionElements.length - 1);
                break;
            case "Enter":
            case " ":
                event.preventDefault();
                chooseOption(activeIndex);
                break;
            case "Escape":
                event.preventDefault();
                closeMenu({ restoreFocus: true });
                break;
            case "Tab":
                closeMenu({ restoreFocus: true });
                break;
            default:
                break;
        }
    });

    document.addEventListener("pointerdown", event => {
        if (open && !menu.contains(event.target) && !trigger.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener("focusin", event => {
        if (open && !menu.contains(event.target) && !trigger.contains(event.target)) {
            closeMenu();
        }
    });

    const observer = new MutationObserver(sync);
    observer.observe(select, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["disabled", "hidden", "style", "selected", "value"]
    });

    // Aplikasi kadang mengganti select.value secara programmatic lalu
    // merender logo model. Observer logo menangkap perubahan itu tanpa
    // perlu mengubah alur generate yang sudah ada.
    if (logoPreview) {
        observer.observe(logoPreview, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-model-id", "hidden"]
        });
    }
    if (selector) {
        observer.observe(selector, {
            attributes: true,
            attributeFilter: ["hidden", "style"]
        });
    }

    select.addEventListener("change", sync);
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);
    window.visualViewport?.addEventListener("resize", schedulePosition);
    window.visualViewport?.addEventListener("scroll", schedulePosition);
    media.addEventListener("change", applyMode);
    applyMode();

    return { sync, close: closeMenu };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeMobileModelPicker, { once: true });
} else {
    initializeMobileModelPicker();
}
