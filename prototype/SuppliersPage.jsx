/* Wedding Hub — Suppliers Page */

const SUPPLIERS_DATA = [
  { id:1,  category:'Venue',       name:'Alveston Manor',                    contact:'Events Team',        email:'events@alvestonmanor.co.uk', phone:'01789 204600', status:'BOOKED', lastContact:'12 days ago', summary:'Final numbers confirmed for 26 Sep. Awaiting balance invoice.' },
  { id:2,  category:'Registrar',   name:'Warwickshire Registrar',            contact:'Registry Office',    email:'registrar@warwickshire.gov.uk', phone:'01926 412040', status:'BOOKED', lastContact:'28 days ago', summary:'Notice of marriage filed. Confirmed for 2pm ceremony.' },
  { id:3,  category:'Planner',     name:'Bespoke Weddings',                  contact:'Aimee-Louise Summer',email:'aimee@bespokeweddings.co.uk', phone:'07812 345678', status:'PAID', lastContact:'3 days ago', summary:'Running schedule finalised. On-call day-of.' },
  { id:4,  category:'Photography', name:'CG Media',                          contact:'Louis Brough',       email:'louis@cgmedia.co.uk', phone:'07923 456789', status:'BOOKED', lastContact:'20 days ago', summary:'Shot list shared. Final payment due 15 Sep.' },
  { id:5,  category:'Florist',     name:'Paintbox Blooms',                   contact:'Naomi Weetman',      email:'naomi@paintboxblooms.co.uk', phone:'07734 567890', status:'BOOKED', lastContact:'8 days ago', summary:'Order confirmed. Delivery 7am on the day.' },
  { id:6,  category:'Photo Booth', name:'Dream Wedding & Events',            contact:'Jak & Laura',        email:'jak@dreamwedding.co.uk', phone:'07645 678901', status:'BOOKED', lastContact:'15 days ago', summary:'Guestbook package confirmed. Setup from 7pm.' },
  { id:7,  category:'Rings',       name:'Stratford School of Jewellery',     contact:'Reception',          email:'rings@stratfordjewellery.co.uk', phone:'01789 267655', status:'PAID', lastContact:'45 days ago', summary:'Both rings collected and stored safely.' },
  { id:8,  category:'Suits',       name:'Slaters',                           contact:'',                   email:'', phone:'', status:'LEAD', lastContact:'—', summary:'' },
  { id:9,  category:'Stationery',  name:'VistaPrint',                        contact:'',                   email:'', phone:'', status:'LEAD', lastContact:'—', summary:'' },
  { id:10, category:'Insurance',   name:'WeddingPlan Insurance',             contact:'Customer Services',  email:'info@weddingplan.co.uk', phone:'0345 450 0151', status:'PAID', lastContact:'60 days ago', summary:'Policy confirmed, documents filed.' },
  { id:11, category:'Misc',        name:'Misc / Unknown',                    contact:'',                   email:'', phone:'', status:'LEAD', lastContact:'—', summary:'' },
];

const COMMS_LOG = [
  { id:1, channel:'Email',   date:'18 Apr 2026', summary:'Confirmed final guest count and dietary requirements', full:'Sent breakdown of 50 guests including 2 children. Confirmed 3 vegetarian and 1 gluten-free. Venue acknowledged and will update kitchen.' },
  { id:2, channel:'Phone',   date:'06 Apr 2026', summary:'Discussed room layout for evening reception', full:'Called to discuss dance floor position vs. round tables. Agreed DJ setup in far corner, tables arranged around perimeter.' },
  { id:3, channel:'Meeting', date:'15 Mar 2026', summary:'Site visit and tasting session', full:'Full site visit. Tasted menu — all approved. Discussed ceremony room positioning and outdoor drinks reception if weather permits.' },
];

const SuppliersPage = () => {
  const [view, setView] = React.useState('Directory');
  const [selected, setSelected] = React.useState(null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Suppliers"
        subtitle={`${SUPPLIERS_DATA.filter(s=>s.status==='BOOKED'||s.status==='PAID').length} confirmed · ${SUPPLIERS_DATA.filter(s=>s.status==='LEAD').length} leads`}
        actions={
          <>
            <Button variant="ghost" size="sm">Export</Button>
            <Button variant="primary" size="sm">+ Add supplier</Button>
          </>
        }
        tabs={['Directory','Board']}
        activeTab={view}
        onTabChange={setView}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'Directory'
          ? <SupplierDirectory suppliers={SUPPLIERS_DATA} onSelect={setSelected}/>
          : <SupplierBoard suppliers={SUPPLIERS_DATA} onSelect={setSelected}/>
        }
      </div>
      {selected !== null && (
        <SupplierDetailSheet
          supplier={SUPPLIERS_DATA.find(s=>s.id===selected) || SUPPLIERS_DATA[0]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

// ── Directory view ─────────────────────────────────────────────────────────
const SupplierDirectory = ({ suppliers, onSelect }) => (
  <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
    {suppliers.map(s => (
      <div key={s.id} onClick={() => onSelect(s.id)} style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)', padding: '16px', cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='var(--shadow-sm)'}
      >
        {/* Logo placeholder */}
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, border: '1px solid var(--border-soft)', fontSize: 14 }}>
          {s.name.charAt(0)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 2 }}>{s.name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginBottom: 10 }}>{s.category}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusPill status={s.status}/>
          {s.contact ? (
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{s.contact.split(' ')[0]}</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontStyle: 'italic' }}>No contact</span>
          )}
        </div>
      </div>
    ))}
  </div>
);

// ── Board view ─────────────────────────────────────────────────────────────
const SupplierBoard = ({ suppliers, onSelect }) => {
  const cols = [
    { id:'LEAD',    label:'Lead' },
    { id:'BOOKED',  label:'Booked' },
    { id:'PAID',    label:'Paid' },
    { id:'DECLINED',label:'Declined' },
  ];
  return (
    <div style={{ display: 'flex', gap: 12, padding: 24, overflowX: 'auto', height: '100%', alignItems: 'flex-start' }}>
      {cols.map(col => {
        const items = suppliers.filter(s => s.status === col.id);
        return (
          <div key={col.id} style={{ width: 240, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)' }}>{col.label}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', background: 'var(--bg-muted)', padding: '1px 6px', borderRadius: 8 }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(s => (
                <div key={s.id} onClick={() => onSelect(s.id)} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>{s.category}</div>
                  {s.contact ? <div style={{ fontSize: 11, color: 'var(--ink-secondary)', marginTop: 6 }}>{s.contact}</div> : <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 6, fontStyle:'italic' }}>—</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Detail sheet with 4 tabs ───────────────────────────────────────────────
const SupplierDetailSheet = ({ supplier, onClose }) => {
  const [tab, setTab] = React.useState('Contacts');
  const tabs = ['Contacts','Contracts','Communications','Payments'];

  return (
    <RightSheet
      title={supplier.name}
      subtitle={`${supplier.category} · `}
      onClose={onClose}
      width={440}
    >
      <div style={{ marginTop: -8, marginBottom: 16 }}><StatusPill status={supplier.status}/></div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)', marginBottom: 16, gap: 0, marginLeft: -20, marginRight: -20, paddingLeft: 20 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontFamily: 'var(--font-ui)',
            color: tab === t ? 'var(--moss-700)' : 'var(--ink-tertiary)',
            fontWeight: tab === t ? 600 : 400,
            borderBottom: tab === t ? '2px solid var(--moss-500)' : '2px solid transparent',
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Contacts' && <ContactsTab supplier={supplier}/>}
      {tab === 'Contracts' && <ContractsTab/>}
      {tab === 'Communications' && <CommunicationsTab supplier={supplier}/>}
      {tab === 'Payments' && <SupplierPaymentsTab supplier={supplier}/>}
    </RightSheet>
  );
};

const ContactsTab = ({ supplier }) => (
  <div>
    {[
      ['Contact name', supplier.contact || '—'],
      ['Email', supplier.email || '—'],
      ['Phone', supplier.phone || '—'],
      ['Category', supplier.category],
    ].map(([label, val]) => (
      <div key={label} style={{ marginBottom: 14 }}>
        <SectionLabel>{label}</SectionLabel>
        <div style={{ fontSize: 13, color: val === '—' ? 'var(--ink-tertiary)' : 'var(--ink-primary)', fontStyle: val === '—' ? 'italic' : 'normal', marginTop: 3 }}>{val}</div>
      </div>
    ))}
    <Divider style={{ margin: '16px 0' }}/>
    <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
      <SectionLabel>Custom fields</SectionLabel>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['Contract ref', '—'], ['Payment terms', '—'], ['Notes', '—']].map(([l, v]) => (
          <div key={l}><div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{l}</div><div style={{ fontSize: 13, color: 'var(--ink-tertiary)', fontStyle: 'italic', marginTop: 2 }}>{v}</div></div>
        ))}
      </div>
    </div>
  </div>
);

const ContractsTab = () => (
  <div>
    <EmptyState headline="No contracts uploaded" subline="Upload signed contracts or confirmation emails." action={<Button variant="secondary" size="sm">Upload file</Button>}/>
  </div>
);

const CommunicationsTab = ({ supplier }) => {
  const [logOpen, setLogOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(null);
  const hasComms = supplier.id === 1;

  return (
    <div>
      {hasComms && supplier.summary ? (
        <div style={{ background: 'var(--moss-50)', borderRadius: 'var(--r-sm)', padding: '12px 14px', marginBottom: 16, border: '1px solid var(--moss-100)' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-primary)', lineHeight: 1.5 }}>{supplier.summary}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 4 }}>Last contact: {supplier.lastContact}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)', padding: '10px 14px', marginBottom: 16, color: 'var(--ink-tertiary)', fontSize: 12, fontStyle: 'italic' }}>
          No last message summary yet
        </div>
      )}

      <Button variant="primary" size="sm" onClick={() => setLogOpen(v => !v)}>Log communication</Button>

      {logOpen && (
        <div style={{ marginTop: 14, padding: '14px', background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><SectionLabel>Date</SectionLabel><input type="date" style={{ width:'100%', fontSize:12, padding:'6px 8px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4 }}/></div>
            <div><SectionLabel>Channel</SectionLabel>
              <select style={{ width:'100%', fontSize:12, padding:'6px 8px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4 }}>
                {['Email','Phone','Meeting','Other'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><SectionLabel>Summary</SectionLabel><textarea placeholder="What was discussed…" style={{ width:'100%', minHeight:70, padding:'6px 8px', fontSize:12, border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', resize:'vertical', marginTop:4 }}/></div>
          <div style={{ marginBottom: 10 }}><SectionLabel>Follow-up date (optional)</SectionLabel><input type="date" style={{ width:'100%', fontSize:12, padding:'6px 8px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4 }}/></div>
          <div style={{ display:'flex', gap:8 }}><Button variant="primary" size="sm" onClick={() => setLogOpen(false)}>Save</Button><Button variant="ghost" size="sm" onClick={() => setLogOpen(false)}>Cancel</Button></div>
        </div>
      )}

      {hasComms && (
        <div style={{ marginTop: 16 }}>
          <SectionLabel>History</SectionLabel>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {COMMS_LOG.map((entry, i) => (
              <div key={entry.id} style={{ padding: '10px 0', borderBottom: i < COMMS_LOG.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                  <span style={{ fontSize: 11, background: 'var(--bg-muted)', padding: '2px 6px', borderRadius: 4, color: 'var(--ink-secondary)', border: '1px solid var(--border-soft)' }}>{entry.channel}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{entry.date}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-primary)' }}>{entry.summary}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-tertiary)' }}>{expanded === entry.id ? '▲' : '▼'}</span>
                </div>
                {expanded === entry.id && (
                  <div style={{ marginTop: 8, paddingLeft: 0, fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5, background: 'var(--bg-muted)', padding: '10px 12px', borderRadius: 'var(--r-sm)' }}>
                    {entry.full}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={{ fontSize: 11, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Edit</button>
                      <button style={{ fontSize: 11, color: 'var(--status-danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasComms && !supplier.summary && (
        <EmptyState headline="No communications logged yet" subline="Keep track of every email, call and meeting." action={<Button variant="primary" size="sm" onClick={() => setLogOpen(true)}>Log communication</Button>}/>
      )}
    </div>
  );
};

const SupplierPaymentsTab = ({ supplier }) => {
  const paymentMap = {
    1: [{ desc:'Venue deposit', amount:'£1,000', date:'15 Jan 2026', status:'PAID' },{ desc:'Venue balance', amount:'£3,960', date:'26 Aug 2026', status:'SCHEDULED' }],
    3: [{ desc:'Planning retainer', amount:'£500', date:'01 Dec 2025', status:'PAID' }],
    7: [{ desc:'Ring deposit', amount:'£250', date:'01 Feb 2026', status:'PAID' },{ desc:'Ring balance', amount:'£350', date:'15 Mar 2026', status:'PAID' }],
  };
  const payments = paymentMap[supplier.id] || [];
  if (!payments.length) return <EmptyState headline="No payments recorded" subline="Add payments for this supplier." action={<Button variant="secondary" size="sm">+ Add payment</Button>}/>;
  return (
    <div>
      {payments.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < payments.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{p.desc}</div><div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{p.date}</div></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{p.amount}</div>
          <StatusPill status={p.status}/>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { SuppliersPage });
