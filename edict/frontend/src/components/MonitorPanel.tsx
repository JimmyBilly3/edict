import { useEffect } from 'react';
import { useStore, DEPTS, isEdict, stateLabel, displayDept, displayRole, displayRank } from '../store';
import { api, type OfficialInfo } from '../api';

export default function MonitorPanel() {
  const liveStatus = useStore((s) => s.liveStatus);
  const agentsStatusData = useStore((s) => s.agentsStatusData);
  const officialsData = useStore((s) => s.officialsData);
  const loadAgentsStatus = useStore((s) => s.loadAgentsStatus);
  const setModalTaskId = useStore((s) => s.setModalTaskId);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    loadAgentsStatus();
  }, [loadAgentsStatus]);

  const tasks = liveStatus?.tasks || [];
  const activeTasks = tasks.filter((t) => isEdict(t) && t.state !== 'Done' && t.state !== 'Next');

  // Build official map
  const offMap: Record<string, OfficialInfo> = {};
  if (officialsData?.officials) {
    officialsData.officials.forEach((o) => { offMap[o.id] = o; });
  }

  // Agent wake
  const handleWake = async (agentId: string) => {
    try {
      const r = await api.agentWake(agentId);
      toast(r.message || 'มีพระบัญชาให้ปลุกระบบแล้ว');
      setTimeout(() => loadAgentsStatus(), 30000);
    } catch { toast('ปลุกระบบไม่สำเร็จ', 'err'); }
  };

  const handleWakeAll = async () => {
    if (!agentsStatusData) return;
    const toWake = agentsStatusData.agents.filter(
      (a) => a.id !== 'main' && a.status !== 'running' && a.status !== 'unconfigured'
    );
    if (!toWake.length) { toast('เอเจนต์ทั้งปวงยังออนไลน์อยู่'); return; }
    toast(`กำลังปลุกเอเจนต์ ${toWake.length} ราย...`);
    for (const a of toWake) {
      try { await api.agentWake(a.id); } catch { /* ignore */ }
    }
    toast(`ส่งคำสั่งปลุกแล้ว ${toWake.length} ราย จะเรียกสถานะใหม่ในอีก 30 วินาที`);
    setTimeout(() => loadAgentsStatus(), 30000);
  };

  // Agent Status Panel
  const asData = agentsStatusData;
  const filtered = asData?.agents?.filter((a) => a.id !== 'main') || [];
  const running = filtered.filter((a) => a.status === 'running').length;
  const idle = filtered.filter((a) => a.status === 'idle').length;
  const offline = filtered.filter((a) => a.status === 'offline').length;
  const unconf = filtered.filter((a) => a.status === 'unconfigured').length;
  const gw = asData?.gateway;
  const gwCls = gw?.probe ? 'ok' : gw?.alive ? 'warn' : 'err';

  return (
    <div>
      {/* Agent Status Panel */}
      {asData && asData.ok && (
        <div className="as-panel">
          <div className="as-header">
            <span className="as-title">🔌 สถานะเอเจนต์</span>
            <span className={`as-gw ${gwCls}`}>Gateway: {gw?.status || 'ไม่ทราบ'}</span>
            <button className="btn-refresh" onClick={() => loadAgentsStatus()} style={{ marginLeft: 8 }}>
              🔄 เรียกใหม่
            </button>
            {(offline + unconf > 0) && (
              <button className="btn-refresh" onClick={handleWakeAll} style={{ marginLeft: 4, borderColor: 'var(--warn)', color: 'var(--warn)' }}>
                ⚡ ปลุกทั้งหมด
              </button>
            )}
          </div>
          <div className="as-grid">
            {filtered.map((a) => {
              const canWake = a.status !== 'running' && a.status !== 'unconfigured' && gw?.alive;
              return (
                <div key={a.id} className="as-card" title={`${a.role} · ${a.statusLabel}`}>
                  <div className={`as-dot ${a.status}`} />
                  <div style={{ fontSize: 22 }}>{a.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{displayDept(a.label)}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{displayRole(a.role)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{a.statusLabel}</div>
                  {a.lastActive ? (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>⏰ {a.lastActive}</div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>ยังไม่พบประวัติการเคลื่อนไหว</div>
                  )}
                  {canWake && (
                    <button className="as-wake-btn" onClick={(e) => { e.stopPropagation(); handleWake(a.id); }}>
                      ⚡ ปลุก
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="as-summary">
            <span><span className="as-dot running" style={{ position: 'static', width: 8, height: 8 }} /> {running} กำลังทำงาน</span>
            <span><span className="as-dot idle" style={{ position: 'static', width: 8, height: 8 }} /> {idle} คอยรับบัญชา</span>
            {offline > 0 && <span><span className="as-dot offline" style={{ position: 'static', width: 8, height: 8 }} /> {offline} ออฟไลน์</span>}
            {unconf > 0 && <span><span className="as-dot unconfigured" style={{ position: 'static', width: 8, height: 8 }} /> {unconf} ยังมิได้ตั้งค่า</span>}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
              ตรวจเมื่อ {(asData.checkedAt || '').substring(11, 19)}
            </span>
          </div>
        </div>
      )}

      {/* Duty Grid */}
      <div className="duty-grid">
        {DEPTS.map((d) => {
          const myTasks = activeTasks.filter((t) => t.org === d.label);
          const isActive = myTasks.some((t) => t.state === 'Doing');
          const isBlocked = myTasks.some((t) => t.state === 'Blocked');
          const off = offMap[d.id];
          const hb = off?.heartbeat || { status: 'idle', label: '⚪' };
          const dotCls = isBlocked ? 'blocked' : isActive ? 'busy' : hb.status === 'active' ? 'active' : 'idle';
          const statusText = isBlocked ? '⚠️ ติดขัด' : isActive ? '⚙️ กำลังปฏิบัติ' : hb.status === 'active' ? '🟢 กำลังเคลื่อนไหว' : '⚪ คอยรับบัญชา';
          const cardCls = isBlocked ? 'blocked-card' : isActive ? 'active-card' : '';

          return (
            <div key={d.id} className={`duty-card ${cardCls}`}>
              <div className="dc-hdr">
                <span className="dc-emoji">{d.emoji}</span>
                <div className="dc-info">
                  <div className="dc-name">{displayDept(d.label)}</div>
                  <div className="dc-role">{displayRole(d.role)} · {displayRank(d.rank)}</div>
                </div>
                <div className="dc-status">
                  <span className={`dc-dot ${dotCls}`} />
                  <span>{statusText}</span>
                </div>
              </div>
              <div className="dc-body">
                {myTasks.length > 0 ? (
                  myTasks.map((t) => (
                    <div key={t.id} className="dc-task" onClick={() => setModalTaskId(t.id)}>
                      <div className="dc-task-id">{t.id}</div>
                      <div className="dc-task-title">{t.title || '(ไร้ชื่อเรื่อง)'}</div>
                      {t.now && t.now !== '-' && (
                        <div className="dc-task-now">{t.now.substring(0, 70)}</div>
                      )}
                      <div className="dc-task-meta">
                        <span className={`tag st-${t.state}`}>{stateLabel(t)}</span>
                        {t.block && t.block !== '无' && (
                          <span className="tag" style={{ borderColor: '#ff527044', color: 'var(--danger)' }}>🚫{t.block}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dc-idle">
                    <span style={{ fontSize: 20 }}>🪭</span>
                    <span>คอยรับบัญชาอยู่</span>
                  </div>
                )}
              </div>
              <div className="dc-footer">
                <span className="dc-model">🤖 {off?.model_short || 'รอตั้งค่า'}</span>
                {off?.last_active && <span className="dc-la">⏰ {off.last_active}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
