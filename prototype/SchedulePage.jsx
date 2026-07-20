/* Wedding Hub — Schedule Page (Illustrated Itinerary) */

const SCHEDULE_EVENTS = [
  { id:1, time:'1:00 pm',  title:'Arrival',           location:'Alveston Manor, front entrance', personas:['Everyone'], icon:'Ring',     notes:'Guests welcomed by ushers. Order of service handed out.' },
  { id:2, time:'2:00 pm',  title:'Ceremony',           location:'The Shakespeare Suite',          personas:['Everyone'], icon:'Candle',   notes:'Ceremony approx 25 minutes. Registrar: Warwickshire Registrar.' },
  { id:3, time:'2:30 pm',  title:'Drinks Reception',   location:'Garden / Drawing Room',          personas:['Everyone'], icon:'Bouquet',  notes:'Canapés and arrival drinks. Photography begins. Weather permitting — garden.' },
  { id:4, time:'4:00 pm',  title:'Wedding Breakfast',  location:'The Charlecote Suite',           personas:['Everyone'], icon:'Plate',    notes:'3-course meal. 50 guests. Children\'s menu available.' },
  { id:5, time:'6:00 pm',  title:'Speeches',           location:'The Charlecote Suite',           personas:['Groom','Best Man','Father of Bride'], icon:'Ring', notes:'Jamie, then Josh, then Father of Bride. Order TBC.' },
  { id:6, time:'7:30 pm',  title:'Wedding Reception',  location:'The Charlecote Suite',           personas:['Everyone'], icon:'Bouquet',  notes:'DJ begins. First dance. Evening guests arrive from 8pm.' },
  { id:7, time:'8:30 pm',  title:'Evening Buffet',     location:'The Charlecote Suite',           personas:['Everyone'], icon:'Plate',    notes:'Buffet opens. See evening food list for details.' },
  { id:8, time:'11:59 pm', title:'Home Time',           location:'Departure',                      personas:['Everyone'], icon:'Suitcase', notes:'Venue close. Bridal suite available for couple. Taxis pre-booked.' },
];

const ICON_MAP = { Ring: IcoRing, Candle: IcoCandle, Plate: IcoPlate, Camera: IcoCamera, Bouquet: IcoBouquet, Suitcase: IcoSuitcase };

const SCHEDULE_VIEWS = ['All','Day Before','Wedding Day','Groom','Bride','Bridesmaids','Groomsmen','Flower Girl & Boy','Supplier'];

const SchedulePage = () => {
  const [activeView, setActiveView] = React.useState('All');
  const [expanded, setExpanded] = React.useState(null);
  const [printMode, setPrintMode] = React.useState(false);

  const filtered = activeView === 'All' || activeView === 'Wedding Day'
    ? SCHEDULE_EVENTS
    : SCHEDULE_EVENTS.filter(e => e.personas.includes('Everyone') || e.personas.some(p => p.toLowerCase().includes(activeView.toLowerCase().split(' ')[0])));

  if (printMode) return <SchedulePrint events={SCHEDULE_EVENTS} onClose={() => setPrintMode(false)} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Schedule"
        subtitle="24 September 2026 · Alveston Manor"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPrintMode(true)}>⎙ Print</Button>
            <Button variant="primary" size="sm">+ Add event</Button>
          </>
        }
      />

      {/* Filter pills */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: 6, overflow: 'auto', flexShrink: 0, background: 'var(--bg-surface)' }}>
        {SCHEDULE_VIEWS.map(v => <Tag key={v} label={v} active={activeView === v} onClick={() => setActiveView(v)}/>)}
      </div>

      {/* Itinerary */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 0 64px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          {/* Vertical hairline */}
          <div style={{ position: 'absolute', left: 104, top: 0, bottom: 0, width: 1, background: 'var(--border-soft)' }}/>

          {filtered.map((event, idx) => {
            const IconComp = ICON_MAP[event.icon] || IcoRing;
            const isExpanded = expanded === event.id;
            return (
              <div key={event.id} style={{ display: 'flex', gap: 0, marginBottom: idx < filtered.length - 1 ? 48 : 0 }}>
                {/* Time */}
                <div style={{ width: 80, flexShrink: 0, paddingTop: 3, textAlign: 'right', paddingRight: 16 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}>
                    {event.time}
                  </span>
                </div>

                {/* Node dot */}
                <div style={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-surface)', border: '1.5px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', zIndex: 1 }}>
                    <IconComp size={16}/>
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: 4, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : event.id)}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                    {event.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: isExpanded ? 10 : 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-tertiary)' }}>📍 {event.location}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {event.personas.map(p => (
                      <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: p === 'Everyone' ? 'var(--moss-50)' : 'var(--marigold-100)', color: p === 'Everyone' ? 'var(--moss-700)' : 'var(--marigold-700)', border: `1px solid ${p === 'Everyone' ? 'var(--moss-100)' : '#f0d9a8'}` }}>{p}</span>
                    ))}
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.6, background: 'var(--bg-muted)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-soft)' }}>
                      {event.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <EmptyState Illustration={EmptySchedule} headline="No events in this view" subline="Try a different filter to see schedule events."/>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Print layout ──────────────────────────────────────────────────────────
const SchedulePrint = ({ events, onClose }) => (
  <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-canvas)' }}>
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink-primary)' }}>Jamie & Bryony</div>
          <div style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>24 September 2026 · Alveston Manor, Stratford-upon-Avon</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>← Back</Button>
      </div>
      <Divider style={{ marginBottom: 32 }}/>
      {events.map((event, idx) => {
        const IconComp = ICON_MAP[event.icon] || IcoRing;
        return (
          <div key={event.id} style={{ display: 'flex', gap: 24, marginBottom: 28, alignItems: 'flex-start' }}>
            <div style={{ width: 72, flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink-secondary)' }}>{event.time}</div>
            </div>
            <div style={{ width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
              <IconComp size={18}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 3 }}>{event.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginBottom: 4 }}>{event.location}</div>
              {event.notes && <div style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{event.notes}</div>}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                {event.personas.map(p => <span key={p} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--ink-tertiary)', border: '1px solid var(--border-soft)' }}>{p}</span>)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

Object.assign(window, { SchedulePage });
