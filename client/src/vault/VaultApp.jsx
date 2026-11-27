import { Link, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { VaultProvider, useVault } from './VaultContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Icon from './components/Icon.jsx';
import ReverifyDialog from './components/ReverifyDialog.jsx';
import ConflictDialog from './components/ConflictDialog.jsx';
import ThemeToggle from '../components/common/ThemeToggle.jsx';
import Loader from '../components/common/Loader.jsx';
import VaultSetup from './pages/VaultSetup.jsx';
import VaultUnlock from './pages/VaultUnlock.jsx';
import ItemsPage from './pages/ItemsPage.jsx';
import SharedPage from './pages/SharedPage.jsx';
import TrashPage from './pages/TrashPage.jsx';
import HealthPage from './pages/HealthPage.jsx';
import SettingsPage, { ChangePasswordForm } from './pages/SettingsPage.jsx';
import LinkApprove from './pages/LinkApprove.jsx';
import './vault.css';

function TopBar({ unlocked }) {
  const { lock, offline, pendingOps, items, shared } = useVault();
  const { pathname } = useLocation();
  // "Items" stays highlighted on the item, edit and new routes
  const onItems = !/^\/vault\/(shared|health|trash|settings)/.test(pathname);
  const trashCount = items.filter(i => i.deletedAt).length;
  return (
    <header className="v-top">
      <div className="vault-strip" />
      <div className="v-top-row">
        <Link to="/" className="v-btn icon ghost" aria-label="Back to Notespace home"><Icon name="home" /></Link>
        <span className="v-brand"><Icon name="shield" size={20} /> Vault</span>
        <span className="v-spacer" />
        {offline && <span className="v-status warn" role="status"><Icon name="cloudOff" size={14} /> Offline{pendingOps ? ` · ${pendingOps} to sync` : ''}</span>}
        {!offline && pendingOps > 0 && <span className="v-status" role="status"><Icon name="refresh" size={14} /> Syncing {pendingOps}</span>}
        <ThemeToggle />
        {unlocked && (
          <button type="button" className="v-btn" onClick={() => lock('manual')}>
            <Icon name="lock" size={16} /> <span>Lock</span>
          </button>
        )}
      </div>
      {unlocked && (
        <nav className="v-tabs" aria-label="Vault sections">
          <Link to="/vault" className="v-tab" aria-current={onItems ? 'page' : undefined}>
            <Icon name="key" size={16} /> Items
          </Link>
          <NavLink to="/vault/shared" className="v-tab"><Icon name="users" size={16} /> Shared with me {shared.length > 0 && <span className="count tnum">{shared.length}</span>}</NavLink>
          <NavLink to="/vault/health" className="v-tab"><Icon name="pulse" size={16} /> Health</NavLink>
          <NavLink to="/vault/trash" className="v-tab"><Icon name="trash" size={16} /> Trash {trashCount > 0 && <span className="count tnum">{trashCount}</span>}</NavLink>
          <NavLink to="/vault/settings" className="v-tab"><Icon name="settings" size={16} /> Settings</NavLink>
        </nav>
      )}
    </header>
  );
}

function ForcedReset() {
  return (
    <div className="v-center">
      <div className="v-card" style={{ maxWidth: 560 }}>
        <div className="v-panel">
          <div className="v-lockmark"><Icon name="key" size={26} /></div>
          <h1 className="v-h1">Set a new master password</h1>
          <p className="v-sub" style={{ marginBottom: 20 }}>You opened the vault with your recovery key. Choose a new master password before continuing. Your recovery key keeps working.</p>
          <ChangePasswordForm forced />
        </div>
      </div>
    </div>
  );
}

function Body() {
  const { phase, loadError, refreshStatus, mustResetPassword, reverify, conflicts } = useVault();
  const unlocked = phase === 'unlocked';

  let content;
  if (phase === 'loading') content = <Loader fullScreen />;
  else if (phase === 'error') {
    content = (
      <div className="v-center">
        <div className="v-card v-panel v-empty">
          <Icon name="warning" size={30} />
          <div className="v-h2">Couldn't open the vault</div>
          <div>{loadError}</div>
          <button type="button" className="v-btn primary" onClick={refreshStatus}>Try again</button>
        </div>
      </div>
    );
  } else if (phase === 'nosetup') content = <VaultSetup />;
  else if (phase === 'locked') content = <VaultUnlock />;
  else if (mustResetPassword) content = <ForcedReset />;
  else {
    content = (
      <main className="v-main" id="vault-main">
        <Routes>
          <Route index element={<ItemsPage mode="list" />} />
          <Route path="new" element={<ItemsPage mode="new" />} />
          <Route path="item/:id" element={<ItemsPage mode="view" />} />
          <Route path="item/:id/edit" element={<ItemsPage mode="edit" />} />
          <Route path="shared" element={<SharedPage />} />
          <Route path="shared/:shareId" element={<SharedPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="link" element={<LinkApprove />} />
          <Route path="*" element={<Navigate to="/vault" replace />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="vault">
      <TopBar unlocked={unlocked && !mustResetPassword} />
      {content}
      {unlocked && reverify && <ReverifyDialog key={reverify.reason + String(!!reverify.passwordOnly)} />}
      {unlocked && !reverify && conflicts[0] && <ConflictDialog key={conflicts[0].id} conflict={conflicts[0]} />}
    </div>
  );
}

export default function VaultApp() {
  return (
    <VaultProvider>
      <ToastProvider>
        <Body />
      </ToastProvider>
    </VaultProvider>
  );
}
