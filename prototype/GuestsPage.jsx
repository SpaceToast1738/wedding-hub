/* Wedding Hub — Guests Page */

const GUESTS_DATA = [
  { id:1,  household:'Jamie Spencer & Bryony Olwyn-Davis', name:'Jamie Spencer',        adult:'Adult', table:'Head Table', tags:['Wedding party'],              rsvp:'YES',     email:'jspencer1706@outlook.com',     dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:['Eyes on Me – Rova'] },
  { id:2,  household:'Jamie Spencer & Bryony Olwyn-Davis', name:'Bryony Olwyn-Davis',   adult:'Adult', table:'Head Table', tags:['Wedding party'],              rsvp:'YES',     email:'bryonyolwyn_davis@hotmail.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:['Macarena – Los Del Río'] },
  { id:3,  household:'Joshua Dickson & Sarah Loughran',    name:'Joshua Dickson',       adult:'Adult', table:'Table 4',    tags:['Wedding party','Friend',"Jamie's side"],  rsvp:'YES', email:'josh@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:['Original Nuttah – UK Apache & Shy FX'] },
  { id:4,  household:'Joshua Dickson & Sarah Loughran',    name:'Sarah Loughran',       adult:'Adult', table:'Table 4',    tags:['Wedding party','Friend',"Jamie's side"],  rsvp:'YES', email:'sarah@email.com', dietary:'Vegetarian', meal:'Butternut squash & Spinach pithivier', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:5,  household:'Aimee Hollingsworth & Uldis Elksnis',name:'Aimee Hollingsworth',  adult:'Adult', table:'Table 1',    tags:['Wedding party','Friend',"Bryony's side"],rsvp:'YES', email:'aimee@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:['Carry on Wayward Son – Kansas'] },
  { id:6,  household:'Aimee Hollingsworth & Uldis Elksnis',name:'Uldis Elksnis',        adult:'Adult', table:'Table 1',    tags:['Wedding party','Friend',"Bryony's side"],rsvp:'YES', email:'uldis@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:7,  household:'Connern & Annabel Gilbert',          name:'Connern Gilbert',       adult:'Adult', table:'Table 4',    tags:['Wedding party','Friend',"Jamie's side"],  rsvp:'YES', email:'connern@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:8,  household:'Connern & Annabel Gilbert',          name:'Annabel Gilbert',       adult:'Adult', table:'Table 4',    tags:['Wedding party','Friend',"Jamie's side"],  rsvp:'YES', email:'annabel@email.com', dietary:'Gluten-free', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:9,  household:'Torin Davis & Tia King',             name:'Torin Davis',           adult:'Adult', table:'Table 1',    tags:['Immediate Family',"Bryony's side"],       rsvp:'YES', email:'torin@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:['Take Me Home, Country Roads – John Denver'] },
  { id:10, household:'Torin Davis & Tia King',             name:'Tia King',              adult:'Adult', table:'Table 1',    tags:['Immediate Family',"Bryony's side"],       rsvp:'YES', email:'tia@email.com', dietary:'None', meal:'Butternut squash & Spinach pithivier', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:11, household:'Tyler Spencer',                      name:'Tyler Spencer',         adult:'Adult', table:'—',          tags:['Immediate Family',"Jamie's side"],        rsvp:'YES', email:'tyler@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:12, household:'Phill Scott',                        name:'Phill Scott',           adult:'Adult', table:'Table 3',    tags:['Extended Family',"Jamie's side"],         rsvp:'YES', email:'phill@email.com', dietary:'None', meal:'Roast Chicken Breast', starter:'Roasted Pepper & Tomato Soup', dessert:'Sticky Toffee Pudding', songs:[] },
  { id:13, household:'Harrison Speight & Guest',           name:'Harrison Speight',      adult:'Adult', table:'—',          tags:['Friend'],                                 rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:14, household:'Harrison Speight & Guest',           name:'Harrison\'s Guest',     adult:'Adult', table:'—',          tags:['Friend'],                                 rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:15, household:'Georgia & James Blondel',            name:'Georgia Blondel',       adult:'Adult', table:'—',          tags:['Friend',"Bryony's side"],                 rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:16, household:'Georgia & James Blondel',            name:'James Blondel',         adult:'Adult', table:'—',          tags:['Friend',"Bryony's side"],                 rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:17, household:'Luke Maple & Guest',                 name:'Luke Maple',            adult:'Adult', table:'—',          tags:['Friend',"Jamie's side"],                  rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:18, household:'Barry Scott',                        name:'Barry Scott',           adult:'Adult', table:'—',          tags:['Extended Family',"Jamie's side"],         rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:19, household:'Jake Hughes & Sophie Gibson',        name:'Jake Hughes',           adult:'Adult', table:'—',          tags:['Friend',"Jamie's side"],                  rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
  { id:20, household:'Jake Hughes & Sophie Gibson',        name:'Sophie Gibson',         adult:'Adult', table:'—',          tags:['Friend',"Jamie's side"],                  rsvp:'PENDING', email:'', dietary:'', meal:'', starter:'', dessert:'', songs:[] },
];

const ALL_TAGS = ['Immediate Family','Extended Family','Wedding party','Friend',"Bryony's side","Jamie's side"];

const GuestsPage = () => {
  const [activeTag, setActiveTag] = React.useState(null);
  const [selectedGuest, setSelectedGuest] = React.useState(null);
  const [wizard, setWizard] = React.useState(null); // null | 'import' | 'sync'
  const [showCateringExport, setShowCateringExport] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const filtered = activeTag
    ? GUESTS_DATA.filter(g => g.tags.includes(activeTag))
    : GUESTS_DATA;

  // Group by household
  const households = filtered.reduce((acc, g) => {
    if (!acc[g.household]) acc[g.household] = [];
    acc[g.household].push(g);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Guests"
        subtitle={`${GUESTS_DATA.filter(g=>g.rsvp==='YES').length} confirmed · ${GUESTS_DATA.filter(g=>g.rsvp==='PENDING').length} pending · ${GUESTS_DATA.length} total`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCateringExport(true)}>↗ Catering sheet</Button>
            <Button variant="ghost" size="sm" onClick={() => setWizard('sync')}>↻ Sync from Say I Do</Button>
            <Button variant="ghost" size="sm" onClick={() => setWizard('import')}>Import CSV</Button>
            <Button variant="primary" size="sm">+ Add guest</Button>
          </>
        }
      />

      {/* Tag filter pills */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, background: 'var(--bg-surface)', alignItems: 'center' }}>
        <Tag label="All" active={!activeTag} onClick={() => setActiveTag(null)}/>
        {ALL_TAGS.map(t => <Tag key={t} label={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)}/>)}
      </div>

      {/* Guest list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
              {['Name','Table','RSVP','Type','Tags','Dietary'].map((h,i) => (
                <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', background: 'var(--bg-canvas)', position: 'sticky', top: 0, paddingLeft: i===0?24:undefined, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(households).map(([household, members]) => (
              <React.Fragment key={household}>
                {members.length > 1 && (
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    <td colSpan={6} style={{ padding: '5px 24px', fontSize: 11, color: 'var(--ink-tertiary)', fontWeight: 500 }}>{household}</td>
                  </tr>
                )}
                {members.map((guest, gi) => (
                  <tr key={guest.id} className="row-hover" onClick={() => setSelectedGuest(guest)} style={{ borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                    <td style={{ padding: '9px 12px 9px 24px', paddingLeft: members.length > 1 ? 40 : 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={guest.name} size={24}/>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{guest.name}</span>
                        {/^(.+)'s Guest$|^Guest$/i.test(guest.name) && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'var(--marigold-100)', color: 'var(--marigold-700)', border: '1px solid rgba(216,155,60,0.3)', letterSpacing: '0.04em' }}>+1</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--ink-secondary)' }}>{guest.table || '—'}</td>
                    <td style={{ padding: '9px 12px' }}><StatusPill status={guest.rsvp} label={guest.rsvp === 'YES' ? 'Confirmed' : guest.rsvp === 'NO' ? 'Declined' : 'Pending'}/></td>
                    <td style={{ padding: '9px 12px' }}><StatusPill status={guest.adult} label={guest.adult}/></td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {guest.tags.slice(0,2).map(t => (
                          <span key={t} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--bg-muted)', color: 'var(--ink-tertiary)', border: '1px solid var(--border-soft)' }}>{t}</span>
                        ))}
                        {guest.tags.length > 2 && <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>+{guest.tags.length-2}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '9px 24px 9px 12px', fontSize: 12, color: guest.dietary ? 'var(--ink-secondary)' : 'var(--ink-tertiary)' }}>{guest.dietary || '—'}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {!showArchived && (
          <div style={{ padding: '12px 24px' }}>
            <button onClick={() => setShowArchived(true)} style={{ fontSize: 12, color: 'var(--ink-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
              Show archived (1) ↓
            </button>
          </div>
        )}
      </div>

      {selectedGuest && <GuestDetailSheet guest={selectedGuest} onClose={() => setSelectedGuest(null)}/>}
      {wizard === 'import' && <ImportWizard onClose={() => setWizard(null)}/>}
      {wizard === 'sync' && <SyncWizard onClose={() => setWizard(null)}/>}
      {showCateringExport && <VenueCateringExport onClose={() => setShowCateringExport(false)}/>}
    </div>
  );
};

// ── Guest detail sheet ─────────────────────────────────────────────────────
const GuestDetailSheet = ({ guest, onClose }) => (
  <RightSheet title={guest.name} subtitle={guest.household} onClose={onClose}>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <StatusPill status={guest.rsvp} label={guest.rsvp === 'YES' ? 'Confirmed' : 'Pending'}/>
      <StatusPill status={guest.adult} label={guest.adult}/>
    </div>

    {[
      ['Email', guest.email || '—'],
      ['Table', guest.table || '—'],
      ['Dietary', guest.dietary || '—'],
    ].map(([label, val]) => (
      <div key={label} style={{ marginBottom: 14 }}>
        <SectionLabel>{label}</SectionLabel>
        <div style={{ fontSize: 13, color: val === '—' ? 'var(--ink-tertiary)' : 'var(--ink-primary)', marginTop: 3, fontStyle: val === '—' ? 'italic' : 'normal' }}>{val}</div>
      </div>
    ))}

    <Divider style={{ marginBottom: 14 }}/>
    <div style={{ marginBottom: 14 }}>
      <SectionLabel>Meal choices</SectionLabel>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['Starter', guest.starter], ['Main', guest.meal], ['Dessert', guest.dessert]].map(([course, choice]) => (
          <div key={course} style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', width: 48, flexShrink: 0, paddingTop: 1 }}>{course}</span>
            <span style={{ fontSize: 12, color: choice ? 'var(--ink-primary)' : 'var(--ink-tertiary)', fontStyle: choice ? 'normal' : 'italic' }}>{choice || '—'}</span>
          </div>
        ))}
      </div>
    </div>

    {guest.songs && guest.songs.length > 0 && (
      <>
        <Divider style={{ marginBottom: 14 }}/>
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Song requests</SectionLabel>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {guest.songs.map((s,i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--ink-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--moss-500)', flexShrink: 0 }}>♪</span>{s}
              </div>
            ))}
          </div>
        </div>
      </>
    )}

    <Divider style={{ marginBottom: 14 }}/>
    <div>
      <SectionLabel>Tags</SectionLabel>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {guest.tags.map(t => <span key={t} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 12, background: 'var(--moss-50)', color: 'var(--moss-700)', border: '1px solid var(--moss-100)' }}>{t}</span>)}
      </div>
    </div>

    <Divider style={{ margin: '14px 0' }}/>
    {/* Custom fields section */}
    <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
      <SectionLabel>Custom fields</SectionLabel>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['Ring size', '—'], ['Plus one name', '—']].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-tertiary)', fontStyle: 'italic', marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  </RightSheet>
);

// ── Import wizard ──────────────────────────────────────────────────────────
const ImportWizard = ({ onClose }) => {
  const [step, setStep] = React.useState(1);
  const [file, setFile] = React.useState(null);

  return (
    <Modal title="Import guests from CSV" onClose={onClose} width={560}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {['Upload','Map columns','Preview & apply'].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step > i ? 'var(--moss-500)' : step === i+1 ? 'var(--moss-500)' : 'var(--bg-muted)', color: step >= i+1 ? '#fff' : 'var(--ink-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, border: `2px solid ${step >= i+1 ? 'var(--moss-500)' : 'var(--border-soft)'}` }}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <div style={{ fontSize: 11, color: step === i+1 ? 'var(--moss-700)' : 'var(--ink-tertiary)', marginTop: 4, fontWeight: step === i+1 ? 600 : 400 }}>{s}</div>
            </div>
            {i < 2 && <div style={{ height: 2, flex: 1, background: step > i+1 ? 'var(--moss-300)' : 'var(--border-soft)', marginBottom: 16 }}/>}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--r-md)', padding: '40px 24px', textAlign: 'center', background: 'var(--bg-muted)', cursor: 'pointer' }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--moss-500)'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onClick={() => setFile('guests_export.csv')}
          >
            <EmptyGuests/>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)', marginTop: 8 }}>Drop your Say I Do CSV here</div>
            <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 4 }}>or click to browse · .csv files only</div>
          </div>
          {file && <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--moss-50)', borderRadius: 'var(--r-sm)', border: '1px solid var(--moss-100)' }}>
            <span style={{ fontSize: 13, color: 'var(--moss-700)', flex: 1 }}>📄 {file}</span>
            <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)' }}>×</button>
          </div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={!file}>Next →</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 14 }}>Map the columns from your file to Wedding Hub fields.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['First Name','first_name'],['Last Name','last_name'],['Email','email'],['RSVP Status','rsvp'],['Dietary','dietary'],['Party Name','household'],['Groups / Tags','tags'],['Table','table']].map(([src, target]) => (
              <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, padding: '6px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)', color: 'var(--ink-secondary)', border: '1px solid var(--border-soft)' }}>{src}</div>
                <span style={{ color: 'var(--moss-500)', fontSize: 16 }}>→</span>
                <div style={{ flex: 1 }}>
                  <select style={{ width: '100%', fontSize: 12, padding: '6px 10px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)' }} defaultValue={target}>
                    <option value="">— skip —</option>
                    {['first_name','last_name','email','rsvp','dietary','household','tags','table'].map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Back</Button>
            <Button variant="primary" size="sm" onClick={() => setStep(3)}>Preview →</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {[['47 new','var(--moss-500)'],['3 changed','var(--marigold-500)'],['12 unchanged','var(--ink-tertiary)']].map(([label, color]) => (
              <span key={label} style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
            ))}
          </div>
          <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)' }}>
            {GUESTS_DATA.slice(0,8).map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: i < 7 ? '1px solid var(--border-soft)' : 'none', background: i < 3 ? 'rgba(92,113,72,0.04)' : 'transparent' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--moss-500)' }}/>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: i < 3 ? 'var(--moss-500)' : 'var(--border-strong)', display: 'inline-block', flexShrink: 0 }}/>
                <span style={{ fontSize: 12, flex: 1, color: 'var(--ink-primary)' }}>{g.name}</span>
                <span style={{ fontSize: 11, color: i < 3 ? 'var(--moss-500)' : 'var(--ink-tertiary)' }}>{i < 3 ? 'new' : 'unchanged'}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</Button>
            <Button variant="primary" size="sm" onClick={onClose}>Apply import</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── Sync wizard (Say I Do) ─────────────────────────────────────────────────
const SYNC_DIFF = [
  { name:'Harrison Speight', status:'new',     before:'',         after:'RSVP: Confirmed' },
  { name:'Georgia Blondel',  status:'changed', before:'Pending',  after:'Confirmed' },
  { name:'Jake Hughes',      status:'changed', before:'Pending',  after:'Confirmed' },
  { name:'Phill Scott',      status:'unchanged',before:'Confirmed',after:'Confirmed' },
  { name:'Barry Scott',      status:'unchanged',before:'Pending', after:'Pending' },
];

const SYNC_STATUS_COLORS = { new: 'var(--moss-500)', changed: 'var(--marigold-500)', conflict: 'var(--status-danger)', unchanged: 'var(--ink-tertiary)' };

const SyncWizard = ({ onClose }) => (
  <Modal title="Sync from Say I Do" onClose={onClose} width={560}>
    <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 16 }}>
      Review changes from the latest Say I Do export before applying.
    </div>
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      {[['3 new','var(--moss-500)'],['2 updated','var(--marigold-500)'],['0 conflicts','var(--status-danger)'],['12 unchanged','var(--ink-tertiary)']].map(([label,color]) => (
        <span key={label} style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
      ))}
    </div>
    <div style={{ border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr 80px', padding: '7px 12px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}>
        {['','Name','Before','After','Status'].map((h,i) => <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)' }}>{h}</span>)}
      </div>
      {SYNC_DIFF.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr 80px', padding: '8px 12px', borderBottom: i < SYNC_DIFF.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center', background: row.status === 'new' ? 'rgba(92,113,72,0.03)' : row.status === 'changed' ? 'rgba(216,155,60,0.03)' : 'transparent' }}>
          <input type="checkbox" defaultChecked={row.status !== 'unchanged'} style={{ accentColor: 'var(--moss-500)' }}/>
          <span style={{ fontSize: 12, color: 'var(--ink-primary)', fontWeight: 500 }}>{row.name}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-tertiary)' }}>{row.before || '—'}</span>
          <span style={{ fontSize: 12, color: row.status !== 'unchanged' ? SYNC_STATUS_COLORS[row.status] : 'var(--ink-tertiary)' }}>{row.after}</span>
          <span style={{ fontSize: 11, color: SYNC_STATUS_COLORS[row.status], fontWeight: 500 }}>{row.status}</span>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="sm" onClick={onClose}>Apply changes</Button>
    </div>
  </Modal>
);

// ── Venue catering export ────────────────────────────────────────────────────
const VenueCateringExport = ({ onClose }) => {
  const confirmed = GUESTS_DATA.filter(g => g.rsvp === 'YES');
  const pending   = GUESTS_DATA.filter(g => g.rsvp === 'PENDING');

  // Aggregate counts
  const mealCounts = {};
  const dietCounts = {};
  confirmed.forEach(g => {
    if (g.meal)     mealCounts[g.meal]     = (mealCounts[g.meal]     || 0) + 1;
    const d = g.dietary && g.dietary !== 'None' ? g.dietary : null;
    if (d)          dietCounts[d]          = (dietCounts[d]          || 0) + 1;
  });

  // Group rows by table for the venue
  const byTable = confirmed.reduce((acc, g) => {
    const t = g.table || '—';
    (acc[t] = acc[t] || []).push(g);
    return acc;
  }, {});
  const tableOrder = Object.keys(byTable).sort((a,b) => {
    if (a === 'Head Table') return -1;
    if (b === 'Head Table') return 1;
    if (a === '—') return 1;
    if (b === '—') return -1;
    return a.localeCompare(b);
  });

  const handlePrint = () => window.print();

  const buildCSV = () => {
    const rows = [['Table','Name','Type','Starter','Main','Dessert','Dietary','Notes']];
    confirmed.forEach(g => {
      rows.push([
        g.table || '',
        g.name,
        g.adult,
        g.starter || '',
        g.meal || '',
        g.dessert || '',
        g.dietary && g.dietary !== 'None' ? g.dietary : '',
        '',
      ]);
    });
    return rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${String(c).replace(/"/g,'""')}"` : c).join(',')).join('\n');
  };
  const handleDownloadCSV = () => {
    const blob = new Blob([buildCSV()], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spencer-olwyn-davis-catering-sheet.csv';
    a.click();
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .venue-export-print, .venue-export-print * { visibility: visible; }
          .venue-export-print { position: absolute; inset: 0; background: #fff !important; padding: 32px !important; max-height: none !important; overflow: visible !important; }
          .venue-export-noprint { display: none !important; }
          .venue-export-modal-bg { position: static !important; background: transparent !important; }
          .venue-export-modal { box-shadow: none !important; border: none !important; max-height: none !important; width: 100% !important; max-width: none !important; }
        }
      `}</style>
      <div className="venue-export-modal-bg" style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,30,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={onClose}>
        <div
          className="venue-export-modal"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-lg)',
            width: 760,
            maxWidth: '94vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-ui)',
            boxShadow: '0 24px 48px rgba(20,28,30,0.18)',
          }}
        >
          {/* Toolbar (hidden in print) */}
          <div className="venue-export-noprint" style={{ padding: '14px 22px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink-primary)' }}>Catering sheet for venue</div>
              <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 2 }}>Generated from confirmed RSVPs · {confirmed.length} of {GUESTS_DATA.length} guests</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={handleDownloadCSV}>↓ CSV</Button>
              <Button variant="ghost" size="sm" onClick={handlePrint}>⎙ Print / PDF</Button>
              <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>

          {/* Printable body */}
          <div className="venue-export-print" style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-surface)' }}>
            {/* Letterhead */}
            <div style={{ borderBottom: '2px solid var(--ink-primary)', paddingBottom: 14, marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 4 }}>Spencer · Olwyn-Davis Wedding</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-secondary)' }}>
                <div>Thursday 24 September 2026 · Alveston Manor, Stratford-upon-Avon</div>
                <div>Generated 27 Apr 2026</div>
              </div>
            </div>

            {/* Aggregate panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
              <AggregatePanel title="Main course counts" icon="◐" rows={Object.entries(mealCounts).map(([k,v]) => [k,v])} total={confirmed.filter(g=>g.meal).length} totalLabel="confirmed mains"/>
              <AggregatePanel title="Dietary requirements" icon="✦" rows={Object.entries(dietCounts).map(([k,v]) => [k,v])} total={Object.values(dietCounts).reduce((a,b)=>a+b,0)} totalLabel="special diets" emptyLabel="No special diets recorded"/>
            </div>

            {/* Per-guest breakdown by table */}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 8 }}>Per-guest breakdown</div>
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginBottom: 14 }}>Grouped by table assignment. Pending RSVPs ({pending.length}) excluded.</div>

            {tableOrder.map(table => (
              <div key={table} style={{ marginBottom: 18, breakInside: 'avoid' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-soft)', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{table}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{byTable[table].length} {byTable[table].length === 1 ? 'cover' : 'covers'}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                      <th style={cellTh}>Guest</th>
                      <th style={cellTh}>Type</th>
                      <th style={cellTh}>Starter</th>
                      <th style={cellTh}>Main</th>
                      <th style={cellTh}>Dessert</th>
                      <th style={cellTh}>Dietary / notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTable[table].map(g => {
                      const hasDiet = g.dietary && g.dietary !== 'None';
                      return (
                        <tr key={g.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                          <td style={cellTd}><strong style={{ color: 'var(--ink-primary)', fontWeight: 500 }}>{g.name}</strong></td>
                          <td style={cellTd}>{g.adult}</td>
                          <td style={cellTd}>{g.starter || '—'}</td>
                          <td style={{...cellTd, fontWeight: hasDiet ? 600 : 400 }}>{g.meal || '—'}</td>
                          <td style={cellTd}>{g.dessert || '—'}</td>
                          <td style={cellTd}>
                            {hasDiet ? (
                              <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--marigold-50)', color: 'var(--marigold-700)', border: '1px solid var(--marigold-100)', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{g.dietary}</span>
                            ) : <span style={{ color: 'var(--ink-tertiary)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Sign-off block */}
            <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', fontSize: 11, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink-primary)' }}>Notes for the venue.</strong> Children's menu (Melon &amp; Berry / Roast Chicken &amp; Veg / Fresh Fruit Salad) for 2 children. 1 highchair required. Final numbers due 14 days before — Friday 12 September 2026. Allergens to be flagged at table in line with Natasha's Law.
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-tertiary)' }}>
              <div>Couple: Jamie Spencer &amp; Bryony Olwyn-Davis · jspencer1706@outlook.com</div>
              <div>Page 1 of 1</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const cellTh = { textAlign: 'left', padding: '6px 8px', fontWeight: 600 };
const cellTd = { padding: '7px 8px', verticalAlign: 'top', color: 'var(--ink-secondary)' };

const AggregatePanel = ({ title, icon, rows, total, totalLabel, emptyLabel }) => (
  <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{icon} {title}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{total} {totalLabel}</div>
    </div>
    {rows.length === 0 ? (
      <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', padding: '6px 0' }}>{emptyLabel || 'None recorded'}</div>
    ) : rows.map(([label, count]) => (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px dotted var(--border-soft)' }}>
        <div style={{ color: 'var(--ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{label}</div>
        <div style={{ fontWeight: 600, color: 'var(--ink-primary)', fontVariantNumeric: 'tabular-nums' }}>×{count}</div>
      </div>
    ))}
  </div>
);

Object.assign(window, { GuestsPage, GUESTS_DATA });
