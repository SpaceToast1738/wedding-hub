/* Wedding Hub — Wedding Party section, redesigned as tabbed webpage with fillable fields */

const PARTY_TABS = [
  { id: 'outfits',  label: 'Outfits' },
  { id: 'roles',    label: 'Roles & people' },
  { id: 'stag',     label: 'Stag & Hen' },
  { id: 'dayof',    label: 'Day-of logistics' },
];

// Editable field row: label + value, click value to edit, Enter or blur to save
const FieldRow = ({ label, value, placeholder, onChange, multiline }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value || '');
  React.useEffect(() => { setDraft(value || ''); }, [value]);
  const save = () => { setEditing(false); if (onChange) onChange(draft); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14, padding: '10px 0', borderTop: '1px solid var(--border-soft)', alignItems: 'baseline' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2 }}>{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            rows={3}
            style={{ width: '100%', fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--ink-primary)', padding: '6px 8px', border: '1px solid var(--moss-500)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', resize: 'vertical' }}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
            style={{ width: '100%', fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--ink-primary)', padding: '4px 8px', border: '1px solid var(--moss-500)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)' }}
          />
        )
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{ fontSize: 13, color: value ? 'var(--ink-primary)' : 'var(--ink-tertiary)', cursor: 'text', padding: '4px 8px', borderRadius: 'var(--r-sm)', minHeight: 24, lineHeight: 1.55, fontStyle: value ? 'normal' : 'italic', transition: 'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="Click to edit"
        >
          {value || placeholder || 'Click to add…'}
        </div>
      )}
    </div>
  );
};

// Person header with avatar + name + role badge
const PersonHeader = ({ name, role, sub }) => {
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--moss-100)', color: 'var(--moss-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)', flexShrink: 0 }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{role}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );
};

const PartyCard = ({ title, subtitle, accent, children }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
    <div style={{ paddingBottom: 10, marginBottom: 6, borderBottom: `2px solid ${accent || 'var(--moss-500)'}` }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--ink-primary)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>{subtitle}</div>}
    </div>
    {children}
  </div>
);

// ── Outfits tab ─────────────────────────────────────────────────────────────
const OutfitsTab = () => {
  const [groom, setGroom] = React.useState({
    supplier: 'Slaters, Stratford-upon-Avon',
    style: 'Three-piece, navy',
    shirt: 'Ivory, French cuff',
    tie: 'Sage green silk',
    shoes: 'Oxford brown brogues',
    buttonhole: 'White rose & eucalyptus (Paintbox Blooms)',
  });
  const [groomsmen, setGroomsmen] = React.useState({
    members: 'Joshua Dickson (Best Man), Connern Gilbert, Phill Scott',
    style: 'Hire — matching navy three-piece',
    shirt: 'Ivory',
    tie: 'Sage green silk (matching groom)',
    shoes: 'Own brown brogues',
    fittingDue: 'Friday 11 Sep 2026',
  });
  const [bride, setBride] = React.useState({
    designer: 'Eve Estelle',
    dress: 'A-line ivory, chapel-length veil',
    bouquet: 'White roses, eucalyptus, dried wheat',
    shoes: 'Rainbow Club, ivory satin block heel · 5cm',
    earrings: 'Pearl drops (gift from Mum)',
    perfume: 'Chanel No. 5',
  });
  const [bridesmaids, setBridesmaids] = React.useState({
    members: 'Aimee Hollingsworth (Maid of Honour) — others TBC',
    dressCode: 'Sage green, floor-length',
    supplier: 'TBC — to be ordered together',
    bouquet: 'Smaller version of bride bouquet',
    shoes: 'Bridesmaid choice (any colour)',
    notes: 'Exact sage shade swatch on file',
  });
  const [children, setChildren] = React.useState({
    flowerGirl: 'Clara, age 4 — ivory dress with sage sash',
    pageBoy: 'Torin, age 7 — navy waistcoat & shorts',
    role: 'Will scatter petals down the aisle',
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <PartyCard title="Groom" subtitle="Jamie Spencer" accent="var(--moss-500)">
        <FieldRow label="Supplier"   value={groom.supplier}   onChange={v => setGroom({...groom, supplier: v})}/>
        <FieldRow label="Style"      value={groom.style}      onChange={v => setGroom({...groom, style: v})}/>
        <FieldRow label="Shirt"      value={groom.shirt}      onChange={v => setGroom({...groom, shirt: v})}/>
        <FieldRow label="Tie"        value={groom.tie}        onChange={v => setGroom({...groom, tie: v})}/>
        <FieldRow label="Shoes"      value={groom.shoes}      onChange={v => setGroom({...groom, shoes: v})}/>
        <FieldRow label="Buttonhole" value={groom.buttonhole} onChange={v => setGroom({...groom, buttonhole: v})}/>
      </PartyCard>

      <PartyCard title="Bride" subtitle="Bryony Olwyn-Davis" accent="var(--marigold-500)">
        <FieldRow label="Designer" value={bride.designer} onChange={v => setBride({...bride, designer: v})}/>
        <FieldRow label="Dress"    value={bride.dress}    onChange={v => setBride({...bride, dress: v})}/>
        <FieldRow label="Bouquet"  value={bride.bouquet}  onChange={v => setBride({...bride, bouquet: v})}/>
        <FieldRow label="Shoes"    value={bride.shoes}    onChange={v => setBride({...bride, shoes: v})}/>
        <FieldRow label="Earrings" value={bride.earrings} onChange={v => setBride({...bride, earrings: v})}/>
        <FieldRow label="Perfume"  value={bride.perfume}  onChange={v => setBride({...bride, perfume: v})}/>
      </PartyCard>

      <PartyCard title="Groomsmen" subtitle={`${groomsmen.members.split(',').length} men`} accent="var(--moss-500)">
        <FieldRow label="Members"     value={groomsmen.members}    onChange={v => setGroomsmen({...groomsmen, members: v})} multiline/>
        <FieldRow label="Style"       value={groomsmen.style}      onChange={v => setGroomsmen({...groomsmen, style: v})}/>
        <FieldRow label="Shirt"       value={groomsmen.shirt}      onChange={v => setGroomsmen({...groomsmen, shirt: v})}/>
        <FieldRow label="Tie"         value={groomsmen.tie}        onChange={v => setGroomsmen({...groomsmen, tie: v})}/>
        <FieldRow label="Shoes"       value={groomsmen.shoes}      onChange={v => setGroomsmen({...groomsmen, shoes: v})}/>
        <FieldRow label="Fitting due" value={groomsmen.fittingDue} onChange={v => setGroomsmen({...groomsmen, fittingDue: v})}/>
      </PartyCard>

      <PartyCard title="Bridesmaids" subtitle="Aimee + TBC" accent="var(--marigold-500)">
        <FieldRow label="Members"     value={bridesmaids.members}    onChange={v => setBridesmaids({...bridesmaids, members: v})} multiline/>
        <FieldRow label="Dress code"  value={bridesmaids.dressCode}  onChange={v => setBridesmaids({...bridesmaids, dressCode: v})}/>
        <FieldRow label="Supplier"    value={bridesmaids.supplier}   onChange={v => setBridesmaids({...bridesmaids, supplier: v})}/>
        <FieldRow label="Bouquet"     value={bridesmaids.bouquet}    onChange={v => setBridesmaids({...bridesmaids, bouquet: v})}/>
        <FieldRow label="Shoes"       value={bridesmaids.shoes}      onChange={v => setBridesmaids({...bridesmaids, shoes: v})}/>
        <FieldRow label="Notes"       value={bridesmaids.notes}      onChange={v => setBridesmaids({...bridesmaids, notes: v})}/>
      </PartyCard>

      <div style={{ gridColumn: '1 / -1' }}>
        <PartyCard title="Children" subtitle="Flower girl & page boy" accent="var(--moss-500)">
          <FieldRow label="Flower girl" value={children.flowerGirl} onChange={v => setChildren({...children, flowerGirl: v})}/>
          <FieldRow label="Page boy"    value={children.pageBoy}    onChange={v => setChildren({...children, pageBoy: v})}/>
          <FieldRow label="Role"        value={children.role}       onChange={v => setChildren({...children, role: v})}/>
        </PartyCard>
      </div>
    </div>
  );
};

// ── Roles tab ───────────────────────────────────────────────────────────────
const RolesTab = () => {
  const [roles, setRoles] = React.useState([
    { id: 1, role: 'Best Man',          person: 'Joshua Dickson',       contact: 'josh@email.com',    confirmed: true  },
    { id: 2, role: 'Maid of Honour',    person: 'Aimee Hollingsworth',  contact: 'aimee@email.com',   confirmed: true  },
    { id: 3, role: 'Groomsman',         person: 'Connern Gilbert',      contact: 'connern@email.com', confirmed: true  },
    { id: 4, role: 'Groomsman',         person: 'Phill Scott',          contact: 'phill@email.com',   confirmed: true  },
    { id: 5, role: 'Bridesmaid',        person: 'TBC',                  contact: '',                  confirmed: false },
    { id: 6, role: 'Flower Girl',       person: 'Clara (age 4)',        contact: 'via parents',       confirmed: true  },
    { id: 7, role: 'Page Boy',          person: 'Torin (age 7)',        contact: 'via parents',       confirmed: true  },
    { id: 8, role: 'Ring Keeper',       person: 'Joshua Dickson',       contact: 'josh@email.com',    confirmed: true  },
    { id: 9, role: 'Witness',           person: 'Joshua Dickson',       contact: 'josh@email.com',    confirmed: true  },
    { id:10, role: 'Witness',           person: 'Aimee Hollingsworth',  contact: 'aimee@email.com',   confirmed: true  },
  ]);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-muted)' }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Person</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r,i) => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
              <td style={{ padding: '10px 16px', color: 'var(--ink-primary)', fontWeight: 500 }}>{r.role}</td>
              <td style={{ padding: '10px 16px' }}>
                <input
                  value={r.person}
                  onChange={e => setRoles(rs => rs.map(x => x.id === r.id ? {...x, person: e.target.value} : x))}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--ink-primary)', padding: '2px 0' }}
                />
              </td>
              <td style={{ padding: '10px 16px' }}>
                <input
                  value={r.contact}
                  onChange={e => setRoles(rs => rs.map(x => x.id === r.id ? {...x, contact: e.target.value} : x))}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)', padding: '2px 0' }}
                />
              </td>
              <td style={{ padding: '10px 16px' }}>
                <span
                  onClick={() => setRoles(rs => rs.map(x => x.id === r.id ? {...x, confirmed: !x.confirmed} : x))}
                  style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: r.confirmed ? 'var(--moss-50)' : 'var(--marigold-50)', color: r.confirmed ? 'var(--moss-700)' : 'var(--marigold-700)', border: `1px solid ${r.confirmed ? 'var(--moss-100)' : 'var(--marigold-100)'}` }}>
                  {r.confirmed ? '✓ Confirmed' : 'TBC'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Stag & Hen tab ──────────────────────────────────────────────────────────
const StagHenTab = () => {
  const [stag, setStag] = React.useState({
    date: 'Saturday 18 July 2026',
    location: 'Edinburgh',
    organiser: 'Joshua Dickson',
    attendees: '8',
    accommodation: 'Booked — pre-paid by attendees',
    plan: "Friday: arrive, dinner at The Devil's Advocate. Saturday: distillery tour + pub crawl. Sunday: brunch + train home.",
    cost: '£280 per person (incl. accom + meals)',
  });
  const [hen, setHen] = React.useState({
    date: 'Saturday 11 July 2026',
    location: 'Cotswolds — Daylesford spa weekend',
    organiser: 'Aimee Hollingsworth',
    attendees: '7',
    accommodation: 'Cottage booked — pre-paid by attendees',
    plan: 'Friday: arrive, prosecco welcome. Saturday: spa day + cocktail-making class + dinner. Sunday: brunch + walk + home.',
    cost: '£320 per person (incl. accom + activities)',
  });

  const Panel = ({ title, accent, data, setData }) => (
    <PartyCard title={title} accent={accent}>
      <FieldRow label="Date"          value={data.date}          onChange={v => setData({...data, date: v})}/>
      <FieldRow label="Location"      value={data.location}      onChange={v => setData({...data, location: v})}/>
      <FieldRow label="Organiser"     value={data.organiser}     onChange={v => setData({...data, organiser: v})}/>
      <FieldRow label="Attendees"     value={data.attendees}     onChange={v => setData({...data, attendees: v})}/>
      <FieldRow label="Accommodation" value={data.accommodation} onChange={v => setData({...data, accommodation: v})}/>
      <FieldRow label="Plan"          value={data.plan}          onChange={v => setData({...data, plan: v})} multiline/>
      <FieldRow label="Cost"          value={data.cost}          onChange={v => setData({...data, cost: v})}/>
    </PartyCard>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Panel title="Stag" accent="var(--moss-500)" data={stag} setData={setStag}/>
      <Panel title="Hen"  accent="var(--marigold-500)" data={hen}  setData={setHen}/>
    </div>
  );
};

// ── Day-of logistics tab ────────────────────────────────────────────────────
const DayOfTab = () => {
  const [rings, setRings] = React.useState({
    keeper: 'Joshua Dickson (Best Man)',
    pickup: 'Stratford Jewellery, Friday 24 Sep — task assigned to Jamie',
    handoff: 'Best Man holds both rings until ceremony · 1:30pm hand-off in groomsmen room',
    dayOfContact: 'Aimee Hollingsworth confirms with Josh at 12:30pm',
  });
  const [prep, setPrep] = React.useState({
    bridalRoom: 'Alveston Manor — Bridal Suite, from 9:00am',
    groomsmenRoom: 'Alveston Manor — Library, from 11:00am',
    breakfast: 'Continental delivered to both rooms at 9:30am',
    transport: 'Bridal car (vintage Rolls) arrives bridal suite 1:30pm',
  });
  const [transport, setTransport] = React.useState({
    bride: 'Vintage Rolls Royce · Stratford Wedding Cars · 1:30pm pickup',
    groom: 'Walking from groomsmen room at 1:45pm',
    eveningGuests: 'Coach service from Stratford station 6:30pm & 7:00pm',
    afterParty: 'Taxis pre-booked from venue — list with venue coordinator',
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <PartyCard title="Rings" accent="var(--marigold-700)">
        <FieldRow label="Keeper"          value={rings.keeper}        onChange={v => setRings({...rings, keeper: v})}/>
        <FieldRow label="Pickup"          value={rings.pickup}        onChange={v => setRings({...rings, pickup: v})} multiline/>
        <FieldRow label="Hand-off"        value={rings.handoff}       onChange={v => setRings({...rings, handoff: v})} multiline/>
        <FieldRow label="Day-of contact"  value={rings.dayOfContact}  onChange={v => setRings({...rings, dayOfContact: v})}/>
      </PartyCard>

      <PartyCard title="Getting ready" accent="var(--moss-500)">
        <FieldRow label="Bridal room"    value={prep.bridalRoom}    onChange={v => setPrep({...prep, bridalRoom: v})}/>
        <FieldRow label="Groomsmen room" value={prep.groomsmenRoom} onChange={v => setPrep({...prep, groomsmenRoom: v})}/>
        <FieldRow label="Breakfast"      value={prep.breakfast}     onChange={v => setPrep({...prep, breakfast: v})}/>
        <FieldRow label="Transport"      value={prep.transport}     onChange={v => setPrep({...prep, transport: v})}/>
      </PartyCard>

      <div style={{ gridColumn: '1 / -1' }}>
        <PartyCard title="Transport" accent="var(--moss-700)">
          <FieldRow label="Bride"          value={transport.bride}         onChange={v => setTransport({...transport, bride: v})}/>
          <FieldRow label="Groom"          value={transport.groom}         onChange={v => setTransport({...transport, groom: v})}/>
          <FieldRow label="Evening guests" value={transport.eveningGuests} onChange={v => setTransport({...transport, eveningGuests: v})}/>
          <FieldRow label="After-party"    value={transport.afterParty}    onChange={v => setTransport({...transport, afterParty: v})}/>
        </PartyCard>
      </div>
    </div>
  );
};

// ── Section page wrapper ────────────────────────────────────────────────────
const WeddingPartySection = ({ onBack }) => {
  const [tab, setTab] = React.useState('outfits');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Cover band */}
      <div style={{ background: 'var(--moss-100)', borderBottom: '1px solid var(--border-soft)', padding: '20px 28px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', fontSize: 13, fontFamily: 'var(--font-ui)', marginBottom: 12 }}>← Wedding Book</button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.2 }}>Wedding Party</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>Outfits, roles, stag &amp; hen, day-of logistics — click any field to edit</div>
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 6 }}>Last edited by Bryony · 3 days ago</div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, marginTop: 18, marginBottom: -21, borderBottom: '1px solid var(--border-soft)' }}>
          {PARTY_TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: active ? 'var(--bg-surface)' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? 'var(--border-soft)' : 'transparent',
                  borderBottomColor: active ? 'var(--bg-surface)' : 'transparent',
                  borderRadius: '6px 6px 0 0',
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 28px 60px', background: 'var(--bg-muted)' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          {tab === 'outfits' && <OutfitsTab/>}
          {tab === 'roles'   && <RolesTab/>}
          {tab === 'stag'    && <StagHenTab/>}
          {tab === 'dayof'   && <DayOfTab/>}
        </div>
      </div>
    </div>
  );
};

window.WeddingPartySection = WeddingPartySection;
