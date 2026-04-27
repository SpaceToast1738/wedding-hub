/* Wedding Hub — Tasks Page (List + Kanban + Detail Sheet) */

const TASK_VIEWS_ALL = ['All','Mine','Questions','Done','Budget','Groom Prep','Bride Prep','Groomsmen Prep','Bridesmaid Prep','Best Man','Maid of Honour','Admin','Legal'];
const TASK_VIEWS_NON_COUPLE = TASK_VIEWS_ALL.filter(v => v !== 'Budget');

const TASKS_DATA = [
  { id:1,  type:'Task',     title:'Confirm final guest count',             assignee:'Bryony Olwyn-Davis',     priority:'HIGH', status:'TODO',  due:'19 Sep', category:'Admin' },
  { id:2,  type:'Task',     title:'Pay venue balance',                     assignee:'Jamie Spencer',          priority:'HIGH', status:'TODO',  due:'26 Aug', category:'Budget' },
  { id:3,  type:'Task',     title:'Collect flowers from Paintbox Blooms',  assignee:'Jamie Spencer',          priority:'MED',  status:'TODO',  due:'23 Sep', category:'Admin' },
  { id:4,  type:'Task',     title:'Confirm suit fittings with Slaters',    assignee:'Jamie Spencer',          priority:'MED',  status:'DOING', due:'15 Aug', category:'Groom Prep' },
  { id:5,  type:'Task',     title:'Book groomsmen transport',               assignee:'Joshua Dickson',         priority:'MED',  status:'TODO',  due:'01 Sep', category:'Groomsmen Prep' },
  { id:6,  type:'Task',     title:'Arrange bridal suite decorations',       assignee:'Bryony Olwyn-Davis',     priority:'MED',  status:'DOING', due:'20 Sep', category:'Bride Prep' },
  { id:7,  type:'Task',     title:'Finalise order of service',              assignee:'Jamie Spencer',          priority:'HIGH', status:'DOING', due:'10 Sep', category:'Admin' },
  { id:8,  type:'Task',     title:'Confirm final menu with venue',          assignee:'Bryony Olwyn-Davis',     priority:'HIGH', status:'TODO',  due:'12 Sep', category:'Admin' },
  { id:9,  type:'Task',     title:'Write speech',                           assignee:'Jamie Spencer',          priority:'HIGH', status:'DOING', due:'20 Sep', category:'Groom Prep' },
  { id:10, type:'Task',     title:'Write speech',                           assignee:'Joshua Dickson',         priority:'HIGH', status:'TODO',  due:'20 Sep', category:'Best Man' },
  { id:11, type:'Task',     title:'Organise hen do',                        assignee:'Aimee Hollingsworth',    priority:'MED',  status:'DONE',  due:'01 Aug', category:'Maid of Honour' },
  { id:12, type:'Task',     title:'Organise stag do',                       assignee:'Joshua Dickson',         priority:'MED',  status:'DONE',  due:'01 Aug', category:'Best Man' },
  { id:13, type:'Task',     title:'Send rehearsal dinner invites',          assignee:'Bryony Olwyn-Davis',     priority:'LOW',  status:'TODO',  due:'15 Aug', category:'Admin' },
  { id:14, type:'Task',     title:'Confirm flower girl outfit',             assignee:'Bryony Olwyn-Davis',     priority:'MED',  status:'DONE',  due:'10 Aug', category:'Bride Prep' },
  { id:15, type:'Task',     title:'Bridesmaid dress fittings',              assignee:'Aimee Hollingsworth',    priority:'HIGH', status:'DONE',  due:'20 Jul', category:'Bridesmaid Prep' },
  { id:16, type:'Question', title:'What time is check-in on the day?',     assignee:'Aimee Hollingsworth',    priority:'MED',  status:'DONE',  due:'',       category:'Admin',   answer:'Check-in for bridal suite is 12:00 noon. Groomsmen rooms available from 2pm.' },
  { id:17, type:'Question', title:'What are the children\'s meal choices?', assignee:'Bryony Olwyn-Davis',     priority:'HIGH', status:'DONE',  due:'',       category:'Admin',   answer:'Melon & Berry starter, Roast Chicken & Veg main, Fresh Fruit Salad dessert.' },
  { id:18, type:'Question', title:'Where can the flower arch be placed?',   assignee:'Bryony Olwyn-Davis',     priority:'MED',  status:'TODO',  due:'',       category:'Admin',   answer:'' },
  { id:19, type:'Question', title:'Is there parking for 50 guests?',        assignee:'Jamie Spencer',          priority:'MED',  status:'TODO',  due:'',       category:'Admin',   answer:'' },
  { id:20, type:'Decision', title:'Confirm witnesses (2 people, over 18)',  assignee:'Jamie Spencer',          priority:'HIGH', status:'DONE',  due:'',       category:'Legal' },
  { id:21, type:'Task',     title:'Collect wedding rings from Stratford',   assignee:'Jamie Spencer',          priority:'HIGH', status:'TODO',  due:'24 Sep', category:'Groom Prep' },
  { id:22, type:'Task',     title:'Confirm catering numbers for evening buffet', assignee:'Bryony Olwyn-Davis', priority:'MED', status:'TODO', due:'05 Sep', category:'Admin' },
  { id:23, type:'Task',     title:'Chase photographer for contract copy',   assignee:'Jamie Spencer',          priority:'LOW',  status:'TODO',  due:'01 Aug', category:'Admin' },
  { id:24, type:'Task',     title:'Order wedding favours',                  assignee:'Bryony Olwyn-Davis',     priority:'MED',  status:'DONE',  due:'01 Jul', category:'Admin' },
  { id:25, type:'Task',     title:'Return signed insurance documents',      assignee:'Jamie Spencer',          priority:'HIGH', status:'DONE',  due:'01 Jun', category:'Legal' },
  { id:26, type:'Task',     title:'Pay florist final balance',              assignee:'Bryony Olwyn-Davis',     priority:'HIGH', status:'TODO',  due:'12 Sep', category:'Budget' },
  { id:27, type:'Task',     title:'Pay photographer balance',               assignee:'Jamie Spencer',          priority:'HIGH', status:'TODO',  due:'19 Sep', category:'Budget' },
  { id:28, type:'Task',     title:'Reconcile honeymoon fund contributions', assignee:'Bryony Olwyn-Davis',     priority:'LOW',  status:'TODO',  due:'05 Oct', category:'Budget' },
];

const GROOMSMEN_SCHEDULE = [
  { time: '10:00 am', title: 'Groomsmen arrive at venue', date: '26 Sep' },
  { time: '1:00 pm',  title: 'Get dressed & ready', date: '26 Sep' },
  { time: '1:45 pm',  title: 'Groomsmen in position at ceremony', date: '26 Sep' },
];

const TasksPage = ({ viewer }) => {
  const isCouple = viewer && viewer.couple;
  const TASK_VIEWS = isCouple ? TASK_VIEWS_ALL : TASK_VIEWS_NON_COUPLE;
  const [view, setView] = React.useState('List');
  const [savedView, setSavedView] = React.useState('All');
  const [selectedTask, setSelectedTask] = React.useState(null);
  const [tasks, setTasks] = React.useState(TASKS_DATA);

  const filterTasks = (ts) => {
    // Budget tasks are couple-only — hide entirely for everyone else
    const visible = isCouple ? ts : ts.filter(t => t.category !== 'Budget');
    ts = visible;
    switch(savedView) {
      case 'Mine':       return ts.filter(t => t.assignee === (viewer ? viewer.name : 'Jamie Spencer'));
      case 'Budget':     return ts.filter(t => t.category === 'Budget');
      case 'Questions':  return ts.filter(t => t.type === 'Question');
      case 'Done':       return ts.filter(t => t.status === 'DONE');
      case 'Groom Prep': return ts.filter(t => t.category === 'Groom Prep');
      case 'Bride Prep': return ts.filter(t => t.category === 'Bride Prep');
      case 'Groomsmen Prep': return ts.filter(t => t.category === 'Groomsmen Prep');
      case 'Bridesmaid Prep': return ts.filter(t => t.category === 'Bridesmaid Prep');
      case 'Best Man':   return ts.filter(t => t.category === 'Best Man');
      case 'Maid of Honour': return ts.filter(t => t.category === 'Maid of Honour');
      case 'Admin':      return ts.filter(t => t.category === 'Admin');
      case 'Legal':      return ts.filter(t => t.category === 'Legal');
      default: return ts;
    }
  };

  const filtered = filterTasks(tasks);
  const showScheduleBlock = ['Groomsmen Prep','Groom Prep','Bride Prep','Best Man','Maid of Honour','Bridesmaid Prep'].includes(savedView);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Tasks"
        subtitle={`${(isCouple ? tasks : tasks.filter(t=>t.category!=='Budget')).filter(t=>t.status!=='DONE').length} open · ${(isCouple ? tasks : tasks.filter(t=>t.category!=='Budget')).filter(t=>t.status==='DONE').length} done`}
        actions={
          <>
            <Button variant="ghost" size="sm">Export</Button>
            <Button variant="primary" size="sm">+ New task</Button>
          </>
        }
        tabs={['List','Board']}
        activeTab={view}
        onTabChange={setView}
      />

      {/* Filter pills */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: 6, overflow: 'auto', flexShrink: 0, background: 'var(--bg-surface)' }}>
        {TASK_VIEWS.map(v => (
          <Tag key={v} label={v} active={savedView === v} onClick={() => setSavedView(v)}/>
        ))}
        <Tag label="+ View" onClick={() => {}}/>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'List' ? (
          <TaskListView tasks={filtered} onSelect={setSelectedTask} showScheduleBlock={showScheduleBlock} savedView={savedView}/>
        ) : (
          <TaskBoardView tasks={filtered} onSelect={setSelectedTask}/>
        )}
      </div>

      {selectedTask && (
        <TaskDetailSheet
          task={tasks.find(t => t.id === selectedTask) || tasks[0]}
          onClose={() => setSelectedTask(null)}
          onUpdate={(id, changes) => setTasks(ts => ts.map(t => t.id === id ? {...t, ...changes} : t))}
        />
      )}
    </div>
  );
};

// ── List view ──────────────────────────────────────────────────────────────
const TaskListView = ({ tasks, onSelect, showScheduleBlock, savedView }) => (
  <div style={{ padding: '0 0 40px' }}>
    {showScheduleBlock && (
      <div style={{ margin: '16px 24px', background: 'var(--bg-muted)', borderRadius: 'var(--r-md)', padding: '12px 16px', border: '1px solid var(--border-soft)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          {savedView} · Day-of Schedule
        </div>
        {GROOMSMEN_SCHEDULE.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '6px 0', borderBottom: i < GROOMSMEN_SCHEDULE.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', width: 60, flexShrink: 0 }}>{ev.time}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{ev.title}</span>
          </div>
        ))}
      </div>
    )}
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
          {['','Title','Assignee','Priority','Status','Due'].map((h,i) => (
            <th key={i} style={{ padding: i === 1 ? '9px 12px 9px 0' : '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', background: 'var(--bg-canvas)', position: 'sticky', top: 0, whiteSpace: 'nowrap', paddingLeft: i === 0 ? 24 : undefined }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tasks.map((task, i) => (
          <TaskRow key={task.id} task={task} onSelect={() => onSelect(task.id)} isLast={i === tasks.length - 1}/>
        ))}
      </tbody>
    </table>
    {tasks.length === 0 && (
      <EmptyState Illustration={EmptyTasks} headline="No tasks here" subline="This view is empty. Create a task or change your filter." action={<Button variant="primary" size="sm">+ New task</Button>}/>
    )}
  </div>
);

const TaskRow = ({ task, onSelect, isLast }) => {
  const isQuestion = task.type === 'Question';
  const isDecision = task.type === 'Decision';
  return (
    <tr className="row-hover" onClick={onSelect} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-soft)', cursor: 'pointer' }}>
      <td style={{ padding: '8px 8px 8px 24px', width: 16 }}>
        <PriorityDot priority={task.priority}/>
      </td>
      <td style={{ padding: '8px 12px 8px 0', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {isQuestion && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-info)', background: '#eef4f5', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>?</span>}
          {isDecision && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--marigold-700)', background: 'var(--marigold-100)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>△</span>}
          <span style={{ fontSize: 13, color: 'var(--ink-primary)', fontWeight: task.status === 'DONE' ? 400 : 500, textDecoration: task.status === 'DONE' ? 'line-through' : 'none', opacity: task.status === 'DONE' ? 0.55 : 1 }}>
            {task.title}
          </span>
        </div>
        {isQuestion && task.answer && (
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2, paddingLeft: 28 }}>{task.answer}</div>
        )}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar name={task.assignee} size={18}/>
          <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{task.assignee.split(' ')[0]}</span>
        </div>
      </td>
      <td style={{ padding: '8px 12px' }}>
        <StatusPill status={task.priority} />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <StatusPill status={task.status} label={task.status === 'DONE' && task.type === 'Question' ? 'Answered' : task.status}/>
      </td>
      <td style={{ padding: '8px 24px 8px 12px', fontSize: 12, color: task.due === 'Today' ? 'var(--status-danger)' : 'var(--ink-tertiary)', whiteSpace: 'nowrap' }}>
        {task.due || '—'}
      </td>
    </tr>
  );
};

// ── Board view ─────────────────────────────────────────────────────────────
const KANBAN_COLS = [
  { id: 'TODO',  label: 'To do' },
  { id: 'DOING', label: 'In progress' },
  { id: 'DONE',  label: 'Done' },
];

const TaskBoardView = ({ tasks, onSelect }) => (
  <div style={{ display: 'flex', gap: 12, padding: 24, height: '100%', overflow: 'auto', alignItems: 'flex-start' }}>
    {KANBAN_COLS.map(col => {
      const colTasks = tasks.filter(t => t.status === col.id);
      return (
        <div key={col.id} style={{ width: 280, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)' }}>{col.label}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-tertiary)', background: 'var(--bg-muted)', padding: '1px 6px', borderRadius: 8 }}>{colTasks.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {colTasks.map(task => (
              <div key={task.id} onClick={() => onSelect(task.id)} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-md)', padding: '12px 14px',
                boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='var(--shadow-sm)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                  {task.type === 'Question' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--status-info)', background: '#eef4f5', padding: '1px 4px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>?</span>}
                  {task.type === 'Decision' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--marigold-700)', background: 'var(--marigold-100)', padding: '1px 4px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>△</span>}
                  <span style={{ fontSize: 13, color: 'var(--ink-primary)', fontWeight: 500, lineHeight: 1.4 }}>{task.title}</span>
                </div>
                {task.answer && <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginBottom: 8, lineHeight: 1.4, fontStyle: 'italic' }}>{task.answer}</div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Avatar name={task.assignee} size={18}/>
                    <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{task.assignee.split(' ')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {task.due && <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{task.due}</span>}
                    <PriorityDot priority={task.priority}/>
                  </div>
                </div>
              </div>
            ))}
            <button style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12, color: 'var(--ink-tertiary)', fontFamily: 'var(--font-ui)' }}>
              + Add task
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ── Detail sheet ───────────────────────────────────────────────────────────
const TaskDetailSheet = ({ task, onClose, onUpdate }) => {
  const [status, setStatus] = React.useState(task.status);
  const [answer, setAnswer] = React.useState(task.answer || '');

  return (
    <RightSheet title={task.title} subtitle={`${task.type} · ${task.category}`} onClose={onClose}>
      {task.type === 'Question' && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Answer</SectionLabel>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Add the answer here…"
            style={{ width: '100%', minHeight: 80, padding: '8px 10px', fontSize: 13, border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)', resize: 'vertical' }}
          />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {[
          ['Status', <div style={{display:'flex',gap:6}}>{['TODO','DOING','DONE'].map(s=><button key={s} onClick={()=>setStatus(s)} style={{fontSize:12,padding:'4px 10px',borderRadius:'var(--r-sm)',border:`1px solid ${status===s?'var(--moss-500)':'var(--border-soft)'}`,background:status===s?'var(--moss-50)':'var(--bg-surface)',color:status===s?'var(--moss-700)':'var(--ink-secondary)',cursor:'pointer',fontFamily:'var(--font-ui)',fontWeight:status===s?600:400}}>{s}</button>)}</div>],
          ['Assignee', <div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={task.assignee} size={22}/><span style={{fontSize:13,color:'var(--ink-primary)'}}>{task.assignee}</span></div>],
          ['Priority', <StatusPill status={task.priority}/>],
          ['Due date', <span style={{fontSize:13,color:'var(--ink-secondary)'}}>{task.due || '—'}</span>],
          ['Category', <span style={{fontSize:13,color:'var(--ink-secondary)'}}>{task.category}</span>],
          ['Type', <span style={{fontSize:13,color:'var(--ink-secondary)'}}>{task.type}</span>],
        ].map(([label, value], i) => (
          <div key={i}>
            <SectionLabel>{label}</SectionLabel>
            <div style={{ marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
      <Divider style={{ marginBottom: 16 }}/>
      <div>
        <SectionLabel>Description</SectionLabel>
        <textarea placeholder="Add more detail…" style={{ width: '100%', minHeight: 100, padding: '8px 10px', fontSize: 13, border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontFamily: 'var(--font-ui)', resize: 'vertical', marginTop: 4 }}/>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button variant="primary" size="sm" onClick={() => { onUpdate(task.id, { status, answer }); onClose(); }}>Save changes</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </RightSheet>
  );
};

Object.assign(window, { TasksPage, TASKS_DATA });
