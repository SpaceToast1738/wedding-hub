/* Wedding Hub — Budget + Payments Pages */

const BUDGET_DATA = [
  { id:1,  category:'Venue',       item:'Drinks Reception',          vendor:'Alveston Manor',      estUnit:7,    qty:50, actUnit:7,    actQty:50 },
  { id:2,  category:'Venue',       item:'Wedding Breakfast (Adults)',vendor:'Alveston Manor',      estUnit:50,   qty:50, actUnit:50,   actQty:50 },
  { id:3,  category:'Venue',       item:'Wedding Breakfast (Children)',vendor:'Alveston Manor',    estUnit:30,   qty:3,  actUnit:30,   actQty:3 },
  { id:4,  category:'Venue',       item:'Toast Drinks',              vendor:'Alveston Manor',      estUnit:7,    qty:50, actUnit:7,    actQty:50 },
  { id:5,  category:'Venue',       item:'DJ',                        vendor:'Alveston Manor',      estUnit:500,  qty:1,  actUnit:500,  actQty:1 },
  { id:6,  category:'Venue',       item:'Rustic Arch',               vendor:'Alveston Manor',      estUnit:170,  qty:1,  actUnit:170,  actQty:1 },
  { id:7,  category:'Venue',       item:'Room hire',                 vendor:'Alveston Manor',      estUnit:800,  qty:1,  actUnit:800,  actQty:1 },
  { id:8,  category:'Photography', item:'Photographer',              vendor:'CG Media',            estUnit:1970, qty:1,  actUnit:1970, actQty:1 },
  { id:9,  category:'Photography', item:'Photo booth',               vendor:'Dream Wedding & Events',estUnit:595,qty:1,  actUnit:595,  actQty:1 },
  { id:10, category:'Florist',     item:'Flowers & arrangements',    vendor:'Paintbox Blooms',     estUnit:670,  qty:1,  actUnit:670,  actQty:1 },
  { id:11, category:'Florist',     item:'Bouquet',                   vendor:'Paintbox Blooms',     estUnit:150,  qty:1,  actUnit:0,    actQty:0 },
  { id:12, category:'Rings',       item:'Wedding rings',             vendor:'Stratford Jewellery', estUnit:300,  qty:2,  actUnit:300,  actQty:2 },
  { id:13, category:'Attire',      item:'Suits',                     vendor:'Slaters',             estUnit:200,  qty:3,  actUnit:0,    actQty:0 },
  { id:14, category:'Attire',      item:'Bridesmaids dresses',       vendor:'TBC',                 estUnit:150,  qty:3,  actUnit:0,    actQty:0 },
  { id:15, category:'Stationery',  item:'Invitations',               vendor:'VistaPrint',          estUnit:120,  qty:1,  actUnit:0,    actQty:0 },
  { id:16, category:'Stationery',  item:'Order of service',          vendor:'VistaPrint',          estUnit:80,   qty:1,  actUnit:0,    actQty:0 },
  { id:17, category:'Insurance',   item:'Wedding insurance',         vendor:'WeddingPlan',         estUnit:185,  qty:1,  actUnit:185,  actQty:1 },
  { id:18, category:'Planner',     item:'Wedding planner',           vendor:'Bespoke Weddings',    estUnit:1200, qty:1,  actUnit:1200, actQty:1 },
  { id:19, category:'Extras',      item:'Favours',                   vendor:'TBC',                 estUnit:120,  qty:1,  actUnit:0,    actQty:0 },
  { id:20, category:'Extras',      item:'Evening buffet extras',     vendor:'Alveston Manor',      estUnit:300,  qty:1,  actUnit:0,    actQty:0 },
];

const fmt = n => n > 0 ? `£${n.toLocaleString('en-GB', {minimumFractionDigits:2,maximumFractionDigits:2})}` : '—';
const fmtShort = n => n > 0 ? `£${n.toLocaleString('en-GB')}` : '—';

const BudgetPage = () => {
  const [collapsed, setCollapsed] = React.useState({});
  const toggleCat = (cat) => setCollapsed(c => ({...c, [cat]: !c[cat]}));

  const categories = [...new Set(BUDGET_DATA.map(r => r.category))];
  const totalEst = BUDGET_DATA.reduce((a,r) => a + r.estUnit*r.qty, 0);
  const totalAct = BUDGET_DATA.reduce((a,r) => a + r.actUnit*r.actQty, 0);
  const paid = 3961.62;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Budget"
        subtitle={`${BUDGET_DATA.length} line items · ${fmtShort(totalEst)} planned`}
        actions={
          <>
            <Button variant="ghost" size="sm">Export</Button>
            <Button variant="primary" size="sm">+ Add item</Button>
          </>
        }
      />

      {/* Summary bar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            ['Planned total', fmtShort(totalEst), 'var(--ink-primary)'],
            ['Actual total',  fmtShort(totalAct),  'var(--ink-secondary)'],
            ['Paid',          `£3,962`,             'var(--moss-500)'],
            ['Remaining',     fmtShort(totalEst - paid), 'var(--ink-tertiary)'],
          ].map(([label, val, color]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color, fontWeight: 600, marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${(paid/totalEst)*100}%`, background: 'var(--moss-500)' }}/>
          <div style={{ width: `${((totalAct-paid)/totalEst)*100}%`, background: 'var(--marigold-500)', opacity: 0.6 }}/>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          {[['Paid','var(--moss-500)'],['Committed','var(--marigold-500)']].map(([l,c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }}/>
              <span style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table — desktop */}
      <div className="budget-desktop" style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
              {['Item','Vendor','Est. unit','Qty','Est. total','Actual total'].map((h,i) => (
                <th key={i} style={{ padding: '9px 12px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', background: 'var(--bg-canvas)', position: 'sticky', top: 0, paddingLeft: i===0?24:undefined, paddingRight: i===5?24:undefined, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const rows = BUDGET_DATA.filter(r => r.category === cat);
              const catEst = rows.reduce((a,r) => a + r.estUnit*r.qty, 0);
              const catAct = rows.reduce((a,r) => a + r.actUnit*r.actQty, 0);
              const isCollapsed = collapsed[cat];
              return (
                <React.Fragment key={cat}>
                  {/* Category row */}
                  <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }} onClick={() => toggleCat(cat)}>
                    <td colSpan={4} style={{ padding: '9px 24px', fontWeight: 600, fontSize: 13, color: 'var(--ink-primary)' }}>
                      <span style={{ marginRight: 8, fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>{cat}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)' }}>{fmt(catEst)}</td>
                    <td style={{ padding: '9px 24px 9px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: catAct > 0 ? 'var(--ink-primary)' : 'var(--ink-tertiary)' }}>{catAct > 0 ? fmt(catAct) : '—'}</td>
                  </tr>
                  {/* Line items */}
                  {!isCollapsed && rows.map((row, i) => (
                    <tr key={row.id} className="row-hover" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '8px 12px 8px 40px', fontSize: 13, color: 'var(--ink-primary)' }}>{row.item}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink-secondary)' }}>{row.vendor || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: 'var(--ink-secondary)' }}>{fmt(row.estUnit)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: 'var(--ink-secondary)' }}>{row.qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: 'var(--ink-secondary)' }}>{fmt(row.estUnit*row.qty)}</td>
                      <td style={{ padding: '8px 24px 8px 12px', textAlign: 'right', fontSize: 12, color: row.actUnit > 0 ? 'var(--ink-primary)' : 'var(--ink-tertiary)', fontStyle: row.actUnit > 0 ? 'normal' : 'italic' }}>{row.actUnit > 0 ? fmt(row.actUnit*row.actQty) : '—'}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {/* Totals row */}
            <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--bg-muted)' }}>
              <td colSpan={4} style={{ padding: '11px 24px', fontWeight: 700, fontSize: 13, color: 'var(--ink-primary)' }}>Total</td>
              <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--ink-primary)' }}>{fmt(totalEst)}</td>
              <td style={{ padding: '11px 24px 11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--ink-primary)' }}>{fmt(totalAct)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile accordion */}
      <div className="budget-mobile" style={{ flex: 1, overflow: 'auto', padding: '12px 16px 24px', display: 'none' }}>
        {categories.map(cat => {
          const rows = BUDGET_DATA.filter(r => r.category === cat);
          const catEst = rows.reduce((a,r) => a + r.estUnit*r.qty, 0);
          const isOpen = !collapsed[cat];
          return (
            <div key={cat} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', marginBottom: 10, overflow: 'hidden' }}>
              <button onClick={() => toggleCat(cat)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', background: 'var(--bg-muted)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11 }}>{isOpen ? '▼' : '▶'}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)' }}>{cat}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{fmt(catEst)}</div>
              </button>
              {isOpen && rows.map(row => (
                <div key={row.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{row.item}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>{row.vendor || '—'} · {fmt(row.estUnit)} × {row.qty}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{fmt(row.estUnit*row.qty)}</div>
                      <div style={{ fontSize: 11, color: row.actUnit > 0 ? 'var(--moss-500)' : 'var(--ink-tertiary)', marginTop: 2 }}>
                        {row.actUnit > 0 ? `${fmt(row.actUnit*row.actQty)} actual` : 'estimate'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ background: 'var(--moss-700)', color: '#fff', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{fmt(totalEst)}</span>
        </div>
      </div>
    </div>
  );
};
// ══════════════════════════════════════════════════════════════════════════════

const PAYMENTS_DATA = [
  { id:1,  vendor:'Alveston Manor',           desc:'Venue deposit',        amount:1000.00, due:'15 Jan 2026', status:'PAID' },
  { id:2,  vendor:'WeddingPlan Insurance',    desc:'Insurance premium',    amount:185.00,  due:'20 Jan 2026', status:'PAID' },
  { id:3,  vendor:'Bespoke Weddings',         desc:'Planning retainer',    amount:500.00,  due:'01 Feb 2026', status:'PAID' },
  { id:4,  vendor:'Stratford Jewellery',      desc:'Rings deposit',        amount:250.00,  due:'01 Feb 2026', status:'PAID' },
  { id:5,  vendor:'CG Media',                 desc:'Photography deposit',  amount:500.00,  due:'15 Feb 2026', status:'PAID' },
  { id:6,  vendor:'Paintbox Blooms',          desc:'Florist deposit',      amount:335.00,  due:'01 Mar 2026', status:'PAID' },
  { id:7,  vendor:'Stratford Jewellery',      desc:'Rings balance',        amount:350.00,  due:'15 Mar 2026', status:'PAID' },
  { id:8,  vendor:'Alveston Manor',           desc:'Venue balance',        amount:3960.00, due:'26 Aug 2026', status:'SCHEDULED' },
  { id:9,  vendor:'CG Media',                 desc:'Photography balance',  amount:985.62,  due:'15 Sep 2026', status:'SCHEDULED' },
  { id:10, vendor:'Paintbox Blooms',          desc:'Florist balance',      amount:335.00,  due:'01 Sep 2026', status:'SCHEDULED' },
];

const PaymentsPage = () => {
  const total = PAYMENTS_DATA.reduce((a,p) => a + p.amount, 0);
  const paid = PAYMENTS_DATA.filter(p=>p.status==='PAID').reduce((a,p) => a + p.amount, 0);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Payments"
        subtitle={`${PAYMENTS_DATA.filter(p=>p.status==='PAID').length} paid · ${PAYMENTS_DATA.filter(p=>p.status==='SCHEDULED').length} scheduled`}
        actions={<Button variant="primary" size="sm">+ Add payment</Button>}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
              {['Vendor','Description','Amount','Due date','Status'].map((h,i) => (
                <th key={i} style={{ padding: '9px 12px', textAlign: i===2?'right':'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', background: 'var(--bg-canvas)', position: 'sticky', top: 0, paddingLeft: i===0?24:undefined, paddingRight: i===4?24:undefined, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PAYMENTS_DATA.map((p, i) => (
              <tr key={p.id} className="row-hover" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td style={{ padding: '10px 12px 10px 24px', fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{p.vendor}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-secondary)' }}>{p.desc}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ink-primary)' }}>{fmt(p.amount)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: p.status==='OVERDUE'?'var(--status-danger)':'var(--ink-secondary)' }}>{p.due}</td>
                <td style={{ padding: '10px 24px 10px 12px' }}><StatusPill status={p.status}/></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--bg-muted)' }}>
              <td colSpan={2} style={{ padding: '11px 24px', fontWeight: 700, fontSize: 13, color: 'var(--ink-primary)' }}>Total</td>
              <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--ink-primary)' }}>{fmt(total)}</td>
              <td colSpan={2} style={{ padding: '11px 24px 11px 12px', fontSize: 12, color: 'var(--ink-tertiary)' }}>{fmt(paid)} paid</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

Object.assign(window, { BudgetPage, PaymentsPage, PAYMENTS_DATA });
