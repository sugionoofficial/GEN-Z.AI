// Slot controls only: never read, store, or delete OAuth credentials in the browser.
export function mountOpenClipsOAuth(document) {
    const accounts = document.getElementById("bbOpenClipsAccounts");
    const add = document.getElementById("bbOpenClipsAdd");
    const remove = document.getElementById("bbOpenClipsRemove");
    const count = document.getElementById("bbOpenClipsCount");
    if (!accounts || !add || !remove || !count) return;
    let slots = 1;
    function render() {
        accounts.replaceChildren();
        for (let slot = 1; slot <= slots; slot++) {
            const link = document.createElement("a");
            link.className = "bb-diag-btn bb-diag-btn--primary";
            link.href = `/api/openclips-oauth-login?slot=${slot}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `Login akun ${slot}`;
            accounts.appendChild(link);
        }
        count.textContent = `${slots} slot akun`;
        remove.disabled = slots === 1;
    }
    add.addEventListener("click", () => { slots++; render(); });
    remove.addEventListener("click", () => {
        if (slots > 1) { slots--; render(); }
        if (slots === 1) add.focus();
    });
    render();
}

if (typeof document !== "undefined") mountOpenClipsOAuth(document);
