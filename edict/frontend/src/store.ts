/**
 * Zustand Store — 三省六部看板状态管理
 * HTTP 5s 轮询，无 WebSocket
 */

import { create } from 'zustand';
import {
  api,
  type Task,
  type LiveStatus,
  type AgentConfig,
  type OfficialsData,
  type AgentsStatusData,
  type MorningBrief,
  type SubConfig,
  type ChangeLogEntry,
} from './api';

// ── Pipeline Definition (PIPE) ──

export const PIPE = [
  { key: 'Inbox',    dept: '皇上',   icon: '👑', action: 'มีพระราชโองการ' },
  { key: 'Taizi',    dept: '太子',   icon: '🤴', action: 'ทรงคัดกรอง' },
  { key: 'Zhongshu', dept: '中书省', icon: '📜', action: 'ร่างฎีกา' },
  { key: 'Menxia',   dept: '门下省', icon: '🔍', action: 'ไต่ตรอง' },
  { key: 'Assigned', dept: '尚书省', icon: '📮', action: 'แจกจ่ายราชการ' },
  { key: 'Doing',    dept: '六部',   icon: '⚙️', action: 'สนองพระบัญชา' },
  { key: 'Review',   dept: '尚书省', icon: '🔎', action: 'รวบรวมถวาย' },
  { key: 'Done',     dept: '回奏',   icon: '✅', action: 'กราบทูลเสร็จสิ้น' },
] as const;

export const PIPE_STATE_IDX: Record<string, number> = {
  Inbox: 0, Pending: 0, Taizi: 1, Zhongshu: 2, Menxia: 3,
  Assigned: 4, Doing: 5, Review: 6, Done: 7, Blocked: 5, Cancelled: 5, Next: 4,
};

export const DEPT_COLOR: Record<string, string> = {
  '太子': '#e8a040', '中书省': '#a07aff', '门下省': '#6a9eff', '尚书省': '#6aef9a',
  '礼部': '#f5c842', '户部': '#ff9a6a', '兵部': '#ff5270', '刑部': '#cc4444',
  '工部': '#44aaff', '吏部': '#9b59b6', '皇上': '#ffd700', '回奏': '#2ecc8a',
};

export const STATE_LABEL: Record<string, string> = {
  Inbox: 'รับพระราชโองการ',
  Pending: 'รอพิจารณา',
  Taizi: 'รัชทายาทคัดกรอง',
  Zhongshu: 'สำนักจงซูร่างฎีกา',
  Menxia: 'สำนักเหมินเซี่ยไต่ตรอง',
  Assigned: 'มอบหมายแล้ว',
  Doing: 'กำลังสนองพระบัญชา',
  Review: 'รอถวายทบทวน',
  Done: 'เสร็จสิ้นแล้ว',
  Blocked: 'ติดขัด',
  Cancelled: 'ทรงระงับ',
  Next: 'รอปฏิบัติ',
};

export const DEPT_DISPLAY: Record<string, string> = {
  '皇上': 'ฮ่องเต้',
  '太子': 'องค์รัชทายาท',
  '中书省': 'สำนักจงซู',
  '门下省': 'สำนักเหมินเซี่ย',
  '尚书省': 'สำนักซั่งซู',
  '六部': 'หกกรม',
  '礼部': 'กรมพิธีการ',
  '户部': 'กรมคลัง',
  '兵部': 'กรมทหาร',
  '刑部': 'กรมอาญา',
  '工部': 'กรมโยธา',
  '吏部': 'กรมขุนนาง',
  '钦天监': 'สำนักโหรหลวง',
  '回奏': 'ถวายรายงานกลับ',
};

export const ROLE_DISPLAY: Record<string, string> = {
  '太子': 'องค์รัชทายาท',
  '中书令': 'อัครเสนาบดีสำนักจงซู',
  '侍中': 'เสนาบดีสำนักเหมินเซี่ย',
  '尚书令': 'อัครเสนาบดีสำนักซั่งซู',
  '礼部尚书': 'เสนาบดีกรมพิธีการ',
  '户部尚书': 'เสนาบดีกรมคลัง',
  '兵部尚书': 'เสนาบดีกรมทหาร',
  '刑部尚书': 'เสนาบดีกรมอาญา',
  '工部尚书': 'เสนาบดีกรมโยธา',
  '吏部尚书': 'เสนาบดีกรมขุนนาง',
  '朝报官': 'เจ้ากรมข่าวราชสำนัก',
};

export const RANK_DISPLAY: Record<string, string> = {
  '储君': 'รัชทายาท',
  '正一品': 'ชั้นเอกอัครมหาเสนาบดี',
  '正二品': 'ชั้นโทอัครเสนาบดี',
  '正三品': 'ชั้นตรี',
};

export function deptColor(d: string): string {
  return DEPT_COLOR[d] || '#6a9eff';
}

export function displayDept(d: string): string {
  return DEPT_DISPLAY[d] || d;
}

export function displayRole(r: string): string {
  return ROLE_DISPLAY[r] || r;
}

export function displayRank(r: string): string {
  return RANK_DISPLAY[r] || r;
}

export function stateLabel(t: Task): string {
  const r = t.review_round || 0;
  if (t.state === 'Menxia' && r > 1) return `สำนักเหมินเซี่ยไต่ตรอง รอบที่ ${r}`;
  if (t.state === 'Zhongshu' && r > 0) return `สำนักจงซูแก้ร่าง รอบที่ ${r}`;
  return STATE_LABEL[t.state] || t.state;
}

export function isEdict(t: Task): boolean {
  return /^JJC-/i.test(t.id || '');
}

export function isSession(t: Task): boolean {
  return /^(OC-|MC-)/i.test(t.id || '');
}

export function isArchived(t: Task): boolean {
  return t.archived || ['Done', 'Cancelled'].includes(t.state);
}

export type PipeStatus = { key: string; dept: string; icon: string; action: string; status: 'done' | 'active' | 'pending' };

export function getPipeStatus(t: Task): PipeStatus[] {
  const stateIdx = PIPE_STATE_IDX[t.state] ?? 4;
  return PIPE.map((stage, i) => ({
    ...stage,
    status: (i < stateIdx ? 'done' : i === stateIdx ? 'active' : 'pending') as 'done' | 'active' | 'pending',
  }));
}

// ── Tabs ──

export type TabKey =
  | 'edicts' | 'monitor' | 'officials' | 'models'
  | 'skills' | 'sessions' | 'memorials' | 'templates' | 'morning' | 'court';

export const TAB_DEFS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'edicts',    label: 'กระดานราชโองการ', icon: '📜' },
  { key: 'court',     label: 'ท้องพระโรง', icon: '🏛️' },
  { key: 'monitor',   label: 'การเร่งราชการ', icon: '🔌' },
  { key: 'officials', label: 'ทำเนียบขุนนาง', icon: '👔' },
  { key: 'models',    label: 'กำหนดแบบจำลอง', icon: '🤖' },
  { key: 'skills',    label: 'คลังทักษะ', icon: '🎯' },
  { key: 'sessions',  label: 'งานย่อย',   icon: '💬' },
  { key: 'memorials', label: 'หอฎีกา',   icon: '📜' },
  { key: 'templates', label: 'คลังราชโองการ', icon: '📋' },
  { key: 'morning',   label: 'ข่าวยามเช้า', icon: '🌅' },
];

// ── DEPTS for monitor ──

export const DEPTS = [
  { id: 'taizi',    label: '太子',   emoji: '🤴', role: '太子',     rank: '储君' },
  { id: 'zhongshu', label: '中书省', emoji: '📜', role: '中书令',   rank: '正一品' },
  { id: 'menxia',   label: '门下省', emoji: '🔍', role: '侍中',     rank: '正一品' },
  { id: 'shangshu', label: '尚书省', emoji: '📮', role: '尚书令',   rank: '正一品' },
  { id: 'libu',     label: '礼部',   emoji: '📝', role: '礼部尚书', rank: '正二品' },
  { id: 'hubu',     label: '户部',   emoji: '💰', role: '户部尚书', rank: '正二品' },
  { id: 'bingbu',   label: '兵部',   emoji: '⚔️', role: '兵部尚书', rank: '正二品' },
  { id: 'xingbu',   label: '刑部',   emoji: '⚖️', role: '刑部尚书', rank: '正二品' },
  { id: 'gongbu',   label: '工部',   emoji: '🔧', role: '工部尚书', rank: '正二品' },
  { id: 'libu_hr',  label: '吏部',   emoji: '👔', role: '吏部尚书', rank: '正二品' },
  { id: 'zaochao',  label: '钦天监', emoji: '📰', role: '朝报官',   rank: '正三品' },
];

// ── Templates ──

export interface TemplateParam {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  default?: string;
  required?: boolean;
  options?: string[];
}

export interface Template {
  id: string;
  cat: string;
  icon: string;
  name: string;
  desc: string;
  depts: string[];
  est: string;
  cost: string;
  params: TemplateParam[];
  command: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'tpl-weekly-report', cat: 'ราชการประจำ', icon: '📝', name: 'ร่างรายงานประจำสัปดาห์',
    desc: 'เรียบเรียงรายงานประจำสัปดาห์จากข้อมูลบนกระดานและผลงานของแต่ละกรมโดยอัตโนมัติ',
    depts: ['户部', '礼部'], est: '~10分钟', cost: '¥0.5',
    params: [
      { key: 'date_range', label: 'ช่วงเวลารายงาน', type: 'text', default: 'สัปดาห์นี้', required: true },
      { key: 'focus', label: 'ประเด็นสำคัญ (คั่นด้วยจุลภาค)', type: 'text', default: 'ความคืบหน้าโครงการ,แผนสัปดาห์หน้า' },
      { key: 'format', label: 'รูปแบบผลลัพธ์', type: 'select', options: ['Markdown', 'เอกสาร Feishu'], default: 'Markdown' },
    ],
    command: 'จงร่างรายงานประจำ{date_range} โดยเน้นเรื่อง {focus} และส่งออกเป็นรูปแบบ {format}',
  },
  {
    id: 'tpl-code-review', cat: 'งานวิศวกรรม', icon: '🔍', name: 'ตรวจทานโค้ด',
    desc: 'ตรวจคุณภาพคลังโค้ดหรือไฟล์ที่ระบุ แล้วสรุปรายการปัญหาและข้อเสนอแนะ',
    depts: ['兵部', '刑部'], est: '~20分钟', cost: '¥2',
    params: [
      { key: 'repo', label: 'คลังโค้ดหรือพาธไฟล์', type: 'text', required: true },
      { key: 'scope', label: 'ขอบเขตการตรวจ', type: 'select', options: ['ทั้งหมด', 'เฉพาะส่วนเปลี่ยนล่าสุด', 'ไฟล์ที่ระบุ'], default: 'เฉพาะส่วนเปลี่ยนล่าสุด' },
      { key: 'focus', label: 'ประเด็นที่ให้จับตา (ถ้ามี)', type: 'text', default: 'ช่องโหว่ความปลอดภัย,การจัดการข้อผิดพลาด,ประสิทธิภาพ' },
    ],
    command: 'จงตรวจทานโค้ดของ {repo} ในขอบเขต {scope} โดยเน้น {focus}',
  },
  {
    id: 'tpl-api-design', cat: 'งานวิศวกรรม', icon: '⚡', name: 'ออกแบบและสร้าง API',
    desc: 'ตั้งแต่อธิบายความต้องการ ออกแบบ API ไปจนถึงลงมือทำและทดสอบให้ครบถ้วน',
    depts: ['中书省', '兵部'], est: '~45分钟', cost: '¥3',
    params: [
      { key: 'requirement', label: 'คำอธิบายความต้องการ', type: 'textarea', required: true },
      { key: 'tech', label: 'เทคสแตก', type: 'select', options: ['Python/FastAPI', 'Node/Express', 'Go/Gin'], default: 'Python/FastAPI' },
      { key: 'auth', label: 'วิธียืนยันสิทธิ์', type: 'select', options: ['JWT', 'API Key', 'ไม่มี'], default: 'JWT' },
    ],
    command: 'จงออกแบบและสร้าง RESTful API ด้วย {tech} สำหรับงานต่อไปนี้: {requirement} โดยใช้วิธียืนยันสิทธิ์แบบ {auth}',
  },
  {
    id: 'tpl-competitor', cat: 'วิเคราะห์ข้อมูล', icon: '📊', name: 'วิเคราะห์คู่แข่ง',
    desc: 'รวบรวมข้อมูลจากเว็บไซต์คู่แข่ง เปรียบเทียบ แล้วจัดทำรายงานอย่างเป็นระบบ',
    depts: ['兵部', '户部', '礼部'], est: '~60分钟', cost: '¥5',
    params: [
      { key: 'targets', label: 'ชื่อหรือ URL ของคู่แข่ง (บรรทัดละหนึ่งรายการ)', type: 'textarea', required: true },
      { key: 'dimensions', label: 'มิติการวิเคราะห์', type: 'text', default: 'คุณสมบัติสินค้า,กลยุทธ์ราคา,เสียงตอบรับผู้ใช้' },
      { key: 'format', label: 'รูปแบบผลลัพธ์', type: 'select', options: ['รายงาน Markdown', 'ตารางเปรียบเทียบ'], default: 'รายงาน Markdown' },
    ],
    command: 'จงวิเคราะห์คู่แข่งต่อไปนี้:\n{targets}\n\nมิติการวิเคราะห์: {dimensions}\nผลลัพธ์ที่ต้องการ: {format}',
  },
  {
    id: 'tpl-data-report', cat: 'วิเคราะห์ข้อมูล', icon: '📈', name: 'รายงานข้อมูล',
    desc: 'ทำความสะอาด วิเคราะห์ และสร้างภาพข้อมูลจากชุดข้อมูลที่กำหนด พร้อมสรุปรายงาน',
    depts: ['户部', '礼部'], est: '~30分钟', cost: '¥2',
    params: [
      { key: 'data_source', label: 'คำอธิบายหรือพาธของแหล่งข้อมูล', type: 'text', required: true },
      { key: 'questions', label: 'คำถามสำหรับการวิเคราะห์ (บรรทัดละหนึ่งข้อ)', type: 'textarea' },
      { key: 'viz', label: 'ต้องการแผนภาพประกอบหรือไม่', type: 'select', options: ['ต้องการ', 'ไม่ต้องการ'], default: 'ต้องการ' },
    ],
    command: 'จงวิเคราะห์ข้อมูลจาก {data_source}\nประเด็นคำถาม: {questions}\nแผนภาพประกอบ: {viz}',
  },
  {
    id: 'tpl-blog', cat: 'งานประพันธ์', icon: '✍️', name: 'บทความบล็อก',
    desc: 'รจนาบทความบล็อกคุณภาพสูงตามหัวข้อและข้อกำหนดที่ระบุ',
    depts: ['礼部'], est: '~15分钟', cost: '¥1',
    params: [
      { key: 'topic', label: 'หัวข้อบทความ', type: 'text', required: true },
      { key: 'audience', label: 'ผู้อ่านเป้าหมาย', type: 'text', default: 'บุคลากรสายเทคนิค' },
      { key: 'length', label: 'ความยาวที่ต้องการ', type: 'select', options: ['ราว 1,000 คำ', 'ราว 2,000 คำ', 'ราว 3,000 คำ'], default: 'ราว 2,000 คำ' },
      { key: 'style', label: 'ลีลา', type: 'select', options: ['กวดวิชาเทคนิค', 'บทวิจารณ์ความเห็น', 'วิเคราะห์กรณีศึกษา'], default: 'กวดวิชาเทคนิค' },
    ],
    command: 'จงรจนาบทความบล็อกเรื่อง "{topic}" สำหรับผู้อ่านกลุ่ม {audience} ความยาว {length} และใช้ลีลาแบบ {style}',
  },
  {
    id: 'tpl-deploy', cat: 'งานวิศวกรรม', icon: '🚀', name: 'แผนการติดตั้งระบบ',
    desc: 'จัดทำเช็กลิสต์การติดตั้ง การตั้งค่า Docker และกระบวนการ CI/CD อย่างครบถ้วน',
    depts: ['兵部', '工部'], est: '~25分钟', cost: '¥2',
    params: [
      { key: 'project', label: 'ชื่อหรือคำอธิบายโครงการ', type: 'text', required: true },
      { key: 'env', label: 'สภาพแวดล้อมที่จะติดตั้ง', type: 'select', options: ['Docker', 'K8s', 'VPS', 'Serverless'], default: 'Docker' },
      { key: 'ci', label: 'เครื่องมือ CI/CD', type: 'select', options: ['GitHub Actions', 'GitLab CI', 'ไม่มี'], default: 'GitHub Actions' },
    ],
    command: 'จงจัดทำแผนติดตั้งระบบแบบ {env} สำหรับโครงการ "{project}" และใช้ {ci} เป็นเครื่องมือ CI/CD',
  },
  {
    id: 'tpl-email', cat: 'งานประพันธ์', icon: '📧', name: 'ร่างหนังสือหรือประกาศ',
    desc: 'สร้างข้อความอีเมลหรือประกาศอย่างเป็นทางการตามบริบทและจุดประสงค์',
    depts: ['礼部'], est: '~5分钟', cost: '¥0.3',
    params: [
      { key: 'scenario', label: 'ลักษณะการใช้งาน', type: 'select', options: ['อีเมลธุรกิจ', 'ประกาศเปิดตัวสินค้า', 'หนังสือแจ้งลูกค้า', 'ประกาศภายใน'], default: 'อีเมลธุรกิจ' },
      { key: 'purpose', label: 'จุดประสงค์หรือเนื้อหา', type: 'textarea', required: true },
      { key: 'tone', label: 'น้ำเสียง', type: 'select', options: ['เป็นทางการ', 'สุภาพเป็นมิตร', 'กระชับ'], default: 'เป็นทางการ' },
    ],
    command: 'จงร่าง{scenario}ด้วยน้ำเสียง{tone} เนื้อหาดังนี้: {purpose}',
  },
  {
    id: 'tpl-standup', cat: 'ราชการประจำ', icon: '🗓️', name: 'สรุปรายงานประชุมประจำวัน',
    desc: 'รวบรวมความคืบหน้าของแต่ละกรมในวันนี้และแผนสำหรับวันถัดไปเป็นบทสรุปเดียว',
    depts: ['尚书省'], est: '~5分钟', cost: '¥0.3',
    params: [
      { key: 'range', label: 'ช่วงเวลาที่จะสรุป', type: 'select', options: ['วันนี้', '24 ชั่วโมงล่าสุด', 'เมื่อวานรวมวันนี้'], default: 'วันนี้' },
    ],
    command: 'จงสรุปความคืบหน้าและงานคั่งค้างของแต่ละกรมในช่วง {range} เป็นบทสรุปการประชุม',
  },
];

export const TPL_CATS = [
  { name: 'ทั้งหมด', icon: '📋' },
  { name: 'ราชการประจำ', icon: '💼' },
  { name: 'วิเคราะห์ข้อมูล', icon: '📊' },
  { name: 'งานวิศวกรรม', icon: '⚙️' },
  { name: 'งานประพันธ์', icon: '✍️' },
];

// ── Main Store ──

interface AppStore {
  // Data
  liveStatus: LiveStatus | null;
  agentConfig: AgentConfig | null;
  changeLog: ChangeLogEntry[];
  officialsData: OfficialsData | null;
  agentsStatusData: AgentsStatusData | null;
  morningBrief: MorningBrief | null;
  subConfig: SubConfig | null;

  // UI State
  activeTab: TabKey;
  edictFilter: 'active' | 'archived' | 'all';
  sessFilter: string;
  tplCatFilter: string;
  selectedOfficial: string | null;
  modalTaskId: string | null;
  countdown: number;

  // Toast
  toasts: { id: number; msg: string; type: 'ok' | 'err' }[];

  // Actions
  setActiveTab: (tab: TabKey) => void;
  setEdictFilter: (f: 'active' | 'archived' | 'all') => void;
  setSessFilter: (f: string) => void;
  setTplCatFilter: (f: string) => void;
  setSelectedOfficial: (id: string | null) => void;
  setModalTaskId: (id: string | null) => void;
  setCountdown: (n: number) => void;
  toast: (msg: string, type?: 'ok' | 'err') => void;

  // Data fetching
  loadLive: () => Promise<void>;
  loadAgentConfig: () => Promise<void>;
  loadOfficials: () => Promise<void>;
  loadAgentsStatus: () => Promise<void>;
  loadMorning: () => Promise<void>;
  loadSubConfig: () => Promise<void>;
  loadAll: () => Promise<void>;
}

let _toastId = 0;

export const useStore = create<AppStore>((set, get) => ({
  liveStatus: null,
  agentConfig: null,
  changeLog: [],
  officialsData: null,
  agentsStatusData: null,
  morningBrief: null,
  subConfig: null,

  activeTab: 'edicts',
  edictFilter: 'active',
  sessFilter: 'all',
  tplCatFilter: 'ทั้งหมด',
  selectedOfficial: null,
  modalTaskId: null,
  countdown: 5,

  toasts: [],

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    const s = get();
    if (['models', 'skills', 'sessions'].includes(tab) && !s.agentConfig) s.loadAgentConfig();
    if (tab === 'officials' && !s.officialsData) s.loadOfficials();
    if (tab === 'monitor') s.loadAgentsStatus();
    if (tab === 'morning' && !s.morningBrief) s.loadMorning();
  },
  setEdictFilter: (f) => set({ edictFilter: f }),
  setSessFilter: (f) => set({ sessFilter: f }),
  setTplCatFilter: (f) => set({ tplCatFilter: f }),
  setSelectedOfficial: (id) => set({ selectedOfficial: id }),
  setModalTaskId: (id) => set({ modalTaskId: id }),
  setCountdown: (n) => set({ countdown: n }),

  toast: (msg, type = 'ok') => {
    const id = ++_toastId;
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  loadLive: async () => {
    try {
      const data = await api.liveStatus();
      set({ liveStatus: data });
      // Also preload officials for monitor tab
      const s = get();
      if (!s.officialsData) {
        api.officialsStats().then((d) => set({ officialsData: d })).catch(() => {});
      }
    } catch {
      // silently fail
    }
  },

  loadAgentConfig: async () => {
    try {
      const cfg = await api.agentConfig();
      const log = await api.modelChangeLog();
      set({ agentConfig: cfg, changeLog: log });
    } catch {
      // silently fail
    }
  },

  loadOfficials: async () => {
    try {
      const data = await api.officialsStats();
      set({ officialsData: data });
    } catch {
      // silently fail
    }
  },

  loadAgentsStatus: async () => {
    try {
      const data = await api.agentsStatus();
      set({ agentsStatusData: data });
    } catch {
      set({ agentsStatusData: null });
    }
  },

  loadMorning: async () => {
    try {
      const [brief, config] = await Promise.all([api.morningBrief(), api.morningConfig()]);
      set({ morningBrief: brief, subConfig: config });
    } catch {
      // silently fail
    }
  },

  loadSubConfig: async () => {
    try {
      const config = await api.morningConfig();
      set({ subConfig: config });
    } catch {
      // silently fail
    }
  },

  loadAll: async () => {
    const s = get();
    await s.loadLive();
    const tab = s.activeTab;
    if (['models', 'skills'].includes(tab)) await s.loadAgentConfig();
  },
}));

// ── Countdown & Polling ──

let _cdTimer: ReturnType<typeof setInterval> | null = null;

export function startPolling() {
  if (_cdTimer) return;
  useStore.getState().loadAll();
  _cdTimer = setInterval(() => {
    const s = useStore.getState();
    const cd = s.countdown - 1;
    if (cd <= 0) {
      s.setCountdown(5);
      s.loadAll();
    } else {
      s.setCountdown(cd);
    }
  }, 1000);
}

export function stopPolling() {
  if (_cdTimer) {
    clearInterval(_cdTimer);
    _cdTimer = null;
  }
}

// ── Utility ──

export function esc(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อครู่นี้';
    if (mins < 60) return mins + ' นาทีที่แล้ว';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' ชั่วโมงที่แล้ว';
    return Math.floor(hrs / 24) + ' วันที่แล้ว';
  } catch {
    return '';
  }
}
