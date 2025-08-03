import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  ssh: {
    generateKey: (params: { name: string; type: string; comment: string }) => Promise<any>
    listKeys: () => Promise<any>
    deleteKey: (keyPath: string) => Promise<any>
    getKnownHosts: () => Promise<any>
    removeKnownHost: (hostPattern: string) => Promise<any>
    startPortForward: (params: any) => Promise<any>
    openTerminal: (params: { host: string; username: string; keyPath?: string }) => Promise<any>
    loadConnections: () => Promise<any>
    saveConnections: (connections: any[]) => Promise<any>
  }
  file: {
    readText: (filePath: string) => Promise<any>
  }
}

const electronAPI: ElectronAPI = {
  ssh: {
    generateKey: (params) => ipcRenderer.invoke('ssh:generateKey', params),
    listKeys: () => ipcRenderer.invoke('ssh:listKeys'),
    deleteKey: (keyPath) => ipcRenderer.invoke('ssh:deleteKey', keyPath),
    getKnownHosts: () => ipcRenderer.invoke('ssh:getKnownHosts'),
    removeKnownHost: (hostPattern) => ipcRenderer.invoke('ssh:removeKnownHost', hostPattern),
    startPortForward: (params) => ipcRenderer.invoke('ssh:startPortForward', params),
    openTerminal: (params) => ipcRenderer.invoke('ssh:openTerminal', params),
    loadConnections: () => ipcRenderer.invoke('ssh:loadConnections'),
    saveConnections: (connections) => ipcRenderer.invoke('ssh:saveConnections', connections),
  },
  file: {
    readText: (filePath) => ipcRenderer.invoke('file:readText', filePath),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)