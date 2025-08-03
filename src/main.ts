import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as os from 'os'

const execAsync = promisify(exec)

let mainWindow: BrowserWindow

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    show: false,
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

// SSH Key Management
ipcMain.handle('ssh:generateKey', async (_, { name, type, comment }: { name: string; type: string; comment: string }) => {
  try {
    const sshDir = path.join(os.homedir(), '.ssh')
    const keyPath = path.join(sshDir, name)
    
    await fs.mkdir(sshDir, { recursive: true })
    
    const command = `ssh-keygen -t ${type} -f "${keyPath}" -C "${comment}" -N ""`
    await execAsync(command)
    
    return { success: true, path: keyPath }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('ssh:listKeys', async () => {
  try {
    const sshDir = path.join(os.homedir(), '.ssh')
    const files = await fs.readdir(sshDir)
    
    const keyFiles = files.filter(file => 
      !file.includes('.') || file.endsWith('.pub')
    ).filter(file => !file.startsWith('known_hosts') && !file.startsWith('config'))
    
    const keys = []
    for (const file of keyFiles) {
      const filePath = path.join(sshDir, file)
      const stats = await fs.stat(filePath)
      keys.push({
        name: file,
        path: filePath,
        isPublic: file.endsWith('.pub'),
        size: stats.size,
        modified: stats.mtime,
      })
    }
    
    return { success: true, keys }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('ssh:deleteKey', async (_, keyPath: string) => {
  try {
    await fs.unlink(keyPath)
    
    // Also try to delete the corresponding public/private key
    if (keyPath.endsWith('.pub')) {
      const privateKeyPath = keyPath.slice(0, -4)
      try {
        await fs.unlink(privateKeyPath)
      } catch {}
    } else {
      const publicKeyPath = keyPath + '.pub'
      try {
        await fs.unlink(publicKeyPath)
      } catch {}
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// Known Hosts Management
ipcMain.handle('ssh:getKnownHosts', async () => {
  try {
    const knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts')
    const content = await fs.readFile(knownHostsPath, 'utf-8')
    
    const hosts = content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map((line, index) => ({
        id: index,
        line: line.trim(),
        host: line.split(' ')[0],
      }))
    
    return { success: true, hosts }
  } catch (error) {
    return { success: false, error: (error as Error).message, hosts: [] }
  }
})

ipcMain.handle('ssh:removeKnownHost', async (_, hostPattern: string) => {
  try {
    const command = `ssh-keygen -R "${hostPattern}"`
    await execAsync(command)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// Port Forwarding
ipcMain.handle('ssh:startPortForward', async (_, { localPort, remoteHost, remotePort, sshHost, username, keyPath }: any) => {
  try {
    const command = `ssh -i "${keyPath}" -L ${localPort}:${remoteHost}:${remotePort} -N ${username}@${sshHost}`
    const child = exec(command)
    
    return { 
      success: true, 
      pid: child.pid,
      command 
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// Terminal Integration
ipcMain.handle('ssh:openTerminal', async (_, { host, username, keyPath }: any) => {
  try {
    const sshCommand = keyPath 
      ? `ssh -i "${keyPath}" ${username}@${host}`
      : `ssh ${username}@${host}`
    
    const command = `osascript -e 'tell application "Terminal" to do script "${sshCommand}"'`
    await execAsync(command)
    
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// File operations
ipcMain.handle('file:readText', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Create menu
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'SSH Manager',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
]

Menu.setApplicationMenu(Menu.buildFromTemplate(template))