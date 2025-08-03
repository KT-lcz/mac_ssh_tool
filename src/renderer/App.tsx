import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import SSHKeys from './components/SSHKeys'
import KnownHosts from './components/KnownHosts'
import PortForwarding from './components/PortForwarding'
import SSHConnections from './components/SSHConnections'

export type TabType = 'keys' | 'hosts' | 'forwarding' | 'connections'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('keys')

  const renderContent = () => {
    switch (activeTab) {
      case 'keys':
        return <SSHKeys />
      case 'hosts':
        return <KnownHosts />
      case 'forwarding':
        return <PortForwarding />
      case 'connections':
        return <SSHConnections />
      default:
        return <SSHKeys />
    }
  }

  return (
    <div className="app">
      <div className="app-titlebar">
        SSH Manager
      </div>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  )
}

export default App