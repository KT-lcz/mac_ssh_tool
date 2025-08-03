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

// SSH Config Management
const getSSHConfigPath = () => path.join(os.homedir(), '.ssh', 'config')

// Standalone function to read SSH config file
async function readSSHConfigFile(): Promise<{ success: boolean; content?: string; error?: string; path: string }> {
  const configPath = getSSHConfigPath()
  
  try {
    await fs.access(configPath, fs.constants.F_OK | fs.constants.R_OK)
    const content = await fs.readFile(configPath, 'utf-8')
    
    return {
      success: true,
      content,
      path: configPath
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      path: configPath
    }
  }
}

interface SSHConfigHost {
  id: string
  name: string
  hostname: string
  user: string
  port: number
  identityFile?: string
}

// Parse SSH config file
const parseSSHConfig = (content: string): SSHConfigHost[] => {
  const hosts: SSHConfigHost[] = []
  const lines = content.split('\n')
  let currentHost: Partial<SSHConfigHost> | null = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue
    
    // Split by whitespace and get key/value
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    
    const key = parts[0].toLowerCase()
    const value = parts.slice(1).join(' ')
    
    if (key === 'host') {
      // Save previous host if exists and has required fields
      if (currentHost && currentHost.name && currentHost.hostname) {
        hosts.push({
          id: currentHost.name,
          name: currentHost.name,
          hostname: currentHost.hostname,
          user: currentHost.user || 'root',
          port: currentHost.port || 22,
          identityFile: currentHost.identityFile
        })
      }
      
      // Start new host - skip wildcards like '*'
      if (value && !value.includes('*') && !value.includes('?')) {
        currentHost = { name: value }
      } else {
        currentHost = null
      }
    } else if (currentHost) {
      switch (key) {
        case 'hostname':
          currentHost.hostname = value
          break
        case 'user':
          currentHost.user = value
          break
        case 'port':
          currentHost.port = parseInt(value) || 22
          break
        case 'identityfile':
          // Expand ~ to home directory
          currentHost.identityFile = value.startsWith('~') 
            ? value.replace('~', os.homedir()) 
            : value
          break
      }
    }
  }
  
  // Save last host if valid
  if (currentHost && currentHost.name && currentHost.hostname) {
    hosts.push({
      id: currentHost.name,
      name: currentHost.name,
      hostname: currentHost.hostname,
      user: currentHost.user || 'root',
      port: currentHost.port || 22,
      identityFile: currentHost.identityFile
    })
  }
  
  return hosts
}

// Generate SSH config content
const generateSSHConfig = (hosts: SSHConfigHost[], existingContent: string = ''): string => {
  const lines = existingContent.split('\n')
  const preservedLines: string[] = []
  let currentlyInManagedSection = false
  let skipCurrentHost = false
  
  // Parse existing content and preserve non-managed sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim().toLowerCase()
    
    // Check if we're entering the managed section
    if (trimmed.includes('ssh manager') && trimmed.includes('managed hosts')) {
      currentlyInManagedSection = true
      continue
    }
    
    // Skip managed section content
    if (currentlyInManagedSection) {
      continue
    }
    
    // Check if this is a host that might be managed by us
    if (trimmed.startsWith('host ')) {
      const hostName = line.trim().substring(5).trim()
      skipCurrentHost = hosts.some(h => h.name === hostName)
      
      if (!skipCurrentHost) {
        preservedLines.push(line)
      }
    } else if (skipCurrentHost && (trimmed.startsWith('hostname') || trimmed.startsWith('user') || trimmed.startsWith('port') || trimmed.startsWith('identityfile'))) {
      // Skip these lines as they belong to a managed host
      continue
    } else if (trimmed.startsWith('host ') || (!trimmed.startsWith(' ') && !trimmed.startsWith('\t') && trimmed !== '')) {
      // New section starts, stop skipping
      skipCurrentHost = false
      if (!trimmed.startsWith('host ') || !hosts.some(h => h.name === line.trim().substring(5).trim())) {
        preservedLines.push(line)
      }
    } else if (!skipCurrentHost) {
      preservedLines.push(line)
    }
  }
  
  // Remove trailing empty lines from preserved content
  while (preservedLines.length > 0 && preservedLines[preservedLines.length - 1].trim() === '') {
    preservedLines.pop()
  }
  
  // Build final config
  let config = preservedLines.length > 0 ? preservedLines.join('\n') + '\n\n' : ''
  
  // Add managed hosts section
  if (hosts.length > 0) {
    config += '# SSH Manager - Managed Hosts\n'
    config += '# Do not edit this section manually\n\n'
    
    for (const host of hosts) {
      config += `Host ${host.name}\n`
      config += `    HostName ${host.hostname}\n`
      config += `    User ${host.user}\n`
      if (host.port !== 22) {
        config += `    Port ${host.port}\n`
      }
      if (host.identityFile) {
        // Convert absolute paths back to ~ notation if in home directory
        const homePath = os.homedir()
        const displayPath = host.identityFile.startsWith(homePath) 
          ? host.identityFile.replace(homePath, '~')
          : host.identityFile
        config += `    IdentityFile ${displayPath}\n`
      }
      config += '\n'
    }
  }
  
  return config
}

// Updated loadConnections to use the standalone read function
ipcMain.handle('ssh:loadConnections', async () => {
  const readResult = await readSSHConfigFile()
  if (!readResult.success) {
    return { success: true, connections: [] }
  }
  
  try {
    const connections = parseSSHConfig(readResult.content!)
    return { success: true, connections }
  } catch (error) {
    return { success: true, connections: [] }
  }
})

ipcMain.handle('ssh:saveConnections', async (_, connections: SSHConfigHost[]) => {
  try {
    const configPath = getSSHConfigPath()
    const sshDir = path.dirname(configPath)
    
    // Ensure .ssh directory exists
    await fs.mkdir(sshDir, { recursive: true })
    
    // Read existing config to preserve non-managed entries
    let existingContent = ''
    try {
      existingContent = await fs.readFile(configPath, 'utf-8')
    } catch (error) {
      // File doesn't exist, that's ok
    }
    
    // Generate new config content
    const newContent = generateSSHConfig(connections, existingContent)
    
    // Save to file
    await fs.writeFile(configPath, newContent)
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