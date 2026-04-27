/* Wedding Hub — Songs Page */

const SONG_CATEGORIES = [
  { id:'prep',     label:'Bridal Prep',   hint:'Getting-ready playlist (separate vibes for each room)',  color:'var(--marigold-700)', bg:'var(--marigold-50)', border:'var(--marigold-100)', playlist:'Bridal Prep · Morning of' },
  { id:'ceremony', label:'Ceremony',      hint:'Processional, signing, recessional',                color:'var(--moss-700)',     bg:'var(--bg-muted)',    border:'var(--border-soft)', playlist:'Ceremony · Order of Service' },
  { id:'drinks',   label:'Drinks Reception', hint:'Background music in the walled garden',          color:'var(--moss-500)',     bg:'var(--moss-50)',     border:'var(--moss-100)', playlist:'Drinks Reception · Garden' },
  { id:'breakfast',label:'Wedding Breakfast',hint:'Ambient dinner music while plates land',         color:'var(--moss-500)',     bg:'var(--moss-50)',     border:'var(--moss-100)', playlist:'Wedding Breakfast · Background' },
  { id:'first',    label:'First Dance',   hint:'One song · played immediately after speeches',      color:'var(--marigold-700)', bg:'var(--marigold-50)', border:'var(--marigold-100)', playlist:'First Dance' },
  { id:'must',     label:'Must Play',     hint:'Played at some point during the reception',         color:'var(--moss-500)',     bg:'var(--moss-50)',     border:'var(--moss-100)', playlist:'Must Play · Wedding 26 Sep' },
  { id:'do_not',   label:'Do Not Play',   hint:'Block-list — never queued by Spotify',              color:'var(--alert-500)',    bg:'#FEF1ED',            border:'#F8DCD0', playlist:'Do Not Play (block list)' },
];

const SONGS_SEED = [
  // Ceremony
  { id:101, title:"Canon in D",                                artist:"Pachelbel",                category:'ceremony', moment:'Processional',  requestedBy:'Couple',           addedOn:'12 Mar', notes:'Bridesmaids walk in' },
  { id:102, title:"A Thousand Years",                          artist:"Christina Perri",          category:'ceremony', moment:'Bride enters',  requestedBy:'Couple',           addedOn:'12 Mar', notes:'Bryony walks down aisle' },
  { id:103, title:"Signed, Sealed, Delivered I'm Yours",       artist:"Stevie Wonder",            category:'ceremony', moment:'Signing',       requestedBy:'Couple',           addedOn:'12 Mar', notes:'During register signing' },
  { id:104, title:"Sun Is Shining",                            artist:"Bob Marley",               category:'ceremony', moment:'Recessional',   requestedBy:'Couple',           addedOn:'12 Mar', notes:'Walk out together' },

  // First dance
  { id:201, title:"Fall at Your Feet",                         artist:"Crowded House",            category:'first',    moment:'First dance',   requestedBy:'Couple',           addedOn:'02 Apr', notes:'Full song · 4:14' },

  // Must play — guest requests
  { id:301, title:"Eyes on Me",                                artist:"Rova",                     category:'must',     moment:'',              requestedBy:'Jamie Spencer',     addedOn:'14 Mar', notes:'' },
  { id:302, title:"Original Nuttah",                           artist:"UK Apache & Shy FX",       category:'must',     moment:'',              requestedBy:'Joshua Dickson',    addedOn:'18 Mar', notes:'Late evening' },
  { id:303, title:"Take Me Home, Country Roads",               artist:"John Denver",              category:'must',     moment:'',              requestedBy:'Torin Davis',       addedOn:'22 Mar', notes:'Sing-along moment' },
  { id:304, title:"Macarena",                                  artist:"Los Del Río",              category:'must',     moment:'',              requestedBy:'Bryony Olwyn-Davis',addedOn:'24 Mar', notes:'For the dance floor' },
  { id:305, title:"Carry on Wayward Son",                      artist:"Kansas",                   category:'must',     moment:'',              requestedBy:'Aimee Hollingsworth',addedOn:'26 Mar', notes:'' },
  { id:306, title:"Mr. Brightside",                            artist:"The Killers",              category:'must',     moment:'',              requestedBy:'Sarah Loughran',    addedOn:'28 Mar', notes:'' },
  { id:307, title:"Don't Stop Me Now",                         artist:"Queen",                    category:'must',     moment:'',              requestedBy:'Connern Gilbert',   addedOn:'01 Apr', notes:'Crowd-pleaser' },
  { id:308, title:"Dancing Queen",                             artist:"ABBA",                     category:'must',     moment:'',              requestedBy:'Annabel Gilbert',   addedOn:'02 Apr', notes:'' },
  { id:309, title:"Sweet Caroline",                            artist:"Neil Diamond",             category:'must',     moment:'',              requestedBy:'Phill Scott',       addedOn:'05 Apr', notes:'' },
  { id:310, title:"Mr. Blue Sky",                              artist:"Electric Light Orchestra", category:'must',     moment:'',              requestedBy:'Tia King',          addedOn:'08 Apr', notes:'' },
  { id:311, title:"Valerie",                                   artist:"Mark Ronson ft. Amy Winehouse", category:'must',moment:'',              requestedBy:'Tyler Spencer',     addedOn:'10 Apr', notes:'' },
  { id:312, title:"Hey Ya!",                                   artist:"OutKast",                  category:'must',     moment:'',              requestedBy:'Uldis Elksnis',     addedOn:'12 Apr', notes:'' },

  // Bridal prep — morning of
  { id:501, title:"Lovely Day",                              artist:"Bill Withers",             category:'prep',     moment:'Bridal suite',  requestedBy:'Bryony Olwyn-Davis',addedOn:'08 Apr', notes:'Opener while hair starts' },
  { id:502, title:"Here Comes the Sun",                     artist:"The Beatles",              category:'prep',     moment:'Bridal suite',  requestedBy:'Aimee Hollingsworth',addedOn:'09 Apr', notes:'' },
  { id:503, title:"Songbird",                               artist:"Fleetwood Mac",            category:'prep',     moment:'Bridal suite',  requestedBy:'Bryony Olwyn-Davis',addedOn:'09 Apr', notes:'Quiet moment, dress on' },
  { id:504, title:"Wake Me Up Before You Go-Go",            artist:"Wham!",                    category:'prep',     moment:'Groomsmen room',requestedBy:'Joshua Dickson',    addedOn:'10 Apr', notes:'Energy track' },
  { id:505, title:"Africa",                                 artist:"Toto",                     category:'prep',     moment:'Groomsmen room',requestedBy:'Connern Gilbert',   addedOn:'10 Apr', notes:'' },

  // Drinks reception — walled garden background
  { id:601, title:"Cheek to Cheek",                         artist:"Ella Fitzgerald & Louis Armstrong", category:'drinks', moment:'Garden',  requestedBy:'Couple',       addedOn:'12 Apr', notes:'Jazz standard' },
  { id:602, title:"Beyond the Sea",                         artist:"Bobby Darin",              category:'drinks',   moment:'Garden',        requestedBy:'Couple',           addedOn:'12 Apr', notes:'' },
  { id:603, title:"L-O-V-E",                                artist:"Nat King Cole",            category:'drinks',   moment:'Garden',        requestedBy:'Couple',           addedOn:'12 Apr', notes:'' },
  { id:604, title:"The Way You Look Tonight",              artist:"Frank Sinatra",            category:'drinks',   moment:'Garden',        requestedBy:'Couple',           addedOn:'12 Apr', notes:'' },
  { id:605, title:"Fly Me to the Moon",                    artist:"Frank Sinatra",            category:'drinks',   moment:'Garden',        requestedBy:'Couple',           addedOn:'12 Apr', notes:'' },

  // Wedding breakfast — dinner background
  { id:701, title:"Norwegian Wood",                         artist:"The Beatles",              category:'breakfast',moment:'Dinner',        requestedBy:'Couple',           addedOn:'14 Apr', notes:'Acoustic vibe' },
  { id:702, title:"Banana Pancakes",                        artist:"Jack Johnson",             category:'breakfast',moment:'Dinner',        requestedBy:'Couple',           addedOn:'14 Apr', notes:'' },
  { id:703, title:"Skinny Love",                            artist:"Birdy",                    category:'breakfast',moment:'Dinner',        requestedBy:'Couple',           addedOn:'14 Apr', notes:'' },
  { id:704, title:"Put Your Records On",                    artist:"Corinne Bailey Rae",       category:'breakfast',moment:'Dinner',        requestedBy:'Couple',           addedOn:'14 Apr', notes:'' },
  { id:705, title:"Halo",                                   artist:"Beyoncé (acoustic cover)", category:'breakfast',moment:'Dinner',        requestedBy:'Bryony Olwyn-Davis',addedOn:'15 Apr', notes:'' },

  // Do not play
  { id:401, title:"YMCA",                                      artist:"Village People",           category:'do_not',   moment:'',              requestedBy:'Couple',            addedOn:'14 Mar', notes:'No cheesy line dances' },
  { id:402, title:"Cha Cha Slide",                             artist:"DJ Casper",                category:'do_not',   moment:'',              requestedBy:'Couple',            addedOn:'14 Mar', notes:'' },
  { id:403, title:"Cotton Eye Joe",                            artist:"Rednex",                   category:'do_not',   moment:'',              requestedBy:'Couple',            addedOn:'14 Mar', notes:'' },
];

const SongsPage = ({ viewer }) => {
  const [songs, setSongs] = React.useState(SONGS_SEED);
  const [activeCategory, setActiveCategory] = React.useState('all');
  const [adding, setAdding] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [draft, setDraft] = React.useState({ title:'', artist:'', category:'must', notes:'' });

  const counts = SONG_CATEGORIES.reduce((acc, c) => {
    acc[c.id] = songs.filter(s => s.category === c.id).length;
    return acc;
  }, {});
  const totalRuntimeMins = Math.round(songs.filter(s => s.category!=='do_not').length * 3.5);

  const filtered = activeCategory === 'all' ? songs : songs.filter(s => s.category === activeCategory);

  const grouped = SONG_CATEGORIES.map(cat => ({
    ...cat,
    items: filtered.filter(s => s.category === cat.id),
  })).filter(g => g.items.length);

  const addSong = () => {
    if (!draft.title.trim()) return;
    setSongs([...songs, { id: Date.now(), ...draft, requestedBy: viewer?.name || 'You', addedOn:'today', moment:'' }]);
    setDraft({ title:'', artist:'', category:'must', notes:'' });
    setAdding(false);
  };
  const removeSong = id => setSongs(songs.filter(s => s.id !== id));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Songs"
        subtitle={`${songs.filter(s => s.category!=='do_not').length} on the playlist · ${counts.do_not || 0} blocked · ~${Math.floor(totalRuntimeMins/60)}h ${totalRuntimeMins%60}m runtime`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setExporting(true)}>↳ Sync to Spotify</Button>
            <Button variant="primary" size="sm" onClick={() => setAdding(true)}>+ Add song</Button>
          </>
        }
      />

      {/* Summary cards */}
      <div style={{ padding: '14px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, flexShrink: 0 }}>
        {SONG_CATEGORIES.map(c => {
          const active = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(active ? 'all' : c.id)}
              style={{
                background: active ? c.bg : 'var(--bg-surface)',
                border: `1px solid ${active ? c.color : 'var(--border-soft)'}`,
                borderLeft: `3px solid ${c.color}`,
                borderRadius: 'var(--r-md)',
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'background 0.12s',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: c.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1 }}>{counts[c.id] || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 4 }}>{c.hint}</div>
            </button>
          );
        })}
      </div>

      {activeCategory !== 'all' && (
        <div style={{ padding: '8px 24px 0', flexShrink: 0 }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{ background: 'transparent', border: 'none', fontSize: 12, color: 'var(--moss-500)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
          >← Show all categories</button>
        </div>
      )}

      {/* Spotify connection banner */}
      <div style={{ padding: '14px 24px 0', flexShrink: 0 }}>
        <div style={{
          background: 'linear-gradient(135deg, #1DB954 0%, #168d40 100%)',
          color: '#fff',
          borderRadius: 'var(--r-md)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          fontFamily: 'var(--font-ui)',
          flexWrap: 'wrap',
        }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.16)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>♫</div>
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Spotify connected · {SONG_CATEGORIES.length} playlists</div>
            <div style={{ fontSize: 11, opacity: 0.92 }}>Bryony's Spotify · last synced 2 minutes ago · auto-syncs when songs are added or removed</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 100%' }}>
            {SONG_CATEGORIES.map(c => (
              <a key={c.id} href="#" onClick={e => e.preventDefault()} title={c.playlist}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  borderRadius: 999,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }}></span>
                {c.label} <span style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{counts[c.id] || 0}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Song list, grouped by category */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 32px' }}>
        {grouped.map(group => (
          <section key={group.id} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid var(--border-soft)` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink-primary)', margin: 0 }}>{group.label}</h3>
                <span style={{ fontSize: 12, color: 'var(--ink-tertiary)' }}>{group.items.length} {group.items.length === 1 ? 'song' : 'songs'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{group.hint}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              {group.items.map((s, i) => (
                <SongRow key={s.id} song={s} index={i} isLast={i === group.items.length - 1} categoryColor={group.color} onRemove={() => removeSong(s.id)} />
              ))}
            </div>
          </section>
        ))}

        {grouped.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>♪</div>
            <div style={{ fontSize: 14 }}>No songs in this category yet.</div>
          </div>
        )}

        {/* Source attribution */}
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 16 }}>♫</div>
          <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--ink-primary)' }}>Where these come from.</strong> Couple-added songs sit alongside guest requests pulled from <em>Say I Do</em> RSVPs (each guest can submit up to 3). Removing a song here keeps the original RSVP intact.
          </div>
        </div>
      </div>

      {adding && <AddSongDialog draft={draft} setDraft={setDraft} onAdd={addSong} onCancel={() => setAdding(false)} />}
      {exporting && <SongExportDialog songs={songs} onClose={() => setExporting(false)} />}
    </div>
  );
};

const SongRow = ({ song, index, isLast, categoryColor, onRemove }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '32px 1fr auto auto 28px',
    alignItems: 'center',
    gap: 14,
    padding: '11px 16px',
    borderBottom: isLast ? 'none' : '1px solid var(--border-soft)',
    fontFamily: 'var(--font-ui)',
  }}>
    <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {song.artist}{song.notes ? ` · ${song.notes}` : ''}
      </div>
    </div>
    <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', textAlign: 'right' }}>
      {song.moment ? <div style={{ fontWeight: 500, color: 'var(--ink-secondary)' }}>{song.moment}</div> : null}
      <div>{song.requestedBy}</div>
    </div>
    <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', textAlign: 'right', minWidth: 56 }}>{song.addedOn}</div>
    <button
      onClick={onRemove}
      title="Remove"
      style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: 'var(--ink-tertiary)', cursor: 'pointer', borderRadius: 4, fontSize: 16, lineHeight: 1 }}
    >×</button>
  </div>
);

const AddSongDialog = ({ draft, setDraft, onAdd, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,30,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onCancel}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', width: 440, maxWidth: '90vw', padding: 22, fontFamily: 'var(--font-ui)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink-primary)', marginBottom: 14 }}>Add a song</div>

      <Field label="Song title">
        <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Wonderwall" autoFocus style={inputStyle}/>
      </Field>
      <Field label="Artist">
        <input value={draft.artist} onChange={e => setDraft({ ...draft, artist: e.target.value })} placeholder="e.g. Oasis" style={inputStyle}/>
      </Field>
      <Field label="Category">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {SONG_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setDraft({ ...draft, category: c.id })}
              style={{
                padding: '8px 10px',
                background: draft.category === c.id ? c.bg : 'var(--bg-canvas)',
                border: `1px solid ${draft.category === c.id ? c.color : 'var(--border-soft)'}`,
                borderRadius: 'var(--r-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: draft.category === c.id ? c.color : 'var(--ink-secondary)',
                fontWeight: draft.category === c.id ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}>{c.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Notes (optional)">
        <input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. for the cake cut" style={inputStyle}/>
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={onAdd}>Add to list</Button>
      </div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginBottom: 12, fontFamily: 'var(--font-ui)' }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
    {children}
  </label>
);

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--r-sm)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  color: 'var(--ink-primary)',
  background: 'var(--bg-canvas)',
  outline: 'none',
  boxSizing: 'border-box',
};

const SongExportDialog = ({ songs, onClose }) => {
  const [syncing, setSyncing] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const groups = SONG_CATEGORIES.map(c => ({
    ...c,
    items: songs.filter(s => s.category === c.id),
  }));
  const total = songs.length;

  const startSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setDone(true); }, 1400);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,30,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', width: 520, maxWidth: '92vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', boxShadow: '0 24px 48px rgba(20,28,30,0.18)' }}>
        {/* Header with Spotify branding */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1DB954', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>♫</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink-primary)' }}>Sync to Spotify</div>
            <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>Connected as <strong style={{ color: 'var(--ink-secondary)' }}>bryony.olwyndavis</strong> · {total} songs across {SONG_CATEGORIES.length} playlists</div>
          </div>
        </div>

        {/* Playlist list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px' }}>
          {groups.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 4, background: g.bg, border: `1px solid ${g.border}`, color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>♪</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-primary)' }}>{g.playlist}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>{g.items.length} {g.items.length === 1 ? 'song' : 'songs'}{g.id === 'do_not' ? ' · kept private' : ' · public to wedding party'}</div>
              </div>
              <div style={{ fontSize: 11, color: done ? '#168d40' : 'var(--ink-tertiary)', fontWeight: done ? 600 : 400 }}>
                {done ? '✓ synced' : syncing ? 'syncing…' : 'ready'}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', flex: 1 }}>
            {done ? 'All four playlists are now up to date in Spotify.' : 'Pushing replaces the contents of each playlist with the current list above.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {done ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => window.open('https://open.spotify.com', '_blank')}>↗ Open in Spotify</Button>
                <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <button
                  onClick={startSync}
                  disabled={syncing}
                  style={{
                    padding: '7px 14px',
                    background: '#1DB954',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: syncing ? 'wait' : 'pointer',
                    opacity: syncing ? 0.7 : 1,
                  }}>{syncing ? 'Syncing…' : 'Sync now'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

window.SongsPage = SongsPage;
window.SONGS_DATA = SONGS_SEED;
