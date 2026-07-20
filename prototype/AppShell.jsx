/* Wedding Hub — App Shell (Sidebar + Mobile Tab Bar + Dark Mode + View-as) */

const VIEWERS = [
  { id:'jamie',   name:'Jamie Spencer',        role:'Groom',         couple:true,  initial:'J' },
  { id:'bryony',  name:'Bryony Olwyn-Davis',   role:'Bride',         couple:true,  initial:'B' },
  { id:'josh',    name:'Joshua Dickson',       role:'Best Man',      couple:false, initial:'J' },
  { id:'aimee',   name:'Aimee Hollingsworth',  role:'Maid of Honour',couple:false, initial:'A' },
  { id:'planner', name:'Bespoke Weddings',     role:'Planner',       couple:false, initial:'P' },
];

const NAV_GROUPS_BASE = [
  {
    id: 'daily', items: [
      { id: 'today',       label: 'Today',        icon: '◉' },
      { id: 'glance',      label: 'At a Glance',  icon: '⊡' },
    ]
  },
  {
    id: 'work', items: [
      { id: 'tasks',       label: 'Tasks',        icon: '✓' },
      { id: 'questions',   label: 'Questions',    icon: '?' },
      { id: 'schedule',    label: 'Schedule',     icon: '◷' },
      { id: 'suppliers',   label: 'Suppliers',    icon: '◈' },
    ]
  },
  {
    id: 'people', items: [
      { id: 'guests',      label: 'Guests',       icon: '◎' },
      { id: 'seating',     label: 'Seating',      icon: '⊛' },
      { id: 'songs',       label: 'Songs',        icon: '♪' },
      { id: 'book',        label: 'Wedding Book', icon: '◧' },
    ]
  },
  {
    id: 'money', items: [
      { id: 'budget',      label: 'Budget',       icon: '◫', coupleOnly: true },
      { id: 'payments',    label: 'Payments',     icon: '◻', coupleOnly: true },
    ]
  },
  {
    id: 'docs', items: [
      { id: 'files',       label: 'Files',        icon: '◰' },
    ]
  },
];

// Counts surface from real data globals when present
const computeCounts = (viewer) => {
  const isCouple = viewer && viewer.couple;
  const allTasks = window.TASKS_DATA || [];
  const tasks = isCouple ? allTasks : allTasks.filter(t => t.category !== 'Budget');
  const guests = window.GUESTS_DATA || [];
  const payments = window.PAYMENTS_DATA || [];
  const questions = window.QUESTIONS_DATA || [];
  const files = window.FILES_DATA || [];
  return {
    tasks: tasks.filter(t => t.status !== 'DONE').length,
    questions: questions.filter(q => q.status === 'OPEN').length,
    guests: guests.filter(g => g.rsvp === 'PENDING').length,
    payments: payments.filter(p => p.status !== 'PAID').length,
    suppliers: 11,
    files: files.length || undefined,
  };
};

const MOBILE_TABS = [
  { id: 'today',   label: 'Today',  icon: '◉' },
  { id: 'tasks',   label: 'Tasks',  icon: '✓' },
  { id: 'guests',  label: 'Guests', icon: '◎' },
  { id: 'more',    label: 'More',   icon: '···' },
];

const AppShell = ({ currentPage, onNavigate, dark, onToggleDark, viewer, onViewerChange, children }) => {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const counts = computeCounts(viewer);

  // Filter nav by viewer permission
  const navGroups = NAV_GROUPS_BASE.map(g => ({
    ...g,
    items: g.items.filter(item => !item.coupleOnly || (viewer && viewer.couple))
  })).filter(g => g.items.length > 0);

  React.useEffect(() => {
    const handler = e => { if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !['INPUT','TEXTAREA'].includes(e.target.tagName)) setCaptureOpen(v => !v); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-canvas)', overflow: 'hidden' }}>
      <aside style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--bg-muted)', borderRight: '1px solid var(--border-soft)',
        display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      }} className="desktop-sidebar">
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--moss-700)', letterSpacing: '-0.01em' }}>
            Wedding Hub
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>Jamie & Bryony · 24 Sep 2026</div>
        </div>

        <nav style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {navGroups.map((group, gi) => (
            <React.Fragment key={group.id}>
              {gi > 0 && <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }}/>}
              {group.items.map(item => (
                <SidebarItem
                  key={item.id}
                  item={{ ...item, count: counts[item.id] }}
                  active={currentPage === item.id}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 12px', position: 'relative' }}>
          <button onClick={() => setAvatarOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-sm)',
            padding: '6px 8px', textAlign: 'left',
          }}>
            <Avatar name={viewer.name} size={28}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewer.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-tertiary)' }}>{viewer.role}{!viewer.couple && ' · viewing'}</div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--ink-tertiary)' }}>▾</span>
          </button>
          {avatarOpen && (
            <AvatarMenu
              dark={dark}
              viewer={viewer}
              onViewerChange={(v) => { onViewerChange(v); setAvatarOpen(false); }}
              onToggleDark={() => { onToggleDark(); setAvatarOpen(false); }}
              onNavigate={(p) => { onNavigate(p); setAvatarOpen(false); }}
              onClose={() => setAvatarOpen(false)}
            />
          )}
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!viewer.couple && (
          <div style={{ background: 'var(--marigold-100)', borderBottom: '1px solid var(--border-soft)', padding: '6px 16px', fontSize: 11, color: 'var(--marigold-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
            <span>👁</span> Viewing as <strong>{viewer.name}</strong> ({viewer.role}) — restricted pages hidden
          </div>
        )}
        {children}
      </main>

      <div className="mobile-tabbar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', height: 56, zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {MOBILE_TABS.map((tab, i) => {
          if (i === 1) return (
            <React.Fragment key="fab-wrap">
              <MobileTabItem tab={tab} active={currentPage === tab.id} onClick={() => onNavigate(tab.id)}/>
              <button onClick={() => setCaptureOpen(true)} style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%) translateY(-20px)',
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--moss-500)', color: '#fff', border: 'none',
                fontSize: 24, cursor: 'pointer', boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>+</button>
            </React.Fragment>
          );
          return <MobileTabItem key={tab.id} tab={tab} active={tab.id === 'more' ? moreOpen : currentPage === tab.id} onClick={() => { if (tab.id === 'more') setMoreOpen(v => !v); else onNavigate(tab.id); }}/>;
        })}
      </div>

      {moreOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setMoreOpen(false)}/>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '14px 14px 0 0', padding: '12px 0 24px', maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }}/>
            {navGroups.flatMap(g => g.items).filter(i => !['today','tasks','guests'].includes(i.id)).map(item => (
              <button key={item.id} onClick={() => { onNavigate(item.id); setMoreOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 15, color: currentPage === item.id ? 'var(--moss-500)' : 'var(--ink-primary)',
                fontFamily: 'var(--font-ui)',
              }}>
                <span style={{ width: 20, textAlign: 'center', opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '8px 0' }}/>
            <button onClick={() => onToggleDark()} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)' }}>
              <span style={{ width: 20, textAlign: 'center' }}>{dark ? '☀' : '☾'}</span>
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>
      )}

      {captureOpen && <QuickCapture onClose={() => setCaptureOpen(false)} />}
    </div>
  );
};

const SidebarItem = ({ item, active, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '6px 14px', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontSize: 13,
    color: active ? 'var(--moss-700)' : 'var(--ink-secondary)',
    fontWeight: active ? 600 : 400,
    borderLeft: active ? '3px solid var(--moss-500)' : '3px solid transparent',
    borderRadius: '0 var(--r-sm) var(--r-sm) 0',
    textAlign: 'left', transition: 'background 0.1s',
    background: active ? 'rgba(92,113,72,0.07)' : 'transparent',
  }}
  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-surface)'; }}
  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    <span style={{ width: 16, textAlign: 'center', fontSize: 12, opacity: 0.75 }}>{item.icon}</span>
    <span style={{ flex: 1 }}>{item.label}</span>
    {item.count != null && item.count > 0 && (
      <span style={{ fontSize: 10, color: active ? 'var(--moss-700)' : 'var(--ink-tertiary)', background: active ? 'rgba(92,113,72,0.12)' : 'var(--bg-canvas)', padding: '1px 6px', borderRadius: 8, border: '1px solid var(--border-soft)', fontWeight: active ? 600 : 500, minWidth: 18, textAlign: 'center' }}>{item.count}</span>
    )}
  </button>
);

const MobileTabItem = ({ tab, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, background: 'none', border: 'none', cursor: 'pointer', height: '100%',
    color: active ? 'var(--moss-500)' : 'var(--ink-tertiary)',
    fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: active ? 600 : 400,
  }}>
    <span style={{ fontSize: 18 }}>{tab.icon}</span>
    {tab.label}
  </button>
);

const AvatarMenu = ({ dark, viewer, onViewerChange, onToggleDark, onNavigate, onClose }) => {
  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  const menuStyle = {
    position: 'absolute', bottom: '100%', left: 0, right: 0,
    background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)',
    padding: '6px 0', zIndex: 200, marginBottom: 4, maxHeight: 480, overflow: 'auto',
  };
  const itemStyle = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', textAlign: 'left' };
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={onClose}/>
      <div style={menuStyle}>
        {/* View-as switcher */}
        <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>View as</div>
        {VIEWERS.map(v => (
          <button key={v.id} onClick={() => onViewerChange(v)} style={{...itemStyle, background: viewer.id === v.id ? 'var(--moss-50)' : 'none', color: viewer.id === v.id ? 'var(--moss-700)' : 'var(--ink-secondary)' }}>
            <Avatar name={v.name} size={20}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: viewer.id === v.id ? 600 : 500, color: 'inherit' }}>{v.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-tertiary)' }}>{v.role}{v.couple && ' · full access'}</div>
            </div>
            {viewer.id === v.id && <span style={{ color: 'var(--moss-500)' }}>✓</span>}
          </button>
        ))}
        <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }}/>
        <button style={itemStyle} onClick={onToggleDark}><span>{dark ? '☀' : '☾'}</span>{dark ? 'Light mode' : 'Dark mode'}</button>
        <button style={itemStyle} onClick={() => onNavigate('settings')}><span>⚙</span>Settings & Members</button>
      </div>
    </>
  );
};

const QuickCapture = ({ onClose }) => {
  const [type, setType] = React.useState('Task');
  const [what, setWhat] = React.useState('');
  const [step, setStep] = React.useState(1);
  const handleSubmit = () => { if (what.trim()) { setStep(2); setTimeout(() => { onClose(); }, 800); } };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose}/>
      <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 520, padding: 20 }}>
        {step === 1 ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What is this?</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {['Task','Question','Payment','Event'].map(t => (
                  <Tag key={t} label={t} active={type === t} onClick={() => setType(t)}/>
                ))}
              </div>
              <input autoFocus value={what} onChange={e => setWhat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={type === 'Task' ? 'Task name…' : type === 'Question' ? 'Ask a question…' : type === 'Payment' ? 'What is this payment for?' : 'Event name…'}
                style={{ width: '100%', fontSize: 15, padding: '10px 12px', border: '1.5px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)', outline: 'none' }}
              />
            </div>
            {what && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSubmit}>Add {type} →</Button>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 10 }}>Press Esc to dismiss · <kbd style={{ background: 'var(--bg-muted)', padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border-soft)' }}>C</kbd> shortcut anytime</div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--moss-500)', fontSize: 14 }}>✓ {type} added</div>
        )}
      </div>
    </div>
  );
};

const PageHeader = ({ title, subtitle, actions, tabs, activeTab, onTabChange }) => (
  <div style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0 }}>
    <div style={{ padding: '16px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
    {tabs && (
      <div style={{ display: 'flex', gap: 0, padding: '0 24px', marginTop: 4 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => onTabChange(t)} style={{
            padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontFamily: 'var(--font-ui)',
            color: activeTab === t ? 'var(--moss-700)' : 'var(--ink-tertiary)',
            fontWeight: activeTab === t ? 600 : 400,
            borderBottom: activeTab === t ? '2px solid var(--moss-500)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>
    )}
  </div>
);

Object.assign(window, { AppShell, SidebarItem, PageHeader, QuickCapture, VIEWERS });
