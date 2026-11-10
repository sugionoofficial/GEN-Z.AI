'use strict';

const MODEL_LABELS = Object.freeze({
    'nano-banana-2.1': ['Nano Banana 2.1'],
    'nano-banana-pro': ['Nano Banana Pro'],
    'nano-banana-2-lite': ['Nano Banana 2 Lite']
});

function labelForModel(mediaType, model) {
    const labels = mediaType === 'image' ? MODEL_LABELS[model] : [model];
    if (!labels?.length) throw new TypeError('Model Flow tidak didukung oleh automasi UI.');
    return labels[0];
}

function buildFillTaskScript(task) {
    const modelLabel = labelForModel(task.mediaType, task.model);
    const plan = {
        mediaType: task.mediaType,
        prompt: task.prompt,
        model: modelLabel,
        ratio: task.ratio,
        outputCount: task.outputCount,
        duration: task.duration || null,
        inputMode: task.inputMode || null
    };
    return `(${async function flowTaskFill(plan) {
        const visible = element => {
            if (!(element instanceof Element)) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const describe = element => [
            element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('placeholder'),
            element.innerText, element.textContent
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        const choose = async (fieldWords, candidates) => {
            const wanted = candidates.map(norm);
            const selects = [...document.querySelectorAll('select')].filter(visible);
            for (const select of selects) {
                const label = norm([
                    select.getAttribute('aria-label'), select.name,
                    ...(select.labels ? [...select.labels].map(label => label.innerText) : []),
                    select.parentElement?.innerText
                ].filter(Boolean).join(' '));
                const option = [...select.options].find(item => wanted.includes(norm(item.textContent)) || wanted.includes(norm(item.value)));
                if (option && (!fieldWords.length || fieldWords.some(word => label.includes(word)))) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
            const controls = [...document.querySelectorAll('button,[role="button"],[role="combobox"],[aria-haspopup]')].filter(visible);
            const findOption = () => [...document.querySelectorAll('[role="option"],[role="menuitem"],[data-radix-collection-item]')]
                .filter(visible)
                .find(element => wanted.includes(norm(describe(element))));
            let option = findOption();
            if (option) { option.click(); return true; }
            const trigger = controls.find(element => {
                const name = norm(describe(element));
                return fieldWords.some(word => name.includes(word));
            });
            if (trigger) await trigger.click();
            if (trigger) await new Promise(resolve => setTimeout(resolve, 220));
            option = findOption();
            if (option) { option.click(); return true; }
            const openedControls = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
            const target = openedControls.find(element => element !== trigger && wanted.includes(norm(describe(element))));
            if (target) { target.click(); return true; }
            return false;
        };
        const bodyText = norm(document.body?.innerText);
        if (/sign in|choose an account|masuk ke akun google/.test(bodyText) && !/generate|ingredients|frames/.test(bodyText)) {
            return { ok: false, needsLogin: true, missing: ['Login Google di jendela Flow dalam companion, lalu kirim tugas lagi.'] };
        }
        const promptFields = [...document.querySelectorAll('textarea,input[type="text"],[contenteditable="true"]')].filter(visible);
        const promptField = promptFields
            .map(element => ({ element, label: norm(describe(element) + ' ' + element.parentElement?.innerText) }))
            .filter(item => !/(search|cari|filter)/.test(item.label))
            .sort((a, b) => {
                const score = item => (/prompt|describe|imagine|scene|write|story|text/.test(item.label) ? 10 : 0) + (item.element.tagName === 'TEXTAREA' ? 3 : 0) + Math.min(2, item.element.getBoundingClientRect().width / 500);
                return score(b) - score(a);
            })[0]?.element;
        if (!promptField) return { ok: false, needsLogin: false, missing: ['Kolom prompt yang terlihat tidak ditemukan.'], controls: promptFields.length };
        promptField.focus();
        if (promptField.isContentEditable) {
            promptField.textContent = plan.prompt;
            promptField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: plan.prompt }));
        } else {
            const proto = promptField.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(promptField, plan.prompt); else promptField.value = plan.prompt;
            promptField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: plan.prompt }));
            promptField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const missing = [];
        if (!(promptField.isContentEditable ? promptField.textContent : promptField.value).includes(plan.prompt.slice(0, Math.min(24, plan.prompt.length)))) {
            missing.push('Prompt belum terpasang.');
        }
        if (plan.mediaType === 'video') {
            const modeLabel = plan.inputMode === 'frames' ? 'Frames' : 'Ingredients';
            if (!await choose(['mode', 'frames', 'ingredients'], [modeLabel])) missing.push('Mode ' + modeLabel);
        }
        const modelWords = plan.mediaType === 'image' ? ['model', 'image'] : ['model', 'video'];
        if (!await choose(modelWords, [plan.model])) missing.push('Model ' + plan.model);
        if (!await choose(['aspect', 'ratio', 'rasio'], [plan.ratio])) missing.push('Rasio ' + plan.ratio);
        if (plan.mediaType === 'video') {
            if (!await choose(['duration', 'length', 'seconds'], [plan.duration + ' seconds', plan.duration + 's', plan.duration + ' sec', plan.duration + ' detik', String(plan.duration)])) missing.push('Durasi ' + plan.duration + ' detik');
        }
        const countLabels = ['x' + plan.outputCount, plan.outputCount + ' outputs', plan.outputCount + ' results', String(plan.outputCount)];
        if (!await choose(['output', 'number', 'count', 'jumlah'], countLabels)) missing.push('Jumlah output ' + plan.outputCount);
        return { ok: missing.length === 0, needsLogin: false, missing, promptInserted: true, model: plan.model, ratio: plan.ratio, outputCount: plan.outputCount };
    }.toString()})(${JSON.stringify(plan)})`;
}

async function applyVisibleTask(webContents, task) {
    const script = buildFillTaskScript(task);
    return webContents.executeJavaScript(script, true);
}

async function setVisibleFileInput(webContents, filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return { ok: true, count: 0 };
    const debuggerSession = webContents.debugger;
    const attachedHere = !debuggerSession.isAttached();
    if (attachedHere) debuggerSession.attach('1.3');
    try {
        await debuggerSession.sendCommand('DOM.enable');
        const document = await debuggerSession.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
        const { nodeIds } = await debuggerSession.sendCommand('DOM.querySelectorAll', {
            nodeId: document.root.nodeId,
            selector: 'input[type="file"]'
        });
        if (!nodeIds?.length) return { ok: false, reason: 'Flow belum menampilkan kontrol unggah referensi.' };
        let selected = null;
        for (const nodeId of nodeIds) {
            const described = await debuggerSession.sendCommand('DOM.describeNode', { nodeId });
            const attrs = described.node?.attributes || [];
            const attr = name => attrs[attrs.indexOf(name) + 1] || '';
            const accept = attr('accept').toLowerCase();
            if (!accept || accept.includes('image') || accept.includes('*')) {
                selected = { nodeId, multiple: attrs.includes('multiple') };
                if (selected.multiple) break;
            }
        }
        if (!selected) return { ok: false, reason: 'Kontrol unggah gambar Flow tidak dikenali.' };
        if (filePaths.length > 1 && !selected.multiple) {
            return { ok: false, reason: 'Flow hanya menyediakan satu slot upload saat ini; tambahkan referensi manual.' };
        }
        await debuggerSession.sendCommand('DOM.setFileInputFiles', { nodeId: selected.nodeId, files: filePaths });
        return { ok: true, count: filePaths.length };
    } catch (error) {
        return { ok: false, reason: String(error?.message || 'Gagal memasang file referensi di Flow.').slice(0, 300) };
    } finally {
        if (attachedHere && debuggerSession.isAttached()) debuggerSession.detach();
    }
}

async function clickVisibleGenerate(webContents) {
    return webContents.executeJavaScript(`(() => {
        const visible = element => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; };
        const name = element => String(element.getAttribute('aria-label') || element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
        const target = buttons.find(element => /^(generate|generate image|generate video|create)$/.test(name(element)) && !element.disabled);
        if (!target) return { clicked: false, reason: 'Tombol Generate Flow tidak ditemukan atau belum aktif.' };
        target.click();
        return { clicked: true, label: name(target) };
    })()`, true);
}

module.exports = { applyVisibleTask, buildFillTaskScript, clickVisibleGenerate, labelForModel, setVisibleFileInput };
