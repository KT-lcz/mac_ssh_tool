import React, { useState } from 'react'
import Modal from './Modal'

interface PortForwardingRule {
  id: string
  localPort: string
  remoteHost: string
  remotePort: string
  sshHost: string
  username: string
  keyPath?: string
  status: 'active' | 'inactive'
  pid?: number
}

function PortForwarding() {
  const [rules, setRules] = useState<PortForwardingRule[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const handleAddRule = (rule: Omit<PortForwardingRule, 'id' | 'status'>) => {
    const newRule: PortForwardingRule = {
      ...rule,
      id: Date.now().toString(),
      status: 'inactive'
    }
    setRules(prev => [...prev, newRule])
  }

  const handleStartForwarding = async (rule: PortForwardingRule) => {
    try {
      const result = await window.electronAPI.ssh.startPortForward({
        localPort: rule.localPort,
        remoteHost: rule.remoteHost,
        remotePort: rule.remotePort,
        sshHost: rule.sshHost,
        username: rule.username,
        keyPath: rule.keyPath
      })

      if (result.success) {
        setRules(prev => prev.map(r => 
          r.id === rule.id 
            ? { ...r, status: 'active' as const, pid: result.pid }
            : r
        ))
        alert('端口转发已启动')
      } else {
        alert('启动失败: ' + result.error)
      }
    } catch (error) {
      alert('启动失败: ' + error)
    }
  }

  const handleStopForwarding = async (rule: PortForwardingRule) => {
    if (rule.pid) {
      try {
        // Kill the process
        await new Promise<void>((resolve, reject) => {
          const { exec } = require('child_process')
          exec(`kill ${rule.pid}`, (error: any) => {
            if (error) reject(error)
            else resolve()
          })
        })
        
        setRules(prev => prev.map(r => 
          r.id === rule.id 
            ? { ...r, status: 'inactive' as const, pid: undefined }
            : r
        ))
        alert('端口转发已停止')
      } catch (error) {
        alert('停止失败: ' + error)
      }
    }
  }

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm('确定要删除这个转发规则吗？')) return
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  return (
    <div>
      <div className="header">
        <h1>本地端口转发</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          添加转发规则
        </button>
      </div>

      <div className="card">
        <h2>转发规则列表</h2>
        {rules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔄</div>
            <p>暂无端口转发规则</p>
            <p>点击上方按钮添加新的转发规则</p>
          </div>
        ) : (
          <div>
            {rules.map((rule) => (
              <div key={rule.id} className="list-item">
                <div className="list-item-info">
                  <div className="list-item-title">
                    localhost:{rule.localPort} → {rule.remoteHost}:{rule.remotePort}
                  </div>
                  <div className="list-item-subtitle">
                    通过 {rule.username}@{rule.sshHost}
                    {rule.keyPath && ` (使用密钥: ${rule.keyPath.split('/').pop()})`}
                  </div>
                  <span className={`status-badge ${rule.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                    {rule.status === 'active' ? '运行中' : '已停止'}
                  </span>
                </div>
                <div className="list-item-actions">
                  {rule.status === 'inactive' ? (
                    <button
                      className="btn btn-success"
                      onClick={() => handleStartForwarding(rule)}
                    >
                      启动
                    </button>
                  ) : (
                    <button
                      className="btn btn-warning"
                      onClick={() => handleStopForwarding(rule)}
                    >
                      停止
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteRule(rule.id)}
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
          <li>本地端口转发将本地端口的流量转发到远程服务器</li>
          <li>格式: localhost:本地端口 → 远程主机:远程端口</li>
          <li>需要提供SSH服务器信息和认证方式</li>
          <li>启动后可在本地访问 localhost:本地端口 来访问远程服务</li>
        </ul>
      </div>

      {isAddModalOpen && (
        <AddRuleModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddRule}
        />
      )}
    </div>
  )
}

interface AddRuleModalProps {
  onClose: () => void
  onAdd: (rule: Omit<PortForwardingRule, 'id' | 'status'>) => void
}

function AddRuleModal({ onClose, onAdd }: AddRuleModalProps) {
  const [localPort, setLocalPort] = useState('')
  const [remoteHost, setRemoteHost] = useState('')
  const [remotePort, setRemotePort] = useState('')
  const [sshHost, setSshHost] = useState('')
  const [username, setUsername] = useState('')
  const [keyPath, setKeyPath] = useState('')

  const handleSubmit = () => {
    if (!localPort || !remoteHost || !remotePort || !sshHost || !username) {
      alert('请填写所有必要字段')
      return
    }

    onAdd({
      localPort,
      remoteHost,
      remotePort,
      sshHost,
      username,
      keyPath: keyPath || undefined
    })
    onClose()
  }

  return (
    <Modal title="添加端口转发规则" onClose={onClose}>
      <div className="form-group">
        <label>本地端口</label>
        <input
          type="number"
          className="form-control"
          value={localPort}
          onChange={(e) => setLocalPort(e.target.value)}
          placeholder="例如: 8080"
        />
      </div>

      <div className="form-group">
        <label>远程主机</label>
        <input
          type="text"
          className="form-control"
          value={remoteHost}
          onChange={(e) => setRemoteHost(e.target.value)}
          placeholder="例如: localhost 或 database.example.com"
        />
      </div>

      <div className="form-group">
        <label>远程端口</label>
        <input
          type="number"
          className="form-control"
          value={remotePort}
          onChange={(e) => setRemotePort(e.target.value)}
          placeholder="例如: 3306"
        />
      </div>

      <div className="form-group">
        <label>SSH服务器</label>
        <input
          type="text"
          className="form-control"
          value={sshHost}
          onChange={(e) => setSshHost(e.target.value)}
          placeholder="例如: server.example.com"
        />
      </div>

      <div className="form-group">
        <label>用户名</label>
        <input
          type="text"
          className="form-control"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="例如: root"
        />
      </div>

      <div className="form-group">
        <label>SSH密钥路径 (可选)</label>
        <input
          type="text"
          className="form-control"
          value={keyPath}
          onChange={(e) => setKeyPath(e.target.value)}
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

export default PortForwarding