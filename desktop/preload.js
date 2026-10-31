const {
    contextBridge,
    ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld('workTrackerDesktop', {
    setupLocalAi: () =>
        ipcRenderer.invoke('worktracker:setup-local-ai')
});