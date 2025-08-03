import React, { useState, useEffect } from 'react'

interface KnownHost {
  id: number
  line: string
  host: string
}

function KnownHosts() {
  const [hosts, setHosts] = useState<KnownHost[]>([])
  const [loading, setLoading] = useState(false)

  const loadKnownHosts = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.ssh.getKnownHosts()
      if (result.success) {
        setHosts(result.hosts)
      }
    } catch (error) {
      console.error('Failed to load known hosts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveHost = async (hostPattern: string) => {
    if (!confirm(`确定要删除主机 "${hostPattern}" 吗？`)) return
    
    try {
      const result = await window.electronAPI.ssh.removeKnownHost(hostPattern)
      if (result.success) {
        await loadKnownHosts()
        alert('主机已删除')
      } else {
        alert('删除失败: ' + result.error)
      }
    } catch (error) {
      alert('删除失败: ' + error)
    }
  }

  useEffect(() => {
    loadKnownHosts()
  }, [])

  return (
    <div>
      <div className="header">
        <h1>Known Hosts 管理</h1>
        <button className="btn btn-primary" onClick={loadKnownHosts}>
          刷新列表
        </button>
      </div>

      <div className="card">
        <h2>已知主机列表</h2>
        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
          这里显示 ~/.ssh/known_hosts 文件中的所有主机记录
        </p>
        
        {loading ? (
          <p>加载中...</p>
        ) : hosts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🖥️</div>
            <p>暂无已知主机</p>
            <p>当您首次连接SSH服务器时，主机记录会自动添加到这里</p>
          </div>
        ) : (
          <div>
            {hosts.map((host) => (
              <div key={host.id} className="list-item">
                <div className="list-item-info">
                  <div className="list-item-title">{host.host}</div>
                  <div 
                    className="list-item-subtitle" 
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '11px',
                      maxWidth: '500px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {host.line}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button
                    className="btn btn-danger"
                    onClick={() => handleRemoveHost(host.host)}
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
          <li>Known Hosts 文件存储SSH服务器的公钥指纹</li>
          <li>删除主机记录后，下次连接时需要重新确认服务器身份</li>
          <li>如果服务器密钥发生变化，您可能需要删除旧的记录</li>
        </ul>
      </div>
    </div>
  )
}

export default KnownHosts