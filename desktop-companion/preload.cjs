'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studioFlowDesktop', Object.freeze({
    getStatus: () => ipcRenderer.invoke('studio-flow:get-status'),
    stageReferences: (references) => ipcRenderer.invoke('studio-flow:stage-references', references),
    handoffTask: (task) => ipcRenderer.invoke('studio-flow:handoff-task', task)
}));
