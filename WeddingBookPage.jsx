/* Wedding Hub — Wedding Book Hub + Photography Section Page */

// Real content seeded for each section, by subheading
const BOOK_CONTENT = {
  party: {
    'Groom':                ['Jamie Spencer', 'Suit: Slaters · navy three-piece, ivory shirt, sage tie', 'Buttonhole: white rose & eucalyptus from Paintbox Blooms', 'Shoes: Oxford brown brogues'],
    'Groomsmen':            ['Joshua Dickson (Best Man) · suit hire from Slaters', 'Connern Gilbert · suit hire from Slaters', 'Phill Scott · suit hire from Slaters', 'All matching navy three-piece, ivory shirt, sage tie'],
    'Bride':                ['Bryony Olwyn-Davis', 'Dress: Eve Estelle, A-line ivory with chapel-length veil', 'Bouquet: white roses, eucalyptus, dried wheat', 'Shoes: Rainbow Club, ivory satin block heel · 5cm'],
    'Bridesmaids':          ['Aimee Hollingsworth (Maid of Honour) · Sage green floor-length', "Dress code: 'sage' — exact shade TBC, dresses to be ordered together", 'Bouquets: smaller versions of bride bouquet'],
    'Flower Girl & Page Boy': ['Clara (flower girl, age 4) · ivory dress with sage sash', 'Torin (page boy, age 7) · navy waistcoat & shorts', 'Will scatter petals down the aisle'],
    'Stag':                 ['Date: Saturday 18 July 2026', 'Location: Edinburgh weekend', 'Organised by Joshua Dickson · 8 attendees', 'Pre-paid · accommodation booked'],
    'Hen':                  ['Date: Saturday 11 July 2026', 'Location: Cotswolds spa weekend', 'Organised by Aimee Hollingsworth · 7 attendees', 'Pre-paid · accommodation booked'],
    'Ring keepers':         ['Joshua Dickson — both rings until ceremony', 'Hand-off in groomsmen room at 1:30pm', 'Confirm with Aimee day-of'],
  },
  venue: {
    'Ceremony':             ['Alveston Manor · The Shakespeare Suite', 'Capacity: 60 seated', '2:00pm start, 30 minutes', 'Aisle runner: ivory · arch from venue (rustic)'],
    'Reception':            ['Alveston Manor · The Garden Room', '5 round tables of 8 + head table', 'Drinks reception in walled garden if dry, library if not'],
    'Evening':              ['Same room — tables cleared after speeches', 'DJ from 8:00pm · dance floor centred', 'Evening guests arrive 7:00pm'],
    'Signage':              ['Welcome sign at entrance · ordered from Etsy', 'Order of the day · printed by VistaPrint', 'Table plan · A1 framed, sage & ivory', 'Top table seating cards'],
    'Setup logistics':      ['Venue setup from 10am Saturday morning', 'Florist arrives 10:30am', 'Photographer arrives 12:30pm', 'All suppliers checked in via venue coordinator'],
    'Pack-down':            ['Venue handles main breakdown', 'Pickups Sunday 26th: gifts, cards, leftover cake', 'Florist collects vases Monday'],
    'Tables & centrepieces':['Round tables seat 8 · 5 tables', 'Centrepieces: lantern + eucalyptus · provided by Paintbox', 'Place names: ivory tent cards, calligraphy by bride', 'Table numbers 1-5, head table separate'],
  },
  food: { /* Food has special rendering with dietary aggregate */ },
  guest: {
    'Pixel Party':          ['Live photo wall · guests text photos to a number, appear on screen', 'Provider: Pixel Party UK · £180 for the day', 'Test 1 week before with sample number'],
    'Table games':          ['Each table has a printed icebreaker card', '"How do you know the couple?" prompts', 'Polaroid camera per table for guest snaps'],
    'Wedding favours':      ['Mini jars of local Stratford honey', 'Custom labels with date + names', 'Quantity: 50 · supplied by The Honey Pot Stratford'],
    'Photo booth':          ['Provider: Dream Wedding & Events', 'Open: 7:30pm – 10:30pm', 'Includes props, prints, digital gallery', 'Backdrop: ivory floral wall'],
    'Guest book':           ['Polaroid + signature book on entry table', 'Aimee to prompt guests during drinks reception', 'Take home Sunday morning'],
  },
  legal: {
    'Notice of Marriage':   ['Given at Stratford Register Office: 14 March 2026', 'Both parties attended in person', 'Certificate valid until 13 March 2027 (well within wedding date)'],
    'Required documents':   ['Passports (current) · ✓ both', 'Proof of address (utility bill < 3 months) · ✓ both', 'Decree absolute / death certificate if applicable · N/A', 'Bring to ceremony in document folder'],
    'Witnesses':            ['Joshua Dickson (Best Man) · confirmed', 'Aimee Hollingsworth (Maid of Honour) · confirmed', 'Both must sign register during ceremony', 'Backup witness: Connern Gilbert'],
    'Before the ceremony':  ['Registrar pre-meeting at 1:30pm with both parties separately', 'Confirm vows wording & ring exchange', 'Confirm any readings or music'],
    'During':               ['Welcome & legal preliminaries', 'Vows · Bryony first, then Jamie', 'Ring exchange', 'Signing of register (with witnesses)', 'Pronouncement & recessional'],
    'After':                ['Marriage certificate posted to home address within 14 days', 'Apply for new passport / driving licence in married name (optional)', 'Notify HMRC, bank, employer'],
  },
  accomm: {
    'Bridal suite':         ['Alveston Manor · Suite 1 · 2 nights (Fri & Sat)', 'Check-in: Friday 25 Sep from 3pm', 'Includes breakfast for two', 'Bridal preparation room from 9am Saturday'],
    "Bridesmaids' night-before": ['Alveston Manor · 2 twin rooms (Rooms 4 & 5)', 'Check-in: Friday 25 Sep from 3pm', 'Aimee, plus 2 bridesmaids confirmed', 'Pizza & prosecco evening — pre-ordered from venue'],
    "Groomsmen's night-before": ['Alveston Manor · 1 family room + 1 twin (Rooms 2 & 3)', 'Check-in: Friday 25 Sep from 3pm', 'Joshua, Connern, Phill confirmed', 'Pub dinner at the Black Swan (5min walk) at 7pm'],
  },
};

const BOOK_SECTIONS = [
  { id:'party',    title:'Wedding Party',              desc:'Outfits, roles, stag & hen, ring keepers',     Illustration: IllusWeddingParty,  accent:'var(--moss-100)',   subheadings:['Groom','Groomsmen','Bride','Bridesmaids','Flower Girl & Page Boy','Stag','Hen','Ring keepers'] },
  { id:'venue',    title:'Venue, Décor & Setup',       desc:'Ceremony, reception, signage, centrepieces',   Illustration: IllusVenue,         accent:'var(--moss-50)',    subheadings:['Ceremony','Reception','Evening','Signage','Setup logistics','Pack-down','Tables & centrepieces'] },
  { id:'food',     title:'Food & Drink',               desc:'Breakfast, evening food, cake, drinks',        Illustration: IllusFood,          accent:'var(--marigold-100)', subheadings:['Wedding Breakfast','Drinks','Toast','Evening Buffet','The Cake Project'] },
  { id:'photo',    title:'Photography & Videography',  desc:'Package, shot list, locations, day-of contact',Illustration: IllusPhotography,   accent:'var(--moss-100)',   subheadings:['Package booked','Coverage included','Shot List','Locations','Day-of contact'] },
  { id:'guest',    title:'Guest Experience',           desc:'Pixel Party, table games, photo booth, favours',Illustration: IllusGuestExp,     accent:'var(--marigold-100)', subheadings:['Pixel Party','Table games','Wedding favours','Photo booth','Guest book'] },
  { id:'legal',    title:'Legal & Admin',              desc:'Notice of marriage, documents, witnesses',     Illustration: IllusLegal,         accent:'var(--moss-50)',    subheadings:['Notice of Marriage','Required documents','Witnesses','Before the ceremony','During','After'] },
  { id:'accomm',   title:'Accommodation',              desc:'Bridal suite, bridesmaids, groomsmen',         Illustration: IllusAccommodation, accent:'var(--marigold-100)', subheadings:["Bridal suite","Bridesmaids' night-before","Groomsmen's night-before"] },
];

const SHOT_LIST = [
  { id:1, title:'Couple portraits',         guests:['Jamie Spencer','Bryony Olwyn-Davis'],  notes:'Garden if dry, library if not', captured:false },
  { id:2, title:'Whole wedding party',      guests:['Jamie Spencer','Bryony Olwyn-Davis','Joshua Dickson','Sarah Loughran','Aimee Hollingsworth','Uldis Elksnis'], notes:'Front lawn', captured:false },
  { id:3, title:"Bride's immediate family", guests:['Bryony Olwyn-Davis','Torin Davis','Tia King'],  notes:'Drawing room', captured:false },
  { id:4, title:"Groom's immediate family", guests:['Jamie Spencer','Tyler Spencer'],        notes:'Library', captured:false },
  { id:5, title:'Ring keepers with rings',  guests:['Joshua Dickson','Aimee Hollingsworth','Jamie Spencer','Bryony Olwyn-Davis'], notes:'Before ceremony', captured:false },
  { id:6, title:'Flower girl & page boy',   guests:['Clara','Torin (page boy)'],             notes:'Garden', captured:false },
];

const WeddingBookPage = () => {
  const [openSection, setOpenSection] = React.useState(null);

  if (openSection) {
    if (openSection === 'party') {
      return <WeddingPartySection onBack={() => setOpenSection(null)} />;
    }
    const section = BOOK_SECTIONS.find(s => s.id === openSection);
    return <BookSectionPage section={section} onBack={() => setOpenSection(null)} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Wedding Book"
        subtitle="Your complete reference for every detail"
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* 2-3-2 grid layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {BOOK_SECTIONS.map(section => (
              <BookCard key={section.id} section={section} onClick={() => setOpenSection(section.id)}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Book hub card ──────────────────────────────────────────────────────────
const BookCard = ({ section, onClick }) => {
  const { Illustration } = section;
  return (
    <div onClick={onClick} style={{
      background: section.accent, border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-lg)', padding: '24px 20px',
      cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
      minHeight: 160,
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
        <Illustration size={48}/>
        <span style={{ fontSize: 14, color: 'var(--ink-tertiary)', opacity: 0.5 }}>→</span>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.2, marginBottom: 5 }}>
          {section.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>{section.desc}</div>
      </div>
    </div>
  );
};

// ── Book section page (document archetype) ──────────────────────────────────
const BookSectionPage = ({ section, onBack }) => {
  const [audienceOpen, setAudienceOpen] = React.useState(false);
  const isPhoto = section.id === 'photo';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Cover band */}
      <div style={{ background: section.accent, borderBottom: '1px solid var(--border-soft)', padding: '20px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', fontSize: 13, fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 4 }}>← Wedding Book</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.2 }}>{section.title}</h1>
            <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 4 }}>Last edited by Bryony · 3 days ago</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAudienceOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 12, color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                🔓 Everyone
              </button>
              {audienceOpen && <AudiencePicker onClose={() => setAudienceOpen(false)}/>}
            </div>
          </div>
        </div>
        {/* On-this-page anchors */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {section.subheadings.map(h => (
            <a key={h} href={`#${h.replace(/\s+/g,'-').toLowerCase()}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-surface)', color: 'var(--ink-secondary)', border: '1px solid var(--border-soft)', textDecoration: 'none' }}>{h}</a>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 28px 60px' }}>
        <div style={{ maxWidth: 720 }}>
          {isPhoto ? (
            <PhotographyContent/>
          ) : (
            section.subheadings.map(heading => (
              <BookSubsection key={heading} sectionId={section.id} heading={heading}/>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ── Photography section ────────────────────────────────────────────────────
const PhotographyContent = () => {
  const [shots, setShots] = React.useState(SHOT_LIST);
  const [addingShot, setAddingShot] = React.useState(false);
  const [newShot, setNewShot] = React.useState({ title:'', notes:'' });
  const [printShots, setPrintShots] = React.useState(false);

  const toggleCapture = (id) => setShots(ss => ss.map(s => s.id === id ? {...s, captured: !s.captured} : s));

  if (printShots) return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Shot List — Jamie & Bryony</div>
        <Button variant="ghost" size="sm" onClick={() => setPrintShots(false)}>← Back</Button>
      </div>
      <Divider style={{ marginBottom: 16 }}/>
      {shots.map((s,i) => (
        <div key={s.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < shots.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'flex-start' }}>
          <div style={{ width: 16, height: 16, border: '1.5px solid var(--border-strong)', borderRadius: 3, marginTop: 2, flexShrink: 0 }}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{s.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-secondary)', marginTop: 2 }}>{s.guests.join(', ')}</div>
            {s.notes && <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2, fontStyle: 'italic' }}>{s.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {/* Standard doc sections */}
      {[['Package booked', 'CG Media · Louis Brough · Full-day coverage from bridal prep through first dance. Digital gallery within 8 weeks. Printed album optional extra.'],
        ['Coverage included', '10 hours full-day coverage. Bridal preparation, ceremony, drinks reception, wedding breakfast, speeches, first dance.'],
        ['Locations', 'Ceremony: The Shakespeare Suite. Portraits: Garden (weather permitting) or Library. Group shots: Front lawn.'],
        ['Day-of contact', 'Louis Brough · 07923 456789 · louis@cgmedia.co.uk · Arrives 12:30pm.']
      ].map(([heading, content]) => (
        <div key={heading} id={heading.replace(/\s+/g,'-').toLowerCase()} style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.7 }}>{content}</p>
        </div>
      ))}

      {/* Shot List embedded block */}
      <div id="shot-list" style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>Shot List</h2>
        <div style={{ background: 'var(--moss-50)', border: '1px solid var(--moss-100)', borderLeft: '3px solid var(--moss-500)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {/* Block header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--moss-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--moss-700)' }}>Shot List · {shots.filter(s=>s.captured).length}/{shots.length} captured</span>
            <button onClick={() => setPrintShots(true)} style={{ fontSize: 11, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>⎙ Print shot list</button>
          </div>
          {shots.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-tertiary)', fontStyle: 'italic' }}>No shots yet. Add the must-have combinations.</div>
          ) : (
            shots.map((shot, i) => (
              <div key={shot.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr auto', gap: 12, padding: '11px 16px', borderBottom: i < shots.length - 1 ? '1px solid var(--moss-100)' : 'none', alignItems: 'start' }}>
                <input type="checkbox" checked={shot.captured} onChange={() => toggleCapture(shot.id)} style={{ accentColor: 'var(--moss-500)', marginTop: 2 }}/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)', textDecoration: shot.captured ? 'line-through' : 'none', opacity: shot.captured ? 0.5 : 1 }}>{shot.title}</div>
                  {shot.notes && <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2, fontStyle: 'italic' }}>{shot.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {shot.guests.map(g => (
                    <span key={g} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--moss-700)', border: '1px solid var(--moss-100)' }}>{g.split(' ')[0]}</span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: shot.captured ? 'var(--moss-500)' : 'var(--ink-tertiary)', fontWeight: shot.captured ? 600 : 400 }}>{shot.captured ? 'Captured' : 'Planned'}</span>
              </div>
            ))
          )}
          {/* Add shot */}
          {!addingShot ? (
            <div style={{ padding: '10px 16px' }}>
              <button onClick={() => setAddingShot(true)} style={{ fontSize: 12, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>+ Add shot</button>
            </div>
          ) : (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--moss-100)', background: 'var(--bg-surface)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input value={newShot.title} onChange={e => setNewShot(n => ({...n, title: e.target.value}))} placeholder="Shot title…" style={{ flex: 1, minWidth: 120, fontSize: 13, padding: '6px 10px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)' }}/>
              <input value={newShot.notes} onChange={e => setNewShot(n => ({...n, notes: e.target.value}))} placeholder="Notes (optional)…" style={{ flex: 1, minWidth: 120, fontSize: 13, padding: '6px 10px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)' }}/>
              <Button variant="primary" size="sm" onClick={() => { if (newShot.title.trim()) { setShots(ss => [...ss, { id: Date.now(), ...newShot, guests:[], captured:false }]); setNewShot({title:'',notes:''}); setAddingShot(false); } }}>Add</Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingShot(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Audience picker ──────────────────────────────────────────────────────────
const AudiencePicker = ({ onClose }) => {
  const [selected, setSelected] = React.useState('Everyone');
  const options = ['Everyone','Couple only','Bride side','Groom side','Custom'];
  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={onClose}/>
      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: '8px 0', minWidth: 180, zIndex: 300 }}>
        <div style={{ padding: '6px 14px 10px', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visible to</div>
        {options.map(opt => (
          <button key={opt} onClick={() => { setSelected(opt); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: selected === opt ? 'var(--moss-700)' : 'var(--ink-primary)', fontFamily: 'var(--font-ui)', fontWeight: selected === opt ? 600 : 400 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${selected===opt?'var(--moss-500)':'var(--border-strong)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {selected === opt && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--moss-500)', display: 'inline-block' }}/>}
            </span>
            {opt}
          </button>
        ))}
      </div>
    </>
  );
};

// ── Book subsection (renders seeded content as bullets, with special cases) ─
const BookSubsection = ({ sectionId, heading }) => {
  const id = heading.replace(/\s+/g,'-').toLowerCase();
  const content = (BOOK_CONTENT[sectionId] || {})[heading];

  // Food & Drink subsections render with full menu cards + dietary aggregate
  if (sectionId === 'food') {
    return <FoodSubsection heading={heading}/>;
  }

  if (!content) {
    return (
      <div id={id} style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
        <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)', height: 48, display: 'flex', alignItems: 'center', padding: '0 14px', color: 'var(--ink-tertiary)', fontSize: 13, fontStyle: 'italic', border: '1px dashed var(--border-strong)' }}>
          Start writing about {heading.toLowerCase()}…
        </div>
      </div>
    );
  }

  return (
    <div id={id} style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {content.map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--moss-500)', flexShrink: 0, marginTop: 2 }}>•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ── Food & Drink with menus + dietary aggregate ─────────────────────────────
const MENUS = {
  'Wedding Breakfast': {
    starters: [
      { name: 'Roasted tomato & basil soup',         count: 32, tags: ['V','GF'] },
      { name: 'Pressed ham hock terrine',            count: 14, tags: [] },
      { name: 'Melon & berry plate (children)',      count: 3,  tags: ['V','GF'] },
    ],
    mains: [
      { name: 'Roast beef, Yorkshire pudding',       count: 28, tags: [] },
      { name: 'Pan-fried chicken, dauphinoise',      count: 14, tags: [] },
      { name: 'Wild mushroom risotto',               count: 4,  tags: ['V','GF'] },
      { name: 'Roast chicken & veg (children)',      count: 3,  tags: [] },
    ],
    desserts: [
      { name: 'Eton mess',                            count: 22, tags: ['V','GF'] },
      { name: 'Sticky toffee pudding',                count: 23, tags: ['V'] },
      { name: 'Fresh fruit salad (children)',         count: 3,  tags: ['V','GF'] },
    ]
  }
};

const FoodSubsection = ({ heading }) => {
  const id = heading.replace(/\s+/g,'-').toLowerCase();

  if (heading === 'Wedding Breakfast') {
    return (
      <div id={id} style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
        <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginBottom: 14 }}>50 covers · served at 4:00pm · Alveston Manor catering</div>

        {/* Dietary aggregate banner */}
        <DietaryAggregate/>

        {/* Three courses */}
        {[['Starters','starters'],['Mains','mains'],['Desserts','desserts']].map(([label, key]) => (
          <div key={key} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
            {MENUS['Wedding Breakfast'][key].map((dish, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-primary)', flex: 1 }}>{dish.name}</span>
                {dish.tags.map(t => (
                  <span key={t} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--moss-50)', color: 'var(--moss-700)', border: '1px solid var(--moss-100)' }}>{t}</span>
                ))}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', minWidth: 28, textAlign: 'right' }}>×{dish.count}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (heading === 'Drinks') return (
    <div id={id} style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {['Drinks reception: prosecco, Pimm\'s, elderflower spritz', 'Soft options: lemonade, sparkling water', 'Wine on tables: house red & white (1 bottle per 4 guests)', 'Cash bar from 7pm onwards'].map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--moss-500)', flexShrink: 0, marginTop: 2 }}>•</span><span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (heading === 'Toast') return (
    <div id={id} style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {['50 glasses prosecco at speeches (£7/head from venue)', 'Non-drinkers: elderflower spritz alternative', 'Glasses topped up by venue staff before speeches'].map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--moss-500)', flexShrink: 0, marginTop: 2 }}>•</span><span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (heading === 'Evening Buffet') return (
    <div id={id} style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
      <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginBottom: 10 }}>Served 8:00pm · 75 covers (50 day + 25 evening)</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {['Hog roast with stuffing & apple sauce', 'Vegetarian: halloumi & roasted veg wraps (×8)', 'Sides: skin-on fries, slaw, bread rolls', 'Mini desserts: cheesecake bites & brownies'].map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--moss-500)', flexShrink: 0, marginTop: 2 }}>•</span><span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (heading === 'The Cake Project') return (
    <div id={id} style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>{heading}</h2>
      <div style={{ background: 'var(--marigold-100)', border: '1px solid rgba(216,155,60,0.25)', borderRadius: 'var(--r-md)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--marigold-700)', marginBottom: 6 }}>Three-tier semi-naked, by Mum</div>
        <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
          Tier 1: lemon & elderflower · Tier 2: vanilla with raspberry compote · Tier 3: rich chocolate.<br/>
          Decorated with fresh eucalyptus and ivory roses on the day by Paintbox Blooms. Cut at 7:00pm before the first dance.
        </div>
      </div>
    </div>
  );

  return null;
};

const DietaryAggregate = () => {
  const aggregate = [
    { label: 'Vegetarian', count: 4, color: 'var(--moss-500)' },
    { label: 'Gluten-free', count: 1, color: 'var(--moss-500)' },
    { label: "Children's meals", count: 3, color: 'var(--marigold-500)' },
    { label: 'Highchair', count: 1, color: 'var(--marigold-500)' },
    { label: 'Allergies (declared)', count: 0, color: 'var(--ink-tertiary)' },
  ];
  const total = 50;

  return (
    <div style={{ background: 'var(--moss-50)', border: '1px solid var(--moss-100)', borderLeft: '3px solid var(--moss-500)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--moss-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dietary at a glance</div>
        <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 11, color: 'var(--moss-500)', textDecoration: 'none' }}>View per-guest →</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {aggregate.map(a => (
          <div key={a.label} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)', padding: '8px 10px', border: '1px solid var(--moss-100)' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: a.color, lineHeight: 1.1, marginTop: 2 }}>{a.count}</div>
          </div>
        ))}
        <div style={{ background: 'var(--moss-700)', color: '#fff', borderRadius: 'var(--r-sm)', padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total covers</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.1, marginTop: 2 }}>{total}</div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { WeddingBookPage, AudiencePicker });
