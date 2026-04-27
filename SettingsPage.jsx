/* Wedding Hub — Settings (Members + Custom Fields) */

const MEMBERS = [
  { id:1, name:'Jamie Spencer',       email:'jspencer1706@outlook.com',     role:'Owner', avatar:'JS',
    perms:{ Today:'Edit', Tasks:'Edit', Schedule:'Edit', Suppliers:'Edit', Guests:'Edit', Seating:'Edit', Budget:'Edit', Book:'Edit' } },
  { id:2, name:'Bryony Olwyn-Davis',  email:'bryonyolwyn_davis@hotmail.com', role:'Owner', avatar:'BO',
    perms:{ Today:'Edit', Tasks:'Edit', Schedule:'Edit', Suppliers:'Edit', Guests:'Edit', Seating:'Edit', Budget:'Edit', Book:'Edit' } },
  { id:3, name:'Joshua Dickson',      email:'josh@email.com',               role:'Member', avatar:'JD',
    perms:{ Today:'View', Tasks:'Edit', Schedule:'View', Suppliers:'View', Guests:'View', Seating:'View', Budget:'None', Book:'View' } },
  { id:4, name:'Aimee Hollingsworth', email:'aimee@email.com',              role:'Member', avatar:'AH',
    perms:{ Today:'View', Tasks:'Edit', Schedule:'View', Suppliers:'View', Guests:'View', Seating:'View', Budget:'None', Book:'View' } },
];

const SECTIONS = ['Today','Tasks','Schedule','Suppliers','Guests','Seating','Budget','Book'];
const PERM_OPTIONS = ['Edit','View','None'];

const CUSTOM_FIELDS_DATA = {
  Guests: [
    { id:1, name:'Ring size', type:'Text', options:'' },
    { id:2, name:'Plus one confirmed', type:'Select', options:'Yes,No,TBC' },
  ],
  Suppliers: [
    { id:1, name:'Contract reference', type:'Text', options:'' },
    { id:2, name:'Payment terms', type:'Select', options:'30 days,60 days,On completion' },
  ],
  Tasks: [],
  'Budget items': [],
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = React.useState('Members');
  const tabs = ['Members','Custom Fields'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Settings"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {activeTab === 'Members' ? <MembersTab/> : <CustomFieldsTab/>}
        </div>
      </div>
    </div>
  );
};

// ── Members / Permission matrix ────────────────────────────────────────────
const MembersTab = () => {
  const [members, setMembers] = React.useState(MEMBERS);

  const updatePerm = (memberId, section, value) => {
    setMembers(ms => ms.map(m => m.id === memberId ? { ...m, perms: { ...m.perms, [section]: value } } : m));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-primary)' }}>Wedding party members</div>
          <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 3 }}>Manage who can access which sections of your Wedding Hub.</div>
        </div>
        <Button variant="primary" size="sm">+ Invite member</Button>
      </div>

      {/* Permission matrix table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }}>
                <th style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 200 }}>Member</th>
                {SECTIONS.map(s => (
                  <th key={s} style={{ padding: '11px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{s}</th>
                ))}
                <th style={{ padding: '11px 16px', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => (
                <tr key={member.id} style={{ borderBottom: idx < members.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={member.name} size={28}/>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{member.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{member.role} · {member.email}</div>
                      </div>
                    </div>
                  </td>
                  {SECTIONS.map(section => (
                    <td key={section} style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {member.role === 'Owner' ? (
                        <span style={{ fontSize: 11, color: 'var(--moss-500)', fontWeight: 600 }}>Owner</span>
                      ) : (
                        <PermSelect value={member.perms[section]} onChange={v => updatePerm(member.id, section, v)}/>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {member.role !== 'Owner' && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite pending */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 12 }}>Pending invites</div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-primary)' }}>Aimee-Louise Summer</div>
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>aimee@bespokeweddings.co.uk · Invited 3 days ago</div>
          </div>
          <Button variant="ghost" size="sm">Resend</Button>
        </div>
      </div>
    </div>
  );
};

const PermSelect = ({ value, onChange }) => {
  const colors = { Edit: 'var(--moss-500)', View: 'var(--status-info)', None: 'var(--ink-tertiary)' };
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      fontSize: 11, padding: '3px 6px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
      background: 'var(--bg-surface)', color: colors[value] || 'var(--ink-secondary)',
      fontFamily: 'var(--font-ui)', fontWeight: 500, cursor: 'pointer',
    }}>
      {PERM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

// ── Custom Fields ──────────────────────────────────────────────────────────
const CustomFieldsTab = () => {
  const [fields, setFields] = React.useState(CUSTOM_FIELDS_DATA);
  const [entity, setEntity] = React.useState('Guests');
  const [addingFor, setAddingFor] = React.useState(null);
  const [newField, setNewField] = React.useState({ name:'', type:'Text', options:'' });
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const entities = ['Guests','Suppliers','Tasks','Budget items'];

  const addField = () => {
    if (!newField.name.trim()) return;
    setFields(f => ({ ...f, [entity]: [...f[entity], { id: Date.now(), ...newField }] }));
    setNewField({ name:'', type:'Text', options:'' });
    setAddingFor(null);
  };

  const removeField = (id) => {
    setFields(f => ({ ...f, [entity]: f[entity].filter(field => field.id !== id) }));
    setConfirmDelete(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 4 }}>Custom fields</div>
        <div style={{ fontSize: 12, color: 'var(--ink-tertiary)' }}>Add up to 5 custom fields per entity. Fields appear in detail sheets and can be toggled as optional columns.</div>
      </div>

      {/* Entity tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {entities.map(e => <Tag key={e} label={e} active={entity === e} onClick={() => setEntity(e)}/>)}
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 80px', padding: '9px 20px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}>
          {['Field name','Type','Options / values',''].map((h,i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {fields[entity].length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-tertiary)', fontStyle: 'italic' }}>
            No custom fields for {entity} yet.
          </div>
        ) : (
          fields[entity].map((field, idx) => (
            <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 80px', padding: '11px 20px', borderBottom: idx < fields[entity].length - 1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-primary)', fontWeight: 500 }}>{field.name}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{field.type}</span>
              <span style={{ fontSize: 12, color: field.options ? 'var(--ink-secondary)' : 'var(--ink-tertiary)', fontStyle: field.options ? 'normal' : 'italic' }}>
                {field.options || (field.type === 'Select' ? 'No options defined' : '—')}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ fontSize: 12, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Edit</button>
                <button onClick={() => setConfirmDelete(field.id)} style={{ fontSize: 12, color: 'var(--status-danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Remove</button>
              </div>
            </div>
          ))
        )}

        {/* Add field form */}
        {addingFor === entity ? (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <SectionLabel>Field name</SectionLabel>
                <input value={newField.name} onChange={e => setNewField(n => ({...n, name: e.target.value}))} placeholder="e.g. Ring size" style={{ width:'100%', fontSize:13, padding:'6px 10px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4 }}/>
              </div>
              <div>
                <SectionLabel>Type</SectionLabel>
                <select value={newField.type} onChange={e => setNewField(n => ({...n, type: e.target.value}))} style={{ width:'100%', fontSize:13, padding:'6px 10px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4 }}>
                  {['Text','Number','Date','Select'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {newField.type === 'Select' && (
                <div>
                  <SectionLabel>Options (comma-separated)</SectionLabel>
                  <input value={newField.options} onChange={e => setNewField(n => ({...n, options: e.target.value}))} placeholder="Option 1,Option 2…" style={{ width:'100%', fontSize:13, padding:'6px 10px', border:'1px solid var(--border-soft)', borderRadius:'var(--r-sm)', background:'var(--bg-surface)', color:'var(--ink-primary)', fontFamily:'var(--font-ui)', marginTop:4 }}/>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Button variant="primary" size="sm" onClick={addField} disabled={fields[entity].length >= 5}>Add field</Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingFor(null)}>Cancel</Button>
              {fields[entity].length >= 5 && <span style={{ fontSize:11, color:'var(--status-warning)', alignSelf:'center' }}>Maximum 5 fields per entity</span>}
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 20px', borderTop: fields[entity].length > 0 ? '1px solid var(--border-soft)' : 'none' }}>
            <button onClick={() => setAddingFor(entity)} disabled={fields[entity].length >= 5} style={{ fontSize:12, color: fields[entity].length >= 5 ? 'var(--ink-tertiary)' : 'var(--moss-500)', background:'none', border:'none', cursor: fields[entity].length >= 5 ? 'not-allowed' : 'pointer', fontFamily:'var(--font-ui)', fontWeight:500 }}>
              + Add field {fields[entity].length >= 5 ? '(limit reached)' : ''}
            </button>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <Modal title="Remove custom field?" onClose={() => setConfirmDelete(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)', marginBottom: 20 }}>
            This will permanently remove the field and all its values from {entity}. This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:8 }}>
            <Button variant="destructive" size="sm" onClick={() => removeField(confirmDelete)}>Remove field</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

Object.assign(window, { SettingsPage });
