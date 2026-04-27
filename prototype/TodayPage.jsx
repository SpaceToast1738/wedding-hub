/* Wedding Hub — Today Dashboard + At a Glance (with viewer role + day-of mode) */

const WEDDING_DATE = new Date('2026-09-26T14:00:00');
const TODAY_OVERRIDE_KEY = 'wh_today_override';
const COUNTDOWN_UNIT_KEY = 'wh_countdown_unit';

const getDaysUntil = () => Math.ceil((WEDDING_DATE - new Date()) / (1000 * 60 * 60 * 24));
const getMonthsUntil = () => {
  const now = new Date();
  const months = (WEDDING_DATE.getFullYear() - now.getFullYear()) * 12 + (WEDDING_DATE.getMonth() - now.getMonth());
  const dayDiff = WEDDING_DATE.getDate() - now.getDate();
  return Math.max(0, months + (dayDiff >= 0 ? 0 : -1));
};
const getWeeksUntil = () => Math.ceil(getDaysUntil() / 7);

const MY_TASKS = [
  { id: 1, title: 'Confirm final guest count', due: 'Fri 19 Sep', priority: 'HIGH', done: false },
  { id: 2, title: 'Pay venue balance', due: 'Wed 26 Aug', priority: 'HIGH', done: false },
  { id: 3, title: 'Collect flowers', due: 'Tue 23 Sep', priority: 'MED', done: false },
  { id: 4, title: 'Confirm suit fittings with Slaters', due: 'Today', priority: 'MED', done: false },
  { id: 5, title: 'Send final numbers to Alveston Manor', due: 'Mon 14 Sep', priority: 'HIGH', done: true },
];

const UPCOMING_EVENTS = [
  { time: '1:00 pm',  title: 'Arrival',           date: '26 Sep', who: 'Everyone' },
  { time: '2:00 pm',  title: 'Ceremony',           date: '26 Sep', who: 'Everyone' },
  { time: '2:30 pm',  title: 'Drinks Reception',   date: '26 Sep', who: 'Everyone' },
  { time: '4:00 pm',  title: 'Wedding Breakfast',  date: '26 Sep', who: 'Everyone' },
  { time: '6:00 pm',  title: 'Speeches',           date: '26 Sep', who: 'Groom · Best Man' },
];

// Day-of timeline (used when viewing on/after wedding day)
const DAYOF_EVENTS = [
  { time: '12:00', title: 'Bridal suite check-in',     who: 'Bryony · Bridesmaids',   status: 'past' },
  { time: '1:00',  title: 'Arrival',                    who: 'Everyone',               status: 'past' },
  { time: '2:00',  title: 'Ceremony',                   who: 'Everyone',               status: 'now' },
  { time: '2:30',  title: 'Drinks Reception',           who: 'Everyone',               status: 'next' },
  { time: '4:00',  title: 'Wedding Breakfast',          who: 'Everyone',               status: 'upcoming' },
  { time: '6:00',  title: 'Speeches',                   who: 'Groom · Best Man · MoH', status: 'upcoming' },
  { time: '7:30',  title: 'First Dance',                who: 'Everyone',               status: 'upcoming' },
  { time: '8:00',  title: 'Evening Buffet',             who: 'Everyone',               status: 'upcoming' },
];

const DAYOF_CONTACTS = [
  { name: 'Louis Brough',     role: 'Photographer · CG Media',  phone: '07923 456789' },
  { name: 'Alveston Manor',   role: 'Venue coordinator',         phone: '01789 205478' },
  { name: 'Paintbox Blooms',  role: 'Florist',                   phone: '07712 345678' },
  { name: 'Bespoke Weddings', role: 'Planner · day-of contact',  phone: '07900 112233' },
];

const TodayPage = ({ onNavigate, viewer }) => {
  const [tasks, setTasks] = React.useState(MY_TASKS);
  const [persona, setPersona] = React.useState('mine');
  // Day-of mode: real or simulated
  const [dayOfMode, setDayOfMode] = React.useState(() => {
    try { return localStorage.getItem(TODAY_OVERRIDE_KEY) === 'true'; } catch { return false; }
  });
  React.useEffect(() => { try { localStorage.setItem(TODAY_OVERRIDE_KEY, dayOfMode); } catch {} }, [dayOfMode]);

  const toggleTask = (id) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));

  if (dayOfMode) {
    return <DayOfMode onExit={() => setDayOfMode(false)} viewer={viewer}/>;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Page title */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 600, color: 'var(--ink-primary)' }}>Today</h1>
            <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 3 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDayOfMode(true)}>◉ Day-of mode</Button>
        </div>

        {/* 3-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <CountdownCard/>
          <TasksCard tasks={tasks} onToggle={toggleTask} onSeeAll={() => onNavigate('tasks')} />
          <EventsCard events={UPCOMING_EVENTS} persona={persona} onPersonaChange={setPersona} onSeeAll={() => onNavigate('schedule')} />
        </div>

        {/* RSVP snapshot strip */}
        <div style={{ marginTop: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Snapshot</div>
          {[
            ['50 invited', 'var(--ink-primary)'],
            ['22 confirmed', 'var(--moss-500)'],
            ['28 pending', 'var(--marigold-500)'],
            ['4 vegetarian · 1 GF', 'var(--ink-secondary)'],
            ['3 children · 1 highchair', 'var(--ink-secondary)'],
          ].map(([label, color], i) => (
            <div key={i} style={{ fontSize: 13, color, fontWeight: 500 }}>{label}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Countdown card with months/days/weeks toggle ─────────────────────────
const CountdownCard = () => {
  const [unit, setUnit] = React.useState(() => {
    try { return localStorage.getItem(COUNTDOWN_UNIT_KEY) || 'days'; } catch { return 'days'; }
  });
  React.useEffect(() => { try { localStorage.setItem(COUNTDOWN_UNIT_KEY, unit); } catch {} }, [unit]);

  const value = unit === 'days' ? getDaysUntil() : unit === 'weeks' ? getWeeksUntil() : getMonthsUntil();

  return (
    <div style={{
      background: 'var(--marigold-100)',
      border: '1px solid rgba(216,155,60,0.25)',
      borderRadius: 'var(--r-md)', padding: '24px 22px',
      boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden', minHeight: 200,
    }}>
      <IllusCountdown width={220} height={130} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--marigold-700)' }}>Until the wedding</div>
          {/* Unit segmented */}
          <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.6)', borderRadius: 999, padding: 2 }}>
            {['months','weeks','days'].map(u => (
              <button key={u} onClick={() => setUnit(u)} style={{
                fontSize: 10, padding: '3px 8px', border: 'none', borderRadius: 999, cursor: 'pointer',
                background: unit === u ? 'var(--moss-500)' : 'transparent',
                color: unit === u ? '#fff' : 'var(--marigold-700)',
                fontFamily: 'var(--font-ui)', fontWeight: unit === u ? 600 : 500,
              }}>{u[0].toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 700, lineHeight: 1, color: 'var(--moss-700)', marginBottom: 4 }}>
          {value}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--moss-700)', fontWeight: 600, marginBottom: 14 }}>
          {unit}
        </div>
        <div style={{ fontSize: 13, color: 'var(--marigold-700)', fontWeight: 500 }}>Jamie & Bryony's Wedding</div>
        <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2 }}>26 September 2026 · Alveston Manor</div>
      </div>
    </div>
  );
};

// ── Day-of mode ──────────────────────────────────────────────────────────
const DayOfMode = ({ onExit, viewer }) => (
  <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--moss-50)' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Hero band */}
      <div style={{ background: 'var(--moss-700)', color: '#fff', borderRadius: 'var(--r-lg)', padding: '24px 28px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>Day of · Saturday 26 September 2026</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, marginTop: 4 }}>Today is the day.</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Alveston Manor · {viewer ? `Logged in as ${viewer.name}` : ''}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>← Exit day-of mode</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {/* Live timeline */}
        <div style={{ gridColumn: 'span 2', minWidth: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 14 }}>Live timeline</div>
          {DAYOF_EVENTS.map((ev, i) => {
            const isNow = ev.status === 'now';
            const isPast = ev.status === 'past';
            const isNext = ev.status === 'next';
            return (
              <div key={i} style={{
                display: 'flex', gap: 14, padding: '12px 14px',
                borderRadius: 'var(--r-sm)',
                background: isNow ? 'var(--marigold-100)' : isNext ? 'var(--moss-50)' : 'transparent',
                borderLeft: isNow ? '3px solid var(--marigold-500)' : isNext ? '3px solid var(--moss-500)' : '3px solid transparent',
                opacity: isPast ? 0.45 : 1,
                marginBottom: 4,
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: isNow ? 'var(--marigold-700)' : 'var(--ink-primary)', width: 64, flexShrink: 0 }}>{ev.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-primary)', textDecoration: isPast ? 'line-through' : 'none' }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 2 }}>{ev.who}</div>
                </div>
                {isNow && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--marigold-700)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 8, alignSelf: 'flex-start' }}>NOW</span>}
                {isNext && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--moss-700)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 8, alignSelf: 'flex-start' }}>NEXT</span>}
              </div>
            );
          })}
        </div>

        {/* Day-of contacts */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 14 }}>Day-of contacts</div>
          {DAYOF_CONTACTS.map((c, i) => (
            <a key={i} href={`tel:${c.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < DAYOF_CONTACTS.length-1 ? '1px solid var(--border-soft)' : 'none', textDecoration: 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--moss-100)', color: 'var(--moss-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>☎</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{c.role}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--moss-500)', fontWeight: 500 }}>{c.phone}</span>
            </a>
          ))}
        </div>

        {/* Dietary at a glance */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 14 }}>Catering today</div>
          {[
            ['Vegetarian',     '4 mains'],
            ['Gluten-free',    '1'],
            ['Children\'s meals', '3'],
            ['Highchair',      '1'],
            ['Total covers',   '50 day · 75 evening'],
          ].map(([k,v],i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 4 ? '1px solid var(--border-soft)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-primary)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 14 }}>Open quickly</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['◧ Shot list','book'],['⊛ Seating chart','seating'],['◷ Full schedule','schedule'],['◎ Guests with allergies','guests']].map(([label, page]) => (
              <button key={label} style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Tasks card ─────────────────────────────────────────────────────────────
const TasksCard = ({ tasks, onToggle, onSeeAll }) => (
  <div style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }}>
    <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>My open tasks</span>
      <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{tasks.filter(t => !t.done).length} open</span>
    </div>
    <div style={{ flex: 1, padding: '4px 0' }}>
      {tasks.slice(0, 5).map(task => (
        <div key={task.id} className="row-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px',
          opacity: task.done ? 0.5 : 1, transition: 'opacity 0.15s',
        }}>
          <span style={{ width: 4, height: 16, borderRadius: 2, background: task.priority === 'HIGH' ? 'var(--status-danger)' : task.priority === 'MED' ? 'var(--marigold-500)' : 'var(--ink-tertiary)', flexShrink: 0 }}/>
          <button onClick={() => onToggle(task.id)} style={{
            width: 16, height: 16, borderRadius: 4,
            border: `1.5px solid ${task.done ? 'var(--moss-500)' : 'var(--border-strong)'}`,
            background: task.done ? 'var(--moss-500)' : 'transparent',
            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, padding: 0,
          }}>{task.done ? '✓' : ''}</button>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-primary)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</span>
          <span style={{ fontSize: 11, color: task.due === 'Today' ? 'var(--status-danger)' : 'var(--ink-tertiary)', fontWeight: task.due === 'Today' ? 600 : 400 }}>{task.due}</span>
        </div>
      ))}
    </div>
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-soft)' }}>
      <button onClick={onSeeAll} style={{ fontSize: 12, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
        See all 116 tasks →
      </button>
    </div>
  </div>
);

// ── Events card ────────────────────────────────────────────────────────────
const EventsCard = ({ events, persona, onPersonaChange, onSeeAll }) => (
  <div style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }}>
    <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)', flex: 1 }}>Upcoming events</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {['mine','everyone'].map(p => (
          <button key={p} onClick={() => onPersonaChange(p)} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: persona === p ? 'var(--moss-500)' : 'transparent',
            color: persona === p ? '#fff' : 'var(--ink-tertiary)',
            border: `1px solid ${persona === p ? 'var(--moss-500)' : 'var(--border-soft)'}`,
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>{p === 'mine' ? 'Mine' : 'Everyone'}</button>
        ))}
      </div>
    </div>
    <div style={{ flex: 1, padding: '4px 0' }}>
      {events.map((ev, i) => (
        <div key={i} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', width: 52, flexShrink: 0 }}>{ev.time}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{ev.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{ev.who}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{ev.date}</div>
        </div>
      ))}
    </div>
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-soft)' }}>
      <button onClick={onSeeAll} style={{ fontSize: 12, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
        Full schedule →
      </button>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// AT A GLANCE PAGE
// ══════════════════════════════════════════════════════════════════════════════

const RECENT_ACTIVITY_FULL = [
  { who: 'Bryony', action: 'updated RSVP for Harrison Speight', time: '2h ago',  page: 'guests' },
  { who: 'Jamie',  action: 'marked "Pay rings deposit" as done', time: '4h ago',  page: 'tasks' },
  { who: 'Aimee',  action: 'added communication log for Paintbox Blooms', time: 'Yesterday', page: 'suppliers' },
  { who: 'Josh',   action: 'updated seating for Table 4', time: 'Yesterday', page: 'seating' },
  { who: 'Bryony', action: 'updated the Budget — Florist',     time: '2 days ago', page: 'budget' }, // restricted
  { who: 'Jamie',  action: 'added payment: WeddingPlan Insurance', time: '3 days ago', page: 'payments' }, // restricted
  { who: 'Bryony', action: 'confirmed Georgia & James Blondel RSVP', time: '3 days ago', page: 'guests' },
];

const AtAGlancePage = ({ onNavigate, viewer }) => {
  const isCouple = viewer && viewer.couple;
  const canSeeBudget = isCouple;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 600, color: 'var(--ink-primary)' }}>At a Glance</h1>
          <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 3 }}>Overview of your wedding planning progress</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {/* RSVPs */}
          <GlanceCard title="RSVPs" onViewAll={() => onNavigate('guests')}>
            <RSVPDonut confirmed={22} pending={28} total={50} />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Recent</div>
              {[{name:'Harrison Speight',status:'YES'},{name:'Georgia Blondel',status:'YES'},{name:'Luke Maple',status:'PENDING'}].map((g,i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? '1px solid var(--border-soft)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-primary)' }}>{g.name}</span>
                  <StatusPill status={g.status} label={g.status === 'YES' ? 'Confirmed' : 'Pending'} />
                </div>
              ))}
            </div>
          </GlanceCard>

          {/* Budget — couple only */}
          {canSeeBudget ? (
            <GlanceCard title="Budget" onViewAll={() => onNavigate('budget')}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 4 }}>£14,500</div>
              <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginBottom: 14 }}>planned total</div>
              <BudgetBar paid={3961.62} committed={4200} total={14500} />
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <div><div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>Paid</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--moss-500)' }}>£3,961</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>Committed</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--marigold-500)' }}>£4,200</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>Remaining</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)' }}>£6,338</div></div>
              </div>
            </GlanceCard>
          ) : (
            // Replaced with countdown / focus card
            <GlanceCard title="Wedding day">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--marigold-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--moss-700)' }}>{getDaysUntil()}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>days to go</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>26 September 2026</div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-tertiary)' }}>🔒</span>
                Budget is restricted to Jamie & Bryony
              </div>
            </GlanceCard>
          )}

          {/* Payments due — couple only */}
          {canSeeBudget ? (
            <GlanceCard title="Payments due" onViewAll={() => onNavigate('payments')}>
              <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginBottom: 12 }}>Next 30 days</div>
              {[
                { vendor: 'Alveston Manor', amount: '£3,960', due: '26 Aug' },
                { vendor: 'Paintbox Blooms', amount: '£335', due: '01 Sep' },
                { vendor: 'CG Media', amount: '£985', due: '15 Sep' },
              ].map((p,i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 2 ? '1px solid var(--border-soft)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-primary)' }}>{p.vendor}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>Due {p.due}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{p.amount}</div>
                </div>
              ))}
            </GlanceCard>
          ) : (
            <GlanceCard title="My open tasks" onViewAll={() => onNavigate('tasks')}>
              {MY_TASKS.filter(t => !t.done).slice(0,4).map((t,i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < 3 ? '1px solid var(--border-soft)' : 'none' }}>
                  <span style={{ width: 4, height: 14, borderRadius: 2, background: t.priority === 'HIGH' ? 'var(--status-danger)' : 'var(--marigold-500)', flexShrink: 0 }}/>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-primary)' }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{t.due}</span>
                </div>
              ))}
            </GlanceCard>
          )}

          {/* Recent activity — redacts restricted-page edits for non-couple */}
          <GlanceCard title="Recent activity">
            {RECENT_ACTIVITY_FULL.map((a, i) => {
              const restricted = !canSeeBudget && (a.page === 'budget' || a.page === 'payments');
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < RECENT_ACTIVITY_FULL.length - 1 ? '1px solid var(--border-soft)' : 'none', opacity: restricted ? 0.65 : 1 }}>
                  <Avatar name={a.who + ' '} size={22}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-primary)' }}>{a.who} </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-secondary)', fontStyle: restricted ? 'italic' : 'normal' }}>
                      {restricted ? 'updated a private page' : a.action}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 1 }}>{a.time}</div>
                  </div>
                </div>
              );
            })}
          </GlanceCard>
        </div>
      </div>
    </div>
  );
};

const GlanceCard = ({ title, children, onViewAll }) => (
  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
    <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{title}</span>
      {onViewAll && <button onClick={onViewAll} style={{ fontSize: 11, color: 'var(--moss-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>View all →</button>}
    </div>
    <div style={{ padding: '14px 18px' }}>{children}</div>
  </div>
);

const RSVPDonut = ({ confirmed, pending, total }) => {
  const r = 44, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const confirmedArc = (confirmed / total) * circ;
  const pendingArc = (pending / total) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-soft)" strokeWidth={10}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--moss-500)" strokeWidth={10}
          strokeDasharray={`${confirmedArc} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0c97a" strokeWidth={10}
          strokeDasharray={`${pendingArc} ${circ}`} strokeDashoffset={-(confirmedArc - circ * 0.25)} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="var(--font-display)" fill="var(--ink-primary)">{confirmed}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)" fontFamily="var(--font-ui)">of {total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--moss-500)', display: 'inline-block' }}/><span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{confirmed} confirmed</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0c97a', display: 'inline-block' }}/><span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{pending} pending</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-soft)', display: 'inline-block' }}/><span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>0 declined</span></div>
      </div>
    </div>
  );
};

const BudgetBar = ({ paid, committed, total }) => (
  <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden', display: 'flex' }}>
    <div style={{ width: `${(paid / total) * 100}%`, background: 'var(--moss-500)', transition: 'width 0.5s' }}/>
    <div style={{ width: `${(committed / total) * 100}%`, background: 'var(--marigold-500)', opacity: 0.7, transition: 'width 0.5s' }}/>
  </div>
);

Object.assign(window, { TodayPage, AtAGlancePage });
