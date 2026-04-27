/* Wedding Hub — UI Primitives
   Shared across all pages. Exported to window.
*/

// ── Button ─────────────────────────────────────────────────────────────────
const Button = ({ variant = 'primary', size = 'md', children, onClick, disabled, style }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'var(--font-ui)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', borderRadius: 'var(--r-sm)', transition: 'all 0.15s',
    opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
  };
  const sizes = {
    sm: { fontSize: 12, padding: '5px 10px' },
    md: { fontSize: 13, padding: '7px 14px' },
  };
  const variants = {
    primary:     { background: 'var(--moss-500)', color: '#fff' },
    secondary:   { background: 'var(--bg-muted)', color: 'var(--ink-primary)', border: '1px solid var(--border-soft)' },
    ghost:       { background: 'transparent', color: 'var(--ink-secondary)', border: '1px solid transparent' },
    destructive: { background: 'var(--status-danger)', color: '#fff' },
  };
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant], ...style }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

// ── StatusPill ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  YES:        { bg: 'var(--moss-50)',      color: 'var(--moss-700)',  border: 'var(--moss-100)' },
  NO:         { bg: '#f9efee',            color: 'var(--status-danger)', border: '#f0d5d3' },
  PENDING:    { bg: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '#f0d9a8' },
  BOOKED:     { bg: 'var(--moss-50)',      color: 'var(--moss-700)',  border: 'var(--moss-100)' },
  PAID:       { bg: '#eef4f5',            color: 'var(--status-info)', border: '#d0e4e8' },
  LEAD:       { bg: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '#f0d9a8' },
  DECLINED:   { bg: '#f9efee',            color: 'var(--status-danger)', border: '#f0d5d3' },
  TODO:       { bg: 'var(--bg-muted)',     color: 'var(--ink-secondary)', border: 'var(--border-soft)' },
  DOING:      { bg: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '#f0d9a8' },
  DONE:       { bg: 'var(--moss-50)',      color: 'var(--moss-700)',  border: 'var(--moss-100)' },
  SCHEDULED:  { bg: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '#f0d9a8' },
  OVERDUE:    { bg: '#f9efee',            color: 'var(--status-danger)', border: '#f0d5d3' },
  HIGH:       { bg: '#f9efee',            color: 'var(--status-danger)', border: '#f0d5d3' },
  MED:        { bg: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '#f0d9a8' },
  LOW:        { bg: 'var(--moss-50)',      color: 'var(--moss-700)',  border: 'var(--moss-100)' },
  ADULT:      { bg: 'var(--bg-muted)',     color: 'var(--ink-secondary)', border: 'var(--border-soft)' },
  CHILD:      { bg: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '#f0d9a8' },
};

const StatusPill = ({ status, label, size = 'sm' }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS['TODO'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: size === 'sm' ? 11 : 12, fontWeight: 500,
      padding: size === 'sm' ? '2px 7px' : '3px 9px',
      borderRadius: 'var(--r-sm)',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      letterSpacing: '0.01em',
    }}>
      {label || status}
    </span>
  );
};

// ── PriorityDot ─────────────────────────────────────────────────────────────
const PriorityDot = ({ priority }) => {
  const colors = { HIGH: 'var(--status-danger)', MED: 'var(--status-warning)', LOW: 'var(--moss-300)' };
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[priority] || colors.LOW, display: 'inline-block', flexShrink: 0 }}/>;
};

// ── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_INITIALS = { 'Jamie Spencer': 'JS', 'Bryony Olwyn-Davis': 'BO', 'Joshua Dickson': 'JD', 'Aimee Hollingsworth': 'AH' };
const AVATAR_COLORS = ['var(--moss-500)', 'var(--marigold-500)', 'var(--status-info)', '#8A6A9A'];

const Avatar = ({ name = '', size = 28 }) => {
  const initials = AVATAR_INITIALS[name] || name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const colorIdx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: AVATAR_COLORS[colorIdx], color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, flexShrink: 0, userSelect: 'none',
    }}>{initials}</span>
  );
};

// ── Tag / chip ──────────────────────────────────────────────────────────────
const Tag = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontSize: 12, fontWeight: active ? 600 : 400,
    padding: '3px 10px', borderRadius: 20,
    background: active ? 'var(--moss-500)' : 'var(--bg-muted)',
    color: active ? '#fff' : 'var(--ink-secondary)',
    border: active ? '1px solid var(--moss-500)' : '1px solid var(--border-soft)',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s',
    fontFamily: 'var(--font-ui)',
  }}>{label}</button>
);

// ── Input ───────────────────────────────────────────────────────────────────
const Input = ({ value, onChange, placeholder, type = 'text', style }) => (
  <input
    type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{
      fontFamily: 'var(--font-ui)', fontSize: 13,
      background: 'var(--bg-surface)', color: 'var(--ink-primary)',
      border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
      padding: '7px 10px', outline: 'none', width: '100%', ...style,
    }}
  />
);

// ── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ message, onClose }) => (
  <div style={{
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--ink-primary)', color: 'var(--bg-canvas)',
    padding: '10px 18px', borderRadius: 'var(--r-sm)', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: 'var(--shadow-lg)', zIndex: 1000, whiteSpace: 'nowrap',
  }}>
    {message}
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: 16 }}>×</button>
  </div>
);

// ── Modal shell ─────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, width = 480 }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: width,
      maxHeight: '90vh', overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  </div>
);

// ── Right sheet ─────────────────────────────────────────────────────────────
const RightSheet = ({ title, subtitle, onClose, children, width = 400 }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex' }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)' }} onClick={onClose}/>
    <div style={{
      width: '100%', maxWidth: width, background: 'var(--bg-surface)',
      boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', fontSize: 20, lineHeight: 1, marginTop: -2 }}>×</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</div>
    </div>
  </div>
);

// ── Empty state ─────────────────────────────────────────────────────────────
const EmptyState = ({ Illustration, headline, subline, action }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
    {Illustration && <Illustration />}
    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-primary)', marginTop: 8 }}>{headline}</div>
    {subline && <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', maxWidth: 280 }}>{subline}</div>}
    {action}
  </div>
);

// ── Divider ─────────────────────────────────────────────────────────────────
const Divider = ({ style }) => <div style={{ height: 1, background: 'var(--border-soft)', ...style }}/>;

// ── Section label ───────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-tertiary)', marginBottom: 4 }}>{children}</div>
);

// ── Skeleton loader ─────────────────────────────────────────────────────────
const Skeleton = ({ width = '100%', height = 14, radius = 4, style }) => (
  <div style={{
    width, height, borderRadius: radius,
    background: 'linear-gradient(90deg, var(--border-soft) 25%, var(--bg-muted) 50%, var(--border-soft) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    ...style,
  }}/>
);

// ── Inline CSS for skeleton animation ──────────────────────────────────────
const UIPrimitivesStyles = () => (
  <style>{`
    @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
    button:not([disabled]):hover { filter: brightness(0.95); }
    .row-hover:hover { background: var(--bg-muted) !important; cursor: pointer; }
    .tab-btn { background: none; border: none; cursor: pointer; font-family: var(--font-ui); }
    .tab-btn.active { border-bottom: 2px solid var(--moss-500); color: var(--moss-700); font-weight: 600; }
    input:focus, textarea:focus, select:focus { border-color: var(--moss-500) !important; box-shadow: 0 0 0 2px var(--moss-50); }
  `}</style>
);

Object.assign(window, {
  Button, StatusPill, PriorityDot, Avatar, Tag, Input, Toast,
  Modal, RightSheet, EmptyState, Divider, SectionLabel, Skeleton,
  UIPrimitivesStyles, STATUS_COLORS,
});
