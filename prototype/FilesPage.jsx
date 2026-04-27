/* Wedding Hub — Files Page */

const FILES_DATA = [
  { id:1,  name:'Alveston Manor — Booking Contract.pdf',     size:'2.4 MB', linkedTo:'Alveston Manor',     type:'Contract',  uploaded:'15 Jan 2026', uploader:'Jamie Spencer',     ext:'pdf' },
  { id:2,  name:'Alveston Manor — Final Menu.pdf',           size:'480 KB', linkedTo:'Alveston Manor',     type:'Document',  uploaded:'02 Jul 2026', uploader:'Bryony Olwyn-Davis', ext:'pdf' },
  { id:3,  name:'CG Media — Photography Contract.pdf',       size:'1.1 MB', linkedTo:'CG Media',           type:'Contract',  uploaded:'15 Feb 2026', uploader:'Jamie Spencer',     ext:'pdf' },
  { id:4,  name:'CG Media — Shot list draft.pdf',            size:'320 KB', linkedTo:'CG Media',           type:'Document',  uploaded:'18 Aug 2026', uploader:'Bryony Olwyn-Davis', ext:'pdf' },
  { id:5,  name:'Paintbox Blooms — Quote & Mood Board.pdf',  size:'5.7 MB', linkedTo:'Paintbox Blooms',    type:'Quote',     uploaded:'01 Mar 2026', uploader:'Bryony Olwyn-Davis', ext:'pdf' },
  { id:6,  name:'Paintbox Blooms — Bouquet refs.jpg',        size:'1.8 MB', linkedTo:'Paintbox Blooms',    type:'Image',     uploaded:'01 Mar 2026', uploader:'Bryony Olwyn-Davis', ext:'jpg' },
  { id:7,  name:'Stratford Jewellery — Receipt.pdf',         size:'140 KB', linkedTo:'Stratford Jewellery',type:'Receipt',   uploaded:'15 Mar 2026', uploader:'Jamie Spencer',     ext:'pdf' },
  { id:8,  name:'WeddingPlan — Insurance Policy.pdf',        size:'820 KB', linkedTo:'WeddingPlan',        type:'Contract',  uploaded:'20 Jan 2026', uploader:'Jamie Spencer',     ext:'pdf' },
  { id:9,  name:'Bespoke Weddings — Planning agreement.pdf', size:'650 KB', linkedTo:'Bespoke Weddings',   type:'Contract',  uploaded:'01 Feb 2026', uploader:'Jamie Spencer',     ext:'pdf' },
  { id:10, name:'Order of Service — DRAFT v3.docx',          size:'58 KB',  linkedTo:'—',                  type:'Document',  uploaded:'10 Sep 2026', uploader:'Bryony Olwyn-Davis', ext:'doc' },
  { id:11, name:'Seating chart — exported.png',              size:'2.1 MB', linkedTo:'Seating',            type:'Image',     uploaded:'14 Sep 2026', uploader:'Aimee Hollingsworth',ext:'png' },
  { id:12, name:'Notice of Marriage — Stratford registrar.pdf', size:'90 KB',linkedTo:'Legal & Admin',     type:'Document',  uploaded:'05 Apr 2026', uploader:'Jamie Spencer',     ext:'pdf' },
];

const FILE_TYPES = ['All','Contract','Document','Quote','Receipt','Image'];

const fileIcon = (ext) => {
  const colors = { pdf:'#c64a4a', doc:'#3a6ea5', jpg:'#7a8a4a', png:'#7a8a4a' };
  return colors[ext] || 'var(--ink-tertiary)';
};

const FilesPage = () => {
  const [filter, setFilter] = React.useState('All');
  const [sort, setSort] = React.useState('newest');

  let files = filter === 'All' ? FILES_DATA : FILES_DATA.filter(f => f.type === filter);
  files = [...files].sort((a,b) => sort === 'newest' ? b.id - a.id : a.name.localeCompare(b.name));

  const totalSize = FILES_DATA.reduce((acc, f) => {
    const m = parseFloat(f.size);
    return acc + (f.size.includes('MB') ? m : m / 1024);
  }, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title="Files"
        subtitle={`${FILES_DATA.length} files · ${totalSize.toFixed(1)} MB total`}
        actions={
          <>
            <Button variant="ghost" size="sm">Sort: {sort === 'newest' ? 'Newest' : 'A → Z'}</Button>
            <Button variant="primary" size="sm">↑ Upload</Button>
          </>
        }
      />

      {/* Filter pills */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, background: 'var(--bg-surface)' }}>
        {FILE_TYPES.map(t => <Tag key={t} label={t} active={filter === t} onClick={() => setFilter(t)}/>)}
      </div>

      {/* Drop zone */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ border: '2px dashed var(--border-soft)', borderRadius: 'var(--r-md)', padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg-muted)', color: 'var(--ink-tertiary)', fontSize: 13 }}>
          <span style={{ fontSize: 16 }}>↑</span> Drop files here, or click upload
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {files.map(f => (
            <FileCard key={f.id} file={f}/>
          ))}
        </div>
      </div>
    </div>
  );
};

const FileCard = ({ file }) => (
  <div style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-md)', padding: 14, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', flexDirection: 'column', gap: 10,
  }}
  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
  >
    {/* Thumbnail */}
    <div style={{ width: '100%', height: 90, borderRadius: 'var(--r-sm)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: fileIcon(file.ext), letterSpacing: '0.04em' }}>
        .{file.ext.toUpperCase()}
      </div>
      <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, color: 'var(--ink-tertiary)', background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: 8, border: '1px solid var(--border-soft)' }}>{file.type}</div>
    </div>
    {/* Title */}
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{file.name}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>{file.linkedTo} · {file.size}</div>
    </div>
    {/* Footer */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
      <Avatar name={file.uploader} size={16}/>
      <span style={{ fontSize: 10, color: 'var(--ink-tertiary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.uploader.split(' ')[0]}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-tertiary)' }}>{file.uploaded.split(' ').slice(0,2).join(' ')}</span>
    </div>
  </div>
);

Object.assign(window, { FilesPage, FILES_DATA });
