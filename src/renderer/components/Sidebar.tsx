import React from 'react'
import { TabType } from '../App'

interface SidebarProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const sidebarItems = [
  { id: 'keys' as TabType, label: 'SSH密钥', icon: '🔑' },
  { id: 'hosts' as TabType, label: 'Known Hosts', icon: '🖥️' },
  { id: 'forwarding' as TabType, label: '端口转发', icon: '🔄' },
  { id: 'connections' as TabType, label: 'SSH连接', icon: '🔗' },
]

function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <nav className="sidebar">
      {sidebarItems.map(item => (
        <button
          key={item.id}
          className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <span className="sidebar-item-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}

export default Sidebar