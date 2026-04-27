/* Wedding Hub — Q&A Page (filterable Questions database) */

const QUESTIONS_DATA = [
  { id:101, q:'What time is check-in on the day?',                 askedOf:'Aimee Hollingsworth',  askedBy:'Bryony Olwyn-Davis', answer:'Check-in for bridal suite is 12:00 noon. Groomsmen rooms available from 2pm.', status:'ANSWERED', priority:'MED',  due:'',         topic:'Venue', answeredAt:'12 Jul 2026' },
  { id:102, q:"What are the children's meal choices?",             askedOf:'Bryony Olwyn-Davis',   askedBy:'Jamie Spencer',     answer:'Melon & Berry starter, Roast Chicken & Veg main, Fresh Fruit Salad dessert.', status:'ANSWERED', priority:'HIGH', due:'',         topic:'Catering', answeredAt:'01 Aug 2026' },
  { id:103, q:'Where can the flower arch be placed?',              askedOf:'Bryony Olwyn-Davis',   askedBy:'Aimee Hollingsworth', answer:'',  status:'OPEN',     priority:'MED',  due:'01 Sep 2026', topic:'Décor' },
  { id:104, q:'Is there parking for 50 guests?',                   askedOf:'Jamie Spencer',        askedBy:'Joshua Dickson',    answer:'',  status:'OPEN',     priority:'MED',  due:'15 Sep 2026', topic:'Logistics' },
  { id:105, q:'Do we need a marquee in case of bad weather?',      askedOf:'Bryony Olwyn-Davis',   askedBy:'Jamie Spencer',     answer:'',  status:'OPEN',     priority:'HIGH', due:'01 Sep 2026', topic:'Venue' },
  { id:106, q:'Can the photographer stay through the first dance?',askedOf:'Jamie Spencer',        askedBy:'Bryony Olwyn-Davis', answer:'Yes — full day coverage runs through 9:30pm. Confirmed in contract.', status:'ANSWERED', priority:'LOW',  due:'',         topic:'Photography', answeredAt:'15 Feb 2026' },
  { id:107, q:'What time should the cake be cut?',                  askedOf:'Bryony Olwyn-Davis',   askedBy:'Aimee Hollingsworth', answer:'', status:'OPEN',     priority:'LOW',  due:'05 Sep 2026', topic:'Catering' },
  { id:108, q:'Are there enough vegetarian mains?',                 askedOf:'Bryony Olwyn-Davis',   askedBy:'Sarah Loughran',     answer:'Yes — 4 confirmed vegetarian mains (Butternut squash & Spinach pithivier).', status:'ANSWERED', priority:'MED', due:'', topic:'Catering', answeredAt:'14 Aug 2026' },
  { id:109, q:'Who is collecting the rings on the morning?',        askedOf:'Joshua Dickson',       askedBy:'Jamie Spencer',     answer:'Josh will collect from Stratford Jewellery on the 24th and bring to venue 1pm.', status:'ANSWERED', priority:'HIGH', due:'',         topic:'Wedding party', answeredAt:'20 Aug 2026' },
  { id:110, q:'Is there a cloakroom for evening guests?',           askedOf:'Aimee Hollingsworth',  askedBy:'Bryony Olwyn-Davis', answer:'',  status:'OPEN',     priority:'LOW',  due:'',           topic:'Venue' },
  { id:111, q:'When do we need final dietary requirements by?',     askedOf:'Bryony Olwyn-Davis',   askedBy:'Jamie Spencer',     answer:'14 days before — i.e. by Friday 12 Sep. Confirmed with Alveston Manor.', status:'ANSWERED', priority:'HIGH', due:'',         topic:'Catering', answeredAt:'01 Aug 2026' },
  { id:112, q:'Can we provide a song request form for guests?',     askedOf:'Aimee Hollingsworth',  askedBy:'Bryony Olwyn-Davis', answer:'',  status:'OPEN',     priority:'LOW',  due:'10 Sep 2026', topic:'Music' },
];

const Q_TOPICS = ['All','Venue','Catering','Décor','Logistics','Photography','Wedding party','Music'];
const Q_STATUSES = ['All','Open','Answered'];
const Q_PRIORITIES = ['All','HIGH','MED','LOW'];

const QuestionsPage = () => {
  const [topic, setTopic] = React.useState('All');
  const [status, setStatus] = React.useState('All');
  const [priority, setPriority] = React.useState('All');
  const [askedOf, setAskedOf] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [openId, setOpenId] = React.useState(null);
  const [questions, setQuestions] = React.useState(QUESTIONS_DATA);

  const allAskedOf = ['All', ...new Set(QUESTIONS_DATA.map(q => q.askedOf))];

  const filtered = questions.filter(q => {
    if (topic !== 'All' && q.topic !== topic) return false;
    if (status === 'Open' && q.status !== 'OPEN') return false;
    if (status === 'Answered' && q.status !== 'ANSWERED') return false;
    if (priority !== 'All' && q.priority !== priority) return false;
    if (askedOf !== 'All' && q.askedOf !== askedOf) return false;
    if (search && !q.q.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const open = filtered.filter(q => q.status === 'OPEN');
  const answered = filtered.filter(q => q.status === 'ANSWERED');

  const isOverdue = (q) => {
    if (q.status !== 'OPEN' || !q.due) return false;
    const dueDate = new Date(q.due.split(' ').reverse().join(' '));
    return dueDate < new Date('2026-09-26');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Questions"
        subtitle={`${questions.filter(q=>q.status==='OPEN').length} open · ${questions.filter(q=>q.status==='ANSWERED').length} answered`}
        actions={
          <>
            <Button variant="ghost" size="sm">Export</Button>
            <Button variant="primary" size="sm">+ Ask question</Button>
          </>
        }
      />

      {/* Filter bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search + segmented status */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search questions…"
            style={{ flex: 1, minWidth: 200, fontSize: 13, padding: '6px 12px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)' }}
          />
          <div style={{ display: 'flex', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {Q_STATUSES.map(s => (
              <button key={s} onClick={() => setStatus(s)} style={{
                fontSize: 12, padding: '5px 12px', border: 'none', cursor: 'pointer',
                background: status === s ? 'var(--moss-500)' : 'var(--bg-surface)',
                color: status === s ? '#fff' : 'var(--ink-secondary)',
                fontFamily: 'var(--font-ui)', fontWeight: status === s ? 600 : 400,
                borderLeft: s !== Q_STATUSES[0] ? '1px solid var(--border-soft)' : 'none',
              }}>{s}</button>
            ))}
          </div>
        </div>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Topic</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Q_TOPICS.map(t => <Tag key={t} label={t} active={topic === t} onClick={() => setTopic(t)}/>)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {Q_PRIORITIES.map(p => <Tag key={p} label={p} active={priority === p} onClick={() => setPriority(p)}/>)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asked of</span>
            <select value={askedOf} onChange={e => setAskedOf(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)' }}>
              {allAskedOf.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          {/* Open section */}
          {open.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Open</span>
                <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', background: 'var(--bg-muted)', padding: '1px 7px', borderRadius: 8 }}>{open.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {open.map(q => <QuestionCard key={q.id} q={q} overdue={isOverdue(q)} onOpen={() => setOpenId(q.id)}/>)}
              </div>
            </div>
          )}

          {/* Answered section */}
          {answered.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Answered</span>
                <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', background: 'var(--bg-muted)', padding: '1px 7px', borderRadius: 8 }}>{answered.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {answered.map(q => <QuestionCard key={q.id} q={q} answered onOpen={() => setOpenId(q.id)}/>)}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-tertiary)', fontSize: 13 }}>No questions match these filters.</div>
          )}
        </div>
      </div>

      {openId && <QuestionDetail q={questions.find(x => x.id === openId)} onClose={() => setOpenId(null)} onSave={(answer) => { setQuestions(qs => qs.map(x => x.id === openId ? {...x, answer, status: answer ? 'ANSWERED' : 'OPEN', answeredAt: answer ? '27 Apr 2026' : ''} : x)); setOpenId(null); }}/>}
    </div>
  );
};

const QuestionCard = ({ q, answered, overdue, onOpen }) => (
  <div onClick={onOpen} style={{
    background: answered ? 'var(--bg-surface)' : 'var(--moss-50)',
    border: `1px solid ${overdue ? 'var(--status-danger)' : answered ? 'var(--border-soft)' : 'var(--moss-100)'}`,
    borderLeft: `3px solid ${overdue ? 'var(--status-danger)' : answered ? 'var(--moss-500)' : 'var(--marigold-500)'}`,
    borderRadius: 'var(--r-md)', padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
  }}
  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: answered ? 'var(--moss-500)' : 'var(--marigold-700)', background: answered ? 'var(--moss-100)' : 'var(--marigold-100)', padding: '2px 7px', borderRadius: 4, flexShrink: 0, marginTop: 1 }}>?</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-primary)', lineHeight: 1.45, marginBottom: 4 }}>{q.q}</div>
        {answered ? (
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55, marginTop: 6, paddingLeft: 12, borderLeft: '2px solid var(--moss-100)' }}>{q.answer}</div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', fontStyle: 'italic', marginTop: 4 }}>No answer yet</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Avatar name={q.askedOf} size={18}/>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>Asked of <strong style={{ color: 'var(--ink-secondary)', fontWeight: 600 }}>{q.askedOf.split(' ')[0]}</strong></span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>·</span>
          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--ink-secondary)', border: '1px solid var(--border-soft)' }}>{q.topic}</span>
          <StatusPill status={q.priority}/>
          {!answered && q.due && (
            <span style={{ fontSize: 11, color: overdue ? 'var(--status-danger)' : 'var(--ink-tertiary)', fontWeight: overdue ? 600 : 400 }}>
              {overdue && '⚠ '}Due {q.due}
            </span>
          )}
          {answered && q.answeredAt && <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>Answered {q.answeredAt}</span>}
        </div>
      </div>
    </div>
  </div>
);

const QuestionDetail = ({ q, onClose, onSave }) => {
  const [answer, setAnswer] = React.useState(q.answer || '');
  return (
    <RightSheet title={q.q} subtitle={`Question · ${q.topic}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatusPill status={q.status === 'OPEN' ? 'TODO' : 'DONE'} label={q.status === 'OPEN' ? 'Open' : 'Answered'}/>
        <StatusPill status={q.priority}/>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionLabel>Asked by → Asked of</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Avatar name={q.askedBy} size={22}/>
          <span style={{ fontSize: 13, color: 'var(--ink-primary)' }}>{q.askedBy}</span>
          <span style={{ fontSize: 14, color: 'var(--moss-500)' }}>→</span>
          <Avatar name={q.askedOf} size={22}/>
          <span style={{ fontSize: 13, color: 'var(--ink-primary)' }}>{q.askedOf}</span>
        </div>
      </div>

      {q.due && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Due</SectionLabel>
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>{q.due}</div>
        </div>
      )}

      <Divider style={{ marginBottom: 14 }}/>

      <div>
        <SectionLabel>Answer</SectionLabel>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type the answer here…"
          style={{ width: '100%', minHeight: 100, padding: '10px 12px', fontSize: 13, border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)', resize: 'vertical', marginTop: 4 }}
        />
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button variant="primary" size="sm" onClick={() => onSave(answer)}>{answer ? 'Mark answered' : 'Save'}</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </RightSheet>
  );
};

Object.assign(window, { QuestionsPage, QUESTIONS_DATA });
