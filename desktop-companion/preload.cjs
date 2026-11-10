'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studioFlowDesktop', Object.freeze({
    getStatus: () => ipcRenderer.invoke('studio-flow:get-status'),
    stageReferences: (references) => ipcRenderer.invoke('studio-flow:stage-references', references),
    handoffTask: (task, stagingId, authContext) => ipcRenderer.invoke('studio-flow:handoff-task', task, stagingId, authContext),
    getUpdateState: () => ipcRenderer.invoke('studio-flow:get-update-state'),
    downloadUpdate: () => ipcRenderer.invoke('studio-flow:download-update'),
    onUpdateState: (callback) => {
        if (typeof callback !== 'function') return;
        ipcRenderer.on('studio-flow:update-state', (_event, payload) => callback(payload));
    },
    onOutputImported: (callback) => {
        if (typeof callback !== 'function') return;
        ipcRenderer.on('studio-flow:output-imported', (_event, payload) => callback(payload));
    }
}));
