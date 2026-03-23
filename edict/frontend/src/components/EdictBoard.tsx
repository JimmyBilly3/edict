import { useStore, isEdict, isArchived, getPipeStatus, stateLabel, deptColor, PIPE, displayDept } from '../store';
import { api, type Task } from '../api';

// 排序权重
const STATE_ORDER: Record<string, number> = {
  Doing: 0, Review: 1, Assigned: 2, Menxia: 3, Zhongshu: 4,
  Taizi: 5, Inbox: 6, Blocked: 7, Next: 8, Done: 9, Cancelled: 10,
};

function MiniPipe({ task }: { task: Task }) {
  const stages = getPipeStatus(task);
  return (
    <div className="ec-pipe">
      {stages.map((s, i) => (
        <span key={s.key} style={{ display: 'contents' }}>
          <div className={`ep-node ${s.status}`}>
            <div className="ep-icon">{s.icon}</div>
            <div className="ep-name">{s.dept}</div>
          </div>
          {i < stages.length - 1 && <div className="ep-arrow">›</div>}
        </span>
      ))}
    </div>
  );
}

function EdictCard({ task }: { task: Task }) {
  const setModalTaskId = useStore((s) => s.setModalTaskId);
  const toast = useStore((s) => s.toast);
  const loadAll = useStore((s) => s.loadAll);

  const hb = task.heartbeat || { status: 'unknown', label: '⚪' };
  const stCls = 'st-' + (task.state || '');
  const deptCls = 'dt-' + (task.org || '').replace(/\s/g, '');
  const curStage = PIPE.find((_, i) => getPipeStatus(task)[i].status === 'active');
  const todos = task.todos || [];
  const todoDone = todos.filter((x) => x.status === 'completed').length;
  const todoTotal = todos.length;
  const canStop = !['Done', 'Blocked', 'Cancelled'].includes(task.state);
  const canResume = ['Blocked', 'Cancelled'].includes(task.state);
  const archived = isArchived(task);
  const isBlocked = task.block && task.block !== '无' && task.block !== '-';

  const handleAction = async (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (action === 'stop' || action === 'cancel') {
      // Use confirm dialog via store (will implement with ConfirmDialog)
      const reason = prompt(action === 'stop' ? 'โปรดระบุเหตุแห่งการสั่งพัก:' : 'โปรดระบุเหตุแห่งการยกเลิก:');
      if (reason === null) return;
      try {
        const r = await api.taskAction(task.id, action, reason);
        if (r.ok) { toast(r.message || 'ดำเนินการสำเร็จ'); loadAll(); }
        else toast(r.error || 'ดำเนินการไม่สำเร็จ', 'err');
      } catch { toast('ไม่อาจเชื่อมต่อเซิร์ฟเวอร์', 'err'); }
    } else if (action === 'resume') {
      try {
        const r = await api.taskAction(task.id, 'resume', '恢复执行');
        if (r.ok) { toast(r.message || 'กลับมาดำเนินต่อแล้ว'); loadAll(); }
        else toast(r.error || 'ดำเนินการไม่สำเร็จ', 'err');
      } catch { toast('ไม่อาจเชื่อมต่อเซิร์ฟเวอร์', 'err'); }
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const r = await api.archiveTask(task.id, !task.archived);
      if (r.ok) { toast(r.message || 'ดำเนินการสำเร็จ'); loadAll(); }
      else toast(r.error || 'ดำเนินการไม่สำเร็จ', 'err');
    } catch { toast('ไม่อาจเชื่อมต่อเซิร์ฟเวอร์', 'err'); }
  };

  return (
    <div
      className={`edict-card${archived ? ' archived' : ''}`}
      onClick={() => setModalTaskId(task.id)}
    >
      <MiniPipe task={task} />
      <div className="ec-id">{task.id}</div>
      <div className="ec-title">{task.title || '(ไร้ชื่อเรื่อง)'}</div>
      <div className="ec-meta">
        <span className={`tag ${stCls}`}>{stateLabel(task)}</span>
        {task.org && <span className={`tag ${deptCls}`}>{task.org}</span>}
        {curStage && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            ขณะนี้: <b style={{ color: deptColor(curStage.dept) }}>{displayDept(curStage.dept)} · {curStage.action}</b>
          </span>
        )}
      </div>
      {task.now && task.now !== '-' && (
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
          {task.now.substring(0, 80)}
        </div>
      )}
      {(task.review_round || 0) > 0 && (
        <div style={{ fontSize: 11, marginBottom: 6 }}>
          {Array.from({ length: task.review_round || 0 }, (_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                background: i < (task.review_round || 0) - 1 ? '#1a3a6a22' : 'var(--acc)22',
                border: `1px solid ${i < (task.review_round || 0) - 1 ? '#2a4a8a' : 'var(--acc)'}`,
                fontSize: 9, textAlign: 'center', lineHeight: '13px', marginRight: 2,
                color: i < (task.review_round || 0) - 1 ? '#4a6aaa' : 'var(--acc)',
              }}
            >
              {i + 1}
            </span>
          ))}
          <span style={{ color: 'var(--muted)', fontSize: 10 }}>ทบทวนร่วมกันรอบที่ {task.review_round}</span>
        </div>
      )}
      {todoTotal > 0 && (
        <div className="ec-todo-bar">
          <span>📋 {todoDone}/{todoTotal}</span>
          <div className="ec-todo-track">
            <div className="ec-todo-fill" style={{ width: `${Math.round((todoDone / todoTotal) * 100)}%` }} />
          </div>
          <span>{todoDone === todoTotal ? '✅ ครบถ้วนแล้ว' : '🔄 ยังดำเนินอยู่'}</span>
        </div>
      )}
      <div className="ec-footer">
        <span className={`hb ${hb.status}`}>{hb.label}</span>
        {isBlocked && (
          <span className="tag" style={{ borderColor: '#ff527044', color: 'var(--danger)', background: '#200a10' }}>
            🚫 {task.block}
          </span>
        )}
        {task.eta && task.eta !== '-' && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>📅 {task.eta}</span>
        )}
      </div>
      <div className="ec-actions" onClick={(e) => e.stopPropagation()}>
        {canStop && (
          <>
            <button className="mini-act" onClick={(e) => handleAction('stop', e)}>⏸ พักไว้ก่อน</button>
            <button className="mini-act danger" onClick={(e) => handleAction('cancel', e)}>🚫 ยกเลิก</button>
          </>
        )}
        {canResume && (
          <button className="mini-act" onClick={(e) => handleAction('resume', e)}>▶ ดำเนินต่อ</button>
        )}
        {archived && !task.archived && (
          <button className="mini-act" onClick={handleArchive}>📦 เก็บเข้าแฟ้ม</button>
        )}
        {task.archived && (
          <button className="mini-act" onClick={handleArchive}>📤 ถอนออกจากแฟ้ม</button>
        )}
      </div>
    </div>
  );
}

export default function EdictBoard() {
  const liveStatus = useStore((s) => s.liveStatus);
  const edictFilter = useStore((s) => s.edictFilter);
  const setEdictFilter = useStore((s) => s.setEdictFilter);
  const toast = useStore((s) => s.toast);
  const loadAll = useStore((s) => s.loadAll);

  const tasks = liveStatus?.tasks || [];
  const allEdicts = tasks.filter(isEdict);
  const activeEdicts = allEdicts.filter((t) => !isArchived(t));
  const archivedEdicts = allEdicts.filter((t) => isArchived(t));

  let edicts: Task[];
  if (edictFilter === 'active') edicts = activeEdicts;
  else if (edictFilter === 'archived') edicts = archivedEdicts;
  else edicts = allEdicts;

  edicts.sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));

  const unArchivedDone = allEdicts.filter((t) => !t.archived && ['Done', 'Cancelled'].includes(t.state));

  const handleArchiveAll = async () => {
    if (!confirm('จะย้ายราชโองการที่เสร็จสิ้นหรือยกเลิกแล้วทั้งหมดเข้าแฟ้มใช่หรือไม่?')) return;
    try {
      const r = await api.archiveAllDone();
      if (r.ok) { toast(`📦 เก็บเข้าแฟ้มแล้ว ${r.count || 0} ฉบับ`); loadAll(); }
      else toast(r.error || 'เก็บเข้าแฟ้มแบบรวมไม่สำเร็จ', 'err');
    } catch { toast('ไม่อาจเชื่อมต่อเซิร์ฟเวอร์', 'err'); }
  };

  const handleScan = async () => {
    try {
      const r = await api.schedulerScan();
      if (r.ok) toast(`🧭 การตรวจราชการเสร็จสิ้น ${r.count || 0} รายการ`);
      else toast(r.error || 'ตรวจราชการไม่สำเร็จ', 'err');
      loadAll();
    } catch { toast('ไม่อาจเชื่อมต่อเซิร์ฟเวอร์', 'err'); }
  };

  return (
    <div>
      {/* Archive Bar */}
      <div className="archive-bar">
        <span className="ab-label">คัดแยก:</span>
        {(['active', 'archived', 'all'] as const).map((f) => (
          <button
            key={f}
            className={`ab-btn ${edictFilter === f ? 'active' : ''}`}
            onClick={() => setEdictFilter(f)}
          >
            {f === 'active' ? 'กำลังดำเนิน' : f === 'archived' ? 'เข้าแฟ้ม' : 'ทั้งหมด'}
          </button>
        ))}
        {unArchivedDone.length > 0 && (
          <button className="ab-btn" onClick={handleArchiveAll}>📦 เก็บเข้าแฟ้มทั้งหมด</button>
        )}
        <span className="ab-count">
          กำลังดำเนิน {activeEdicts.length} · เข้าแฟ้ม {archivedEdicts.length} · รวม {allEdicts.length}
        </span>
        <button className="ab-scan" onClick={handleScan}>🧭 ตรวจราชการ</button>
      </div>

      {/* Grid */}
      <div className="edict-grid">
        {edicts.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            ยังไม่มีราชโองการ<br />
            <small style={{ fontSize: 11, marginTop: 6, display: 'block', color: 'var(--muted)' }}>
              สามารถส่งงานเข้ามาทาง Feishu เพื่อให้องค์รัชทายาทคัดกรอง แล้วส่งต่อให้สำนักจงซูดำเนินการ
            </small>
          </div>
        ) : (
          edicts.map((t) => <EdictCard key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
