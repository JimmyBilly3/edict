import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import type { SubConfig, MorningNewsItem } from '../api';

const CAT_META: Record<string, { icon: string; color: string; desc: string; label: string }> = {
  '政治': { icon: '🏛️', color: '#6a9eff', desc: 'ความเคลื่อนไหวการเมืองทั่วหล้า', label: 'การเมือง' },
  '军事': { icon: '⚔️', color: '#ff5270', desc: 'ศึกสงครามและความมั่นคง', label: 'การทหาร' },
  '经济': { icon: '💹', color: '#2ecc8a', desc: 'เศรษฐกิจและความเป็นไปของตลาด', label: 'เศรษฐกิจ' },
  'AI大模型': { icon: '🤖', color: '#a07aff', desc: 'ความก้าวหน้าด้าน AI และโมเดลขนาดใหญ่', label: 'AI โมเดลใหญ่' },
};

const DEFAULT_CATS = ['政治', '军事', '经济', 'AI大模型'];

export default function MorningPanel() {
  const morningBrief = useStore((s) => s.morningBrief);
  const subConfig = useStore((s) => s.subConfig);
  const loadMorning = useStore((s) => s.loadMorning);
  const loadSubConfig = useStore((s) => s.loadSubConfig);
  const toast = useStore((s) => s.toast);

  const [showConfig, setShowConfig] = useState(false);
  const [localConfig, setLocalConfig] = useState<SubConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState('⟳ เรียกข่าวเดี๋ยวนี้');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMorning();
  }, [loadMorning]);

  useEffect(() => {
    if (subConfig) setLocalConfig(JSON.parse(JSON.stringify(subConfig)));
  }, [subConfig]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const refreshNews = async () => {
    setRefreshing(true);
    setRefreshLabel('⟳ กำลังรวบรวม…');
    let lastDate: string | null = null;
    try {
      lastDate = morningBrief?.generated_at || null;
    } catch { /* */ }

    try {
      await api.refreshMorning();
      toast('เริ่มเก็บข่าวแล้ว ระบบจะตรวจการอัปเดตให้อัตโนมัติ…', 'ok');
      let count = 0;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        count++;
        if (count > 24) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setRefreshing(false);
          setRefreshLabel('⟳ เรียกข่าวเดี๋ยวนี้');
          toast('เก็บข่าวเกินเวลา โปรดลองอีกครั้ง', 'err');
          return;
        }
        try {
          const fresh = await api.morningBrief();
          if (fresh.generated_at && fresh.generated_at !== lastDate) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setRefreshing(false);
            setRefreshLabel('⟳ เรียกข่าวเดี๋ยวนี้');
            loadMorning();
            toast('✅ ข่าวยามเช้าอัปเดตแล้ว', 'ok');
          } else {
            setRefreshLabel(`⟳ กำลังรวบรวม… (${count * 5}s)`);
          }
        } catch { /* */ }
      }, 5000);
    } catch {
      toast('เริ่มเก็บข่าวไม่สำเร็จ', 'err');
      setRefreshing(false);
      setRefreshLabel('⟳ เรียกข่าวเดี๋ยวนี้');
    }
  };

  // Config helpers
  const toggleCat = (name: string) => {
    if (!localConfig) return;
    const cats = [...(localConfig.categories || [])];
    const existing = cats.find((c) => c.name === name);
    if (existing) existing.enabled = !existing.enabled;
    else cats.push({ name, enabled: true });
    setLocalConfig({ ...localConfig, categories: cats });
  };

  const addKeyword = (kw: string) => {
    if (!localConfig || !kw) return;
    const kws = [...(localConfig.keywords || [])];
    if (!kws.includes(kw)) kws.push(kw);
    setLocalConfig({ ...localConfig, keywords: kws });
  };

  const removeKeyword = (i: number) => {
    if (!localConfig) return;
    const kws = [...(localConfig.keywords || [])];
    kws.splice(i, 1);
    setLocalConfig({ ...localConfig, keywords: kws });
  };

  const addFeed = (name: string, url: string, category: string) => {
    if (!localConfig || !name || !url) {
      toast('โปรดกรอกชื่อแหล่งข่าวและ URL', 'err');
      return;
    }
    const feeds = [...(localConfig.custom_feeds || [])];
    feeds.push({ name, url, category });
    setLocalConfig({ ...localConfig, custom_feeds: feeds });
  };

  const removeFeed = (i: number) => {
    if (!localConfig) return;
    const feeds = [...(localConfig.custom_feeds || [])];
    feeds.splice(i, 1);
    setLocalConfig({ ...localConfig, custom_feeds: feeds });
  };

  const saveConfig = async () => {
    if (!localConfig) return;
    try {
      const r = await api.saveMorningConfig(localConfig);
      if (r.ok) {
        toast('บันทึกการตั้งค่าการติดตามแล้ว', 'ok');
        loadSubConfig();
      } else {
        toast(r.error || 'บันทึกไม่สำเร็จ', 'err');
      }
    } catch {
      toast('ไม่อาจเชื่อมต่อเซิร์ฟเวอร์', 'err');
    }
  };

  const enabledSet = localConfig
    ? new Set((localConfig.categories || []).filter((c) => c.enabled).map((c) => c.name))
    : new Set(DEFAULT_CATS);
  const userKws = (localConfig?.keywords || []).map((k) => k.toLowerCase());

  const cats = morningBrief?.categories || {};
  const dateStr = morningBrief?.date
    ? morningBrief.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1年$2月$3日')
    : '';
  const totalNews = Object.values(cats).flat().length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🌅 ข่าวยามเช้า</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {dateStr && `${dateStr} | `}
            {morningBrief?.generated_at && `รวบรวมเมื่อ ${morningBrief.generated_at} | `}
            รวมข่าวสำคัญ {totalNews} เรื่อง
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-g"
            onClick={() => setShowConfig(!showConfig)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            ⚙ ตั้งค่าการติดตาม
          </button>
          <button
            className="tpl-go"
            disabled={refreshing}
            onClick={refreshNews}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {refreshLabel}
          </button>
        </div>
      </div>

      {/* Subscription Config */}
      {showConfig && localConfig && (
        <SubConfigPanel
          config={localConfig}
          enabledSet={enabledSet}
          onToggleCat={toggleCat}
          onAddKeyword={addKeyword}
          onRemoveKeyword={removeKeyword}
          onAddFeed={addFeed}
          onRemoveFeed={removeFeed}
          onSave={saveConfig}
          onSetWebhook={(v) => setLocalConfig({ ...localConfig, feishu_webhook: v })}
        />
      )}

      {/* News */}
      {!Object.keys(cats).length ? (
        <div className="mb-empty">ยังไม่มีข้อมูล กด "เรียกข่าวเดี๋ยวนี้" มุมขวาบนเพื่อรับสรุปของวันนี้</div>
      ) : (
        <div className="mb-cats">
          {Object.entries(cats).map(([cat, items]) => {
            if (!enabledSet.has(cat)) return null;
            const meta = CAT_META[cat] || { icon: '📰', color: 'var(--acc)', desc: cat, label: cat };
            const scored = (items as MorningNewsItem[])
              .map((item) => {
                const text = ((item.title || '') + (item.summary || '')).toLowerCase();
                const kwHits = userKws.filter((k) => text.includes(k)).length;
                return { ...item, _kwHits: kwHits };
              })
              .sort((a, b) => b._kwHits - a._kwHits);

            return (
              <div className="mb-cat" key={cat}>
                <div className="mb-cat-hdr">
                  <span className="mb-cat-icon">{meta.icon}</span>
                  <span className="mb-cat-name" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="mb-cat-cnt">{scored.length} เรื่อง</span>
                </div>
                <div className="mb-news-list">
                  {!scored.length ? (
                    <div className="mb-empty" style={{ padding: 16 }}>ยังไม่มีข่าว</div>
                  ) : (
                    scored.map((item, i) => {
                      const hasImg = !!(item.image && item.image.startsWith('http'));
                      return (
                        <div
                          className="mb-card"
                          key={i}
                          onClick={() => window.open(item.link, '_blank')}
                        >
                          <div className="mb-img">
                            {hasImg ? (
                              <img
                                src={item.image}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                                loading="lazy"
                                alt=""
                              />
                            ) : (
                              <span>{meta.icon}</span>
                            )}
                          </div>
                          <div className="mb-info">
                            <div className="mb-headline">
                              {item.title}
                              {item._kwHits > 0 && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    padding: '1px 5px',
                                    borderRadius: 999,
                                    background: '#a07aff22',
                                    color: '#a07aff',
                                    border: '1px solid #a07aff44',
                                    marginLeft: 4,
                                  }}
                                >
                                  ⭐ น่าจับตา
                                </span>
                              )}
                            </div>
                            <div className="mb-summary">{item.summary || item.desc || ''}</div>
                            <div className="mb-meta">
                              <span className="mb-source">📡 {item.source || ''}</span>
                              {item.pub_date && (
                                <span className="mb-time">{item.pub_date.substring(0, 16)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubConfigPanel({
  config,
  enabledSet,
  onToggleCat,
  onAddKeyword,
  onRemoveKeyword,
  onAddFeed,
  onRemoveFeed,
  onSave,
  onSetWebhook,
}: {
  config: SubConfig;
  enabledSet: Set<string>;
  onToggleCat: (name: string) => void;
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (i: number) => void;
  onAddFeed: (name: string, url: string, cat: string) => void;
  onRemoveFeed: (i: number) => void;
  onSave: () => void;
  onSetWebhook: (v: string) => void;
}) {
  const [newKw, setNewKw] = useState('');
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedCat, setFeedCat] = useState(DEFAULT_CATS[0]);

  const allCats = [...DEFAULT_CATS];
  (config.categories || []).forEach((c) => {
    if (!allCats.includes(c.name)) allCats.push(c.name);
  });

  return (
    <div className="sub-config" style={{ marginBottom: 20, padding: 16, background: 'var(--panel2)', borderRadius: 12, border: '1px solid var(--line)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>⚙ ตั้งค่าการติดตาม</div>

      {/* Categories */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>หมวดที่ติดตาม</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allCats.map((cat) => {
            const meta = CAT_META[cat] || { icon: '📰', color: 'var(--acc)', desc: cat, label: cat };
            const on = enabledSet.has(cat);
            return (
              <div
                key={cat}
                className={`sub-cat ${on ? 'active' : ''}`}
                onClick={() => onToggleCat(cat)}
                style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1px solid ${on ? 'var(--acc)' : 'var(--line)'}`, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>{meta.icon}</span>
                <span style={{ fontSize: 12 }}>{meta.label}</span>
                {on && <span style={{ fontSize: 10, color: 'var(--ok)' }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keywords */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>คำสำคัญที่จับตา</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {(config.keywords || []).map((kw, i) => (
            <span key={i} className="sub-kw" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--line)' }}>
              {kw}
              <span style={{ cursor: 'pointer', marginLeft: 4, color: 'var(--danger)' }} onClick={() => onRemoveKeyword(i)}>✕</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            placeholder="กรอกคำสำคัญ"
            onKeyDown={(e) => { if (e.key === 'Enter') { onAddKeyword(newKw.trim()); setNewKw(''); } }}
            style={{ flex: 1, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}
          />
          <button className="btn btn-g" onClick={() => { onAddKeyword(newKw.trim()); setNewKw(''); }} style={{ fontSize: 11, padding: '4px 12px' }}>
            เพิ่ม
          </button>
        </div>
      </div>

      {/* Custom Feeds */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>แหล่งข่าวที่กำหนดเอง</div>
        {(config.custom_feeds || []).map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
            <span style={{ fontWeight: 600 }}>{f.name}</span>
            <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.url}</span>
            <span style={{ color: 'var(--acc)' }}>{f.category}</span>
            <span style={{ cursor: 'pointer', color: 'var(--danger)' }} onClick={() => onRemoveFeed(i)}>✕</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input placeholder="ชื่อแหล่งข่าว" value={feedName} onChange={(e) => setFeedName(e.target.value)}
            style={{ width: 100, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 11, outline: 'none' }} />
          <input placeholder="RSS / URL" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)}
            style={{ flex: 1, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 11, outline: 'none' }} />
          <select value={feedCat} onChange={(e) => setFeedCat(e.target.value)}
            style={{ padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 11, outline: 'none' }}>
            {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-g" onClick={() => { onAddFeed(feedName, feedUrl, feedCat); setFeedName(''); setFeedUrl(''); }} style={{ fontSize: 11, padding: '4px 12px' }}>
            เพิ่ม
          </button>
        </div>
      </div>

      {/* Feishu Webhook */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Feishu Webhook</div>
        <input
          type="text"
          value={config.feishu_webhook || ''}
          onChange={(e) => onSetWebhook(e.target.value)}
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="tpl-go" onClick={onSave} style={{ fontSize: 12, padding: '6px 16px' }}>
          💾 บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
}
