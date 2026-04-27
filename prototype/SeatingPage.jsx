/* Wedding Hub — Seating Page (Canvas + Rules + Mobile read-only) */

const SEATING_TABLES = [
  { id:'head', label:'Head Table', type:'rectangle', x:180, y:40,  capacity:8,  guests:['Jamie Spencer','Bryony Olwyn-Davis','Joshua Dickson','Sarah Loughran','Aimee Hollingsworth','Uldis Elksnis','Connern Gilbert','Annabel Gilbert'] },
  { id:'t1',   label:'Table 1',   type:'round',     x:80,  y:220, capacity:8,  guests:['Aimee Hollingsworth','Uldis Elksnis','Torin Davis','Tia King','Phill Scott','','',''] },
  { id:'t2',   label:'Table 2',   type:'round',     x:320, y:220, capacity:8,  guests:['','','','','','','',''] },
  { id:'t3',   label:'Table 3',   type:'round',     x:80,  y:420, capacity:8,  guests:['Phill Scott','Barry Scott','','','','','',''] },
  { id:'t4',   label:'Table 4',   type:'round',     x:320, y:420, capacity:8,  guests:['Joshua Dickson','Sarah Loughran','Connern Gilbert','Annabel Gilbert','','','',''] },
];

const RULES = [
  { id:1, type:'MUST_NOT_TOGETHER', guests:['Sarah Loughran','Tia King'],    label:'Sarah and Tia must not sit together', severity:'hard', violated:true },
  { id:2, type:'PREFER_GROUP',      guests:["Bryony's side"],                label:"Keep Bryony's side together", severity:'soft', violated:false },
  { id:3, type:'MUST_TOGETHER',     guests:['Torin Davis','Tia King'],       label:'Torin and Tia must sit together', severity:'hard', violated:false },
];

const SeatingPage = () => {
  const [viewMode, setViewMode] = React.useState('canvas'); // 'canvas' | 'mobile'
  const [tables, setTables] = React.useState(SEATING_TABLES);
  const [rules, setRules] = React.useState(RULES);
  const [rulesOpen, setRulesOpen] = React.useState(true);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [syncBanner, setSyncBanner] = React.useState(true);
  const [dragging, setDragging] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [addRuleOpen, setAddRuleOpen] = React.useState(false);
  const canvasRef = React.useRef(null);

  const CANVAS_W = 560, CANVAS_H = 620;

  const handleMouseDown = (e, tableId) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const table = tables.find(t => t.id === tableId);
    setDragging({ id: tableId, startX: e.clientX, startY: e.clientY, origX: table.x, origY: table.y, scaleX, scaleY });
    setSelected(tableId);
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) * dragging.scaleX;
    const dy = (e.clientY - dragging.startY) * dragging.scaleY;
    setTables(ts => ts.map(t => t.id === dragging.id ? { ...t, x: Math.max(0, dragging.origX + dx), y: Math.max(0, dragging.origY + dy) } : t));
  };

  const handleMouseUp = () => setDragging(null);

  const unseatedGuests = ['Harrison Speight','Georgia Blondel','James Blondel','Luke Maple','Tyler Spencer','Abbey Yates','Jake Hughes','Sophie Gibson','Sam Fletcher','Jenala Fletcher','Keith Scott','Val Scott','Peter Spencer','Sue Spencer','Maureen Spencer','Tansy Davis','Pam Hirons','Judy Hirons','Katherine'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Seating"
        subtitle={`${SEATING_TABLES.length} tables · ${SEATING_TABLES.reduce((a,t)=>a+t.guests.filter(Boolean).length,0)} seated`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setViewMode(viewMode==='canvas'?'mobile':'canvas')}>
              {viewMode==='canvas' ? '📱 Mobile view' : '🖥 Canvas view'}
            </Button>
            <Button variant="ghost" size="sm">⎙ Print</Button>
            <Button variant="primary" size="sm">+ Add table</Button>
          </>
        }
      />

      {/* Import banner */}
      {!bannerDismissed && (
        <div style={{ padding: '10px 24px', background: 'var(--marigold-100)', borderBottom: '1px solid rgba(216,155,60,0.3)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--marigold-700)', flex: 1 }}>
            <strong>Seating layout imported from Say I Do.</strong> Review and confirm to make this the official layout.
          </span>
          <Button variant="secondary" size="sm" onClick={() => setBannerDismissed(true)}>Confirm layout</Button>
          <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--marigold-700)', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Sync banner */}
      {bannerDismissed && syncBanner && (
        <div style={{ padding: '8px 24px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-secondary)', flex: 1 }}>3 seating changes from latest sync — review</span>
          <Button variant="secondary" size="sm">Accept all</Button>
          <Button variant="ghost" size="sm" onClick={() => setSyncBanner(false)}>Dismiss</Button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'canvas' ? (
          <>
            {/* Canvas area */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--bg-canvas)' }}
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            >
              <div ref={canvasRef} style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-sm)', userSelect: 'none', overflow: 'hidden' }}>
                {/* Grid */}
                <svg style={{ position: 'absolute', inset: 0, opacity: 0.3 }} width={CANVAS_W} height={CANVAS_H}>
                  {Array.from({length:Math.floor(CANVAS_W/40)},(_,i)=><line key={`v${i}`} x1={(i+1)*40} y1={0} x2={(i+1)*40} y2={CANVAS_H} stroke="var(--border-soft)" strokeWidth={0.5}/>)}
                  {Array.from({length:Math.floor(CANVAS_H/40)},(_,i)=><line key={`h${i}`} x1={0} y1={(i+1)*40} x2={CANVAS_W} y2={(i+1)*40} stroke="var(--border-soft)" strokeWidth={0.5}/>)}
                </svg>
                {/* Room label */}
                <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 11, color: 'var(--ink-tertiary)', fontStyle: 'italic' }}>The Charlecote Suite</div>

                {tables.map(table => (
                  <SeatingTableCanvas
                    key={table.id} table={table}
                    selected={selected === table.id}
                    violations={rules.filter(r => r.violated && table.guests.some(g => r.guests.includes(g)))}
                    onMouseDown={(e) => handleMouseDown(e, table.id)}
                  />
                ))}
              </div>
            </div>

            {/* Right rail: rules */}
            {rulesOpen && (
              <div style={{ width: 240, borderLeft: '1px solid var(--border-soft)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>Rules</span>
                  <button onClick={() => setRulesOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', fontSize: 16 }}>×</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
                  {rules.map(rule => (
                    <div key={rule.id} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: rule.violated ? (rule.severity==='hard' ? 'var(--status-danger)' : 'var(--status-warning)') : 'var(--moss-300)', display: 'inline-block', flexShrink: 0, marginTop: 4 }}/>
                      <span style={{ fontSize: 12, color: rule.violated ? (rule.severity==='hard' ? 'var(--status-danger)' : 'var(--status-warning)') : 'var(--ink-secondary)', lineHeight: 1.4 }}>{rule.label}</span>
                    </div>
                  ))}
                  <div style={{ padding: '12px 16px' }}>
                    {!addRuleOpen ? (
                      <button onClick={() => setAddRuleOpen(true)} style={{ fontSize: 12, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>+ Add rule</button>
                    ) : (
                      <div>
                        <SectionLabel>Rule type</SectionLabel>
                        <select style={{ width:'100%', fontSize:12, padding:'5px 8px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginBottom:8, marginTop:4 }}>
                          <option>Must sit together</option><option>Must not sit together</option><option>Prefer group</option>
                        </select>
                        <SectionLabel>Guests</SectionLabel>
                        <input placeholder="Type guest names…" style={{ width:'100%', fontSize:12, padding:'5px 8px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4, marginBottom:8 }}/>
                        <div style={{ display:'flex', gap:6 }}>
                          <Button variant="primary" size="sm" onClick={() => setAddRuleOpen(false)}>Add</Button>
                          <Button variant="ghost" size="sm" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Guest drawer */}
            <div style={{ width: 200, borderLeft: '1px solid var(--border-soft)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>Unseated</span>
                <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginLeft: 6 }}>{unseatedGuests.length}</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
                {unseatedGuests.map(name => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'grab' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-muted)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <Avatar name={name} size={22}/>
                    <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Mobile read-only list */
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {tables.map(table => (
              <div key={table.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{table.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {rules.some(r => r.violated && table.guests.some(g => r.guests.includes(g))) && (
                      <span style={{ fontSize: 11, background: '#f9efee', color: 'var(--status-danger)', padding: '2px 6px', borderRadius: 8 }}>1 rule violated</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{table.guests.filter(Boolean).length}/{table.capacity}</span>
                  </div>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {table.guests.filter(Boolean).map(name => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px' }}>
                      <Avatar name={name} size={24}/>
                      <span style={{ fontSize: 13, color: 'var(--ink-primary)' }}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Table on canvas ────────────────────────────────────────────────────────
const SeatingTableCanvas = ({ table, selected, violations, onMouseDown }) => {
  const seated = table.guests.filter(Boolean).length;
  const full = seated >= table.capacity;
  const over = seated > table.capacity;
  const borderColor = over ? 'var(--status-danger)' : full ? 'var(--status-warning)' : selected ? 'var(--moss-500)' : 'var(--border-strong)';

  if (table.type === 'rectangle') {
    return (
      <div onMouseDown={onMouseDown} style={{
        position: 'absolute', left: table.x, top: table.y,
        cursor: 'grab', userSelect: 'none',
      }}>
        <div style={{ background: 'var(--bg-surface)', border: `2px solid ${borderColor}`, borderRadius: 'var(--r-sm)', padding: '8px 16px', minWidth: 200, boxShadow: selected ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textAlign: 'center', marginBottom: 6 }}>{table.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {table.guests.slice(0,8).map((g, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: g ? 'var(--moss-50)' : 'var(--bg-muted)', color: g ? 'var(--moss-700)' : 'var(--ink-tertiary)', border: `1px solid ${g ? 'var(--moss-100)' : 'var(--border-soft)'}` }}>
                {g ? g.split(' ')[0] : '·'}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: full ? 'var(--status-warning)' : 'var(--ink-tertiary)', textAlign: 'center', marginTop: 6 }}>{seated}/{table.capacity}</div>
        </div>
      </div>
    );
  }

  // Round table
  const R = 52, cx = R + 10, cy = R + 10;
  const totalW = (R + 10) * 2;
  return (
    <div onMouseDown={onMouseDown} style={{
      position: 'absolute', left: table.x, top: table.y,
      cursor: 'grab', userSelect: 'none', width: totalW, height: totalW,
    }}>
      <svg width={totalW} height={totalW} style={{ overflow: 'visible' }}>
        {/* Table circle */}
        <circle cx={cx} cy={cy} r={R} fill="var(--bg-surface)" stroke={borderColor} strokeWidth={selected ? 2.5 : 1.5}/>
        {/* Seat dots */}
        {Array.from({length: table.capacity}, (_, i) => {
          const angle = (i * 360 / table.capacity - 90) * Math.PI / 180;
          const sr = R + 12;
          const sx = cx + sr * Math.cos(angle);
          const sy = cy + sr * Math.sin(angle);
          const hasGuest = !!table.guests[i];
          const hasViolation = violations.length > 0 && table.guests[i] && violations.some(v => v.guests.includes(table.guests[i]));
          return (
            <g key={i}>
              <circle cx={sx} cy={sy} r={7} fill={hasGuest ? 'var(--moss-100)' : 'var(--bg-muted)'} stroke={hasGuest ? 'var(--moss-500)' : 'var(--border-strong)'} strokeWidth={1}/>
              {hasViolation && <circle cx={sx+5} cy={sy-5} r={4} fill="var(--status-danger)" stroke="var(--bg-surface)" strokeWidth={1}/>}
              {selected && table.guests[i] && (
                <text x={sx + 10 * Math.cos(angle)} y={sy + 10 * Math.sin(angle)} fontSize={8} fill="var(--ink-secondary)" textAnchor="middle" dominantBaseline="middle"
                  transform={`translate(${12 * Math.cos(angle)}, ${12 * Math.sin(angle)})`}>
                  {table.guests[i].split(' ')[0]}
                </text>
              )}
            </g>
          );
        })}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={10} fill="var(--ink-tertiary)" fontFamily="var(--font-ui)">{table.label}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={11} fontWeight="600" fill={full ? 'var(--status-warning)' : 'var(--ink-secondary)'} fontFamily="var(--font-ui)">{seated}/{table.capacity}</text>
      </svg>
    </div>
  );
};

Object.assign(window, { SeatingPage });
