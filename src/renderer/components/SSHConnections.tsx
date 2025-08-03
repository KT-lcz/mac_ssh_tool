import React, { useState, useEffect } from 'react'
import Modal from './Modal'

interface SSHConnection {
  id: string
  name: string
  hostname: string
  user: string
  port: number
  identityFile?: string
}

function SSHConnections() {
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load connections on component mount
  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const result = await window.electronAPI.ssh.loadConnections()
      if (result.success) {
        setConnections(result.connections)
      }
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveConnections = async (newConnections: SSHConnection[]) => {
    try {
      const result = await window.electronAPI.ssh.saveConnections(newConnections)
      if (!result.success) {
        console.error('Failed to save connections:', result.error)
        alert('保存连接配置失败: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to save connections:', error)
      alert('保存连接配置失败: ' + error)
    }
  }

  const handleAddConnection = async (connection: Omit<SSHConnection, 'id'>) => {
    const newConnection: SSHConnection = {
      ...connection,
      id: Date.now().toString()
    }
    const updatedConnections = [...connections, newConnection]
    setConnections(updatedConnections)
    await saveConnections(updatedConnections)
  }

  const handleConnect = async (connection: SSHConnection) => {
    try {
      const result = await window.electronAPI.ssh.openTerminal({
        host: connection.port !== 22 ? `${connection.hostname}:${connection.port}` : connection.hostname,
        username: connection.user,
        keyPath: connection.identityFile
      })

      if (result.success) {
        // Terminal will open automatically
      } else {
        alert('连接失败: ' + result.error)
      }
    } catch (error) {
      alert('连接失败: ' + error)
    }
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('确定要删除这个SSH连接配置吗？')) return
    const updatedConnections = connections.filter(c => c.id !== connectionId)
    setConnections(updatedConnections)
    await saveConnections(updatedConnections)
  }

  const handleEditConnection = (connection: SSHConnection) => {
    // For now, just show the connection details in an alert
    const details = [
      `名称: ${connection.name}`,
      `主机: ${connection.hostname}`,
      `端口: ${connection.port}`,
      `用户名: ${connection.user}`,
      connection.identityFile ? `密钥: ${connection.identityFile}` : '密钥: 无'
    ].join('\n')
    
    alert(details)
  }

  return (
    <div>
      <div className="header">
        <h1>SSH连接</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          添加连接
        </button>
      </div>

      <div className="card">
        <h2>连接列表</h2>
        {isLoading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <p>正在加载连接配置...</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <p>暂无SSH连接配置</p>
            <p>点击上方按钮添加新的SSH连接</p>
          </div>
        ) : (
          <div>
            {connections.map((connection) => (
              <div key={connection.id} className="list-item">
                <div className="list-item-info">
                  <div className="list-item-title">{connection.name}</div>
                  <div className="list-item-subtitle">
                    {connection.user}@{connection.hostname}:{connection.port}
                    {connection.identityFile && ` (密钥: ${connection.identityFile.split('/').pop()})`}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => handleConnect(connection)}
                  >
                    连接
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleEditConnection(connection)}
                  >
                    查看
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteConnection(connection.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>说明</h2>
        <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
          <li>点击"连接"按钮会在macOS终端中打开SSH连接</li>
          <li>如果配置了SSH密钥，会自动使用密钥进行认证</li>
          <li>可以保存常用的SSH连接配置，方便快速连接</li>
        </ul>
      </div>

      {isAddModalOpen && (
        <AddConnectionModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddConnection}
        />
      )}
    </div>
  )
}

interface AddConnectionModalProps {
  onClose: () => void
  onAdd: (connection: Omit<SSHConnection, 'id'>) => void
}

function AddConnectionModal({ onClose, onAdd }: AddConnectionModalProps) {
  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [user, setUser] = useState('')
  const [port, setPort] = useState('22')
  const [identityFile, setIdentityFile] = useState('')

  const handleSubmit = () => {
    if (!name || !hostname || !user) {
      alert('请填写必要字段：名称、主机、用户名')
      return
    }

    const portNum = parseInt(port)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      alert('请输入有效的端口号 (1-65535)')
      return
    }

    onAdd({
      name,
      hostname,
      user,
      port: portNum,
      identityFile: identityFile || undefined
    })
    onClose()
  }

  return (
    <Modal title="添加SSH连接" onClose={onClose}>
      <div className="form-group">
        <label>连接名称</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: 生产服务器"
        />
      </div>

      <div className="form-group">
        <label>主机地址</label>
        <input
          type="text"
          className="form-control"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="例如: server.example.com 或 192.168.1.100"
        />
      </div>

      <div className="form-group">
        <label>用户名</label>
        <input
          type="text"
          className="form-control"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="例如: root 或 ubuntu"
        />
      </div>

      <div className="form-group">
        <label>端口</label>
        <input
          type="number"
          className="form-control"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="默认: 22"
        />
      </div>

      <div className="form-group">
        <label>SSH密钥路径 (可选)</label>
        <input
          type="text"
          className="form-control"
          value={identityFile}
          onChange={(e) => setIdentityFile(e.target.value)}
          placeholder="例如: ~/.ssh/id_rsa"
        />
      </div>

      <div className="modal-footer">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          添加
        </button>
      </div>
    </Modal>
  )
}

export default SSHConnections