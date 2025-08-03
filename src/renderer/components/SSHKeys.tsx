import React, { useState, useEffect } from 'react'
import Modal from './Modal'

interface SSHKey {
  name: string
  path: string
  isPublic: boolean
  size: number
  modified: Date
}

function SSHKeys() {
  const [keys, setKeys] = useState<SSHKey[]>([])
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadKeys = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.ssh.listKeys()
      if (result.success) {
        setKeys(result.keys.map((key: any) => ({
          ...key,
          modified: new Date(key.modified)
        })))
      }
    } catch (error) {
      console.error('Failed to load keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKey = async (keyPath: string) => {
    if (!confirm('确定要删除这个SSH密钥吗？')) return
    
    try {
      const result = await window.electronAPI.ssh.deleteKey(keyPath)
      if (result.success) {
        await loadKeys()
      } else {
        alert('删除失败: ' + result.error)
      }
    } catch (error) {
      alert('删除失败: ' + error)
    }
  }

  const handleViewKey = async (keyPath: string) => {
    try {
      const result = await window.electronAPI.file.readText(keyPath)
      if (result.success) {
        alert(result.content)
      } else {
        alert('读取失败: ' + result.error)
      }
    } catch (error) {
      alert('读取失败: ' + error)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [])

  return (
    <div>
      <div className="header">
        <h1>SSH密钥管理</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setIsGenerateModalOpen(true)}
        >
          生成新密钥
        </button>
      </div>

      <div className="card">
        <h2>密钥列表</h2>
        {loading ? (
          <p>加载中...</p>
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔑</div>
            <p>暂无SSH密钥</p>
            <p>点击上方按钮生成新的SSH密钥</p>
          </div>
        ) : (
          <div>
            {keys.map((key, index) => (
              <div key={index} className="list-item">
                <div className="list-item-info">
                  <div className="list-item-title">
                    {key.name} {key.isPublic && '(公钥)'}
                  </div>
                  <div className="list-item-subtitle">
                    大小: {key.size} bytes | 修改时间: {key.modified.toLocaleString()}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleViewKey(key.path)}
                  >
                    查看
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteKey(key.path)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isGenerateModalOpen && (
        <GenerateKeyModal
          onClose={() => setIsGenerateModalOpen(false)}
          onGenerated={loadKeys}
        />
      )}
    </div>
  )
}

interface GenerateKeyModalProps {
  onClose: () => void
  onGenerated: () => void
}

function GenerateKeyModal({ onClose, onGenerated }: GenerateKeyModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState('rsa')
  const [comment, setComment] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!name.trim()) {
      alert('请输入密钥名称')
      return
    }

    setGenerating(true)
    try {
      const result = await window.electronAPI.ssh.generateKey({
        name: name.trim(),
        type,
        comment: comment.trim() || `${type}-key-${Date.now()}`
      })

      if (result.success) {
        alert('SSH密钥生成成功！')
        onGenerated()
        onClose()
      } else {
        alert('生成失败: ' + result.error)
      }
    } catch (error) {
      alert('生成失败: ' + error)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Modal title="生成SSH密钥" onClose={onClose}>
      <div className="form-group">
        <label>密钥名称</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: id_rsa_work"
        />
      </div>

      <div className="form-group">
        <label>密钥类型</label>
        <select
          className="form-control select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="rsa">RSA</option>
          <option value="ed25519">Ed25519</option>
          <option value="ecdsa">ECDSA</option>
        </select>
      </div>

      <div className="form-group">
        <label>注释 (可选)</label>
        <input
          type="text"
          className="form-control"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="例如: work@company.com"
        />
      </div>

      <div className="modal-footer">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? '生成中...' : '生成'}
        </button>
      </div>
    </Modal>
  )
}

export default SSHKeys