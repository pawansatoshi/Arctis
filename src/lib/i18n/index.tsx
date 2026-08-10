'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: 'EN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: 'HI' },
  { code: 'es', label: 'Spanish', native: 'Español', flag: 'ES' },
  { code: 'pt', label: 'Portuguese', native: 'Português', flag: 'PT' },
  { code: 'zh', label: 'Chinese', native: '中文', flag: '中' },
  { code: 'ko', label: 'Korean', native: '한국어', flag: 'KO' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', flag: 'VI' },
  { code: 'fr', label: 'French', native: 'Français', flag: 'FR' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili', flag: 'SW' },
  { code: 'ar', label: 'Arabic', native: 'العربية', flag: 'AR' },
] as const;

export type Locale = typeof LANGUAGES[number]['code'];

const DICT: Record<Locale, Record<string, string>> = {
  en: {},
  hi: {
    Platform: 'प्लेटफ़ॉर्म', Trust: 'विश्वास', Dashboard: 'डैशबोर्ड', 'Launch App': 'ऐप खोलें', 'Open ARCTIS': 'ARCTIS खोलें', 'Send USDC': 'USDC भेजें',
    'The Web3 Operating System': 'Web3 ऑपरेटिंग सिस्टम', 'for Humans and Agents': 'इंसानों और एजेंट्स के लिए',
    'AI OS': 'AI OS', 'Stablecoin OS': 'Stablecoin OS', 'Economic Agent OS': 'Economic Agent OS', 'Knowledge OS': 'Knowledge OS',
    Overview: 'अवलोकन', Activity: 'गतिविधि', History: 'इतिहास', 'AI Workspace': 'AI वर्कस्पेस', Copilot: 'कोपायलट', Agents: 'एजेंट्स', Workspace: 'वर्कस्पेस', Knowledge: 'ज्ञान', Transfer: 'ट्रांसफ़र', Swap: 'स्वैप', Bridge: 'ब्रिज', Finance: 'वित्त', Treasury: 'ट्रेज़री', Credits: 'क्रेडिट्स', Settings: 'सेटिंग्स', Feedback: 'फ़ीडबैक', Admin: 'एडमिन',
    Search: 'खोजें', 'Wrong Network': 'गलत नेटवर्क', 'Switch Network': 'नेटवर्क बदलें', 'Switch to Arc': 'Arc पर जाएँ', 'Arc Testnet': 'Arc टेस्टनेट',
    'Connect your wallet to bridge USDC': 'USDC ब्रिज करने के लिए वॉलेट कनेक्ट करें', From: 'से', To: 'तक', 'Amount (USDC)': 'राशि (USDC)', Fee: 'फ़ीस', 'Estimated time': 'अनुमानित समय', 'Bridge History': 'ब्रिज इतिहास', 'No bridges yet': 'अभी कोई ब्रिज नहीं', 'Bridge Complete': 'ब्रिज पूरा हुआ', 'New Bridge': 'नया ब्रिज', 'Buy Credits': 'क्रेडिट खरीदें', 'Swap Tokens': 'टोकन स्वैप करें', 'Bridge USDC to Arc': 'USDC को Arc पर ब्रिज करें', 'Try Again': 'फिर कोशिश करें', 'Bridging…': 'ब्रिज हो रहा है…', 'Circle App Kit': 'Circle App Kit', 'Loading…': 'लोड हो रहा है…',
  },
  es: {
    Platform: 'Plataforma', Trust: 'Confianza', Dashboard: 'Panel', 'Launch App': 'Abrir app', 'Open ARCTIS': 'Abrir ARCTIS', 'Send USDC': 'Enviar USDC',
    'The Web3 Operating System': 'El sistema operativo Web3', 'for Humans and Agents': 'para personas y agentes', Overview: 'Resumen', Activity: 'Actividad', History: 'Historial', 'AI Workspace': 'Espacio de IA', Copilot: 'Copiloto', Agents: 'Agentes', Workspace: 'Espacio de trabajo', Knowledge: 'Conocimiento', Transfer: 'Transferir', Swap: 'Intercambiar', Bridge: 'Puente', Finance: 'Finanzas', Treasury: 'Tesorería', Credits: 'Créditos', Settings: 'Configuración', Feedback: 'Comentarios', Admin: 'Admin', Search: 'Buscar', 'Wrong Network': 'Red incorrecta', 'Switch Network': 'Cambiar red', 'Switch to Arc': 'Cambiar a Arc', 'Arc Testnet': 'Red de prueba de Arc', From: 'Desde', To: 'Destino', 'Amount (USDC)': 'Cantidad (USDC)', Fee: 'Comisión', 'Estimated time': 'Tiempo estimado', 'Bridge History': 'Historial de puentes', 'No bridges yet': 'Aún no hay puentes', 'Bridge Complete': 'Puente completado', 'New Bridge': 'Nuevo puente', 'Buy Credits': 'Comprar créditos', 'Swap Tokens': 'Intercambiar tokens', 'Bridge USDC to Arc': 'Puente USDC a Arc', 'Try Again': 'Intentar de nuevo', 'Bridging…': 'Puenteando…', 'Loading…': 'Cargando…',
  },
  pt: {
    Platform: 'Plataforma', Trust: 'Confiança', Dashboard: 'Painel', 'Launch App': 'Abrir app', 'Open ARCTIS': 'Abrir ARCTIS', 'Send USDC': 'Enviar USDC',
    'The Web3 Operating System': 'O sistema operacional Web3', 'for Humans and Agents': 'para pessoas e agentes', Overview: 'Visão geral', Activity: 'Atividade', History: 'Histórico', 'AI Workspace': 'Espaço de IA', Copilot: 'Copiloto', Agents: 'Agentes', Workspace: 'Espaço de trabalho', Knowledge: 'Conhecimento', Transfer: 'Transferir', Swap: 'Trocar', Bridge: 'Ponte', Finance: 'Finanças', Treasury: 'Tesouraria', Credits: 'Créditos', Settings: 'Configurações', Feedback: 'Feedback', Admin: 'Admin', Search: 'Pesquisar', 'Wrong Network': 'Rede incorreta', 'Switch Network': 'Trocar rede', 'Switch to Arc': 'Mudar para Arc', 'Arc Testnet': 'Testnet Arc', From: 'De', To: 'Para', 'Amount (USDC)': 'Valor (USDC)', Fee: 'Taxa', 'Estimated time': 'Tempo estimado', 'Bridge History': 'Histórico de pontes', 'No bridges yet': 'Ainda não há pontes', 'Bridge Complete': 'Ponte concluída', 'New Bridge': 'Nova ponte', 'Buy Credits': 'Comprar créditos', 'Swap Tokens': 'Trocar tokens', 'Bridge USDC to Arc': 'Fazer ponte de USDC para Arc', 'Try Again': 'Tentar novamente', 'Bridging…': 'Fazendo ponte…', 'Loading…': 'Carregando…',
  },
  zh: {
    Platform: '平台', Trust: '信任', Dashboard: '仪表板', 'Launch App': '打开应用', 'Open ARCTIS': '打开 ARCTIS', 'Send USDC': '发送 USDC',
    'The Web3 Operating System': 'Web3 操作系统', 'for Humans and Agents': '面向人类与智能代理', Overview: '概览', Activity: '活动', History: '历史', 'AI Workspace': 'AI 工作区', Copilot: '副驾驶', Agents: '代理', Workspace: '工作区', Knowledge: '知识', Transfer: '转账', Swap: '兑换', Bridge: '跨链', Finance: '金融', Treasury: '金库', Credits: '积分', Settings: '设置', Feedback: '反馈', Admin: '管理', Search: '搜索', 'Wrong Network': '网络错误', 'Switch Network': '切换网络', 'Switch to Arc': '切换到 Arc', 'Arc Testnet': 'Arc 测试网', From: '来源', To: '目标', 'Amount (USDC)': '金额（USDC）', Fee: '费用', 'Estimated time': '预计时间', 'Bridge History': '跨链历史', 'No bridges yet': '暂无跨链记录', 'Bridge Complete': '跨链完成', 'New Bridge': '新的跨链', 'Buy Credits': '购买积分', 'Swap Tokens': '兑换代币', 'Bridge USDC to Arc': '将 USDC 跨链到 Arc', 'Try Again': '重试', 'Bridging…': '跨链处理中…', 'Loading…': '加载中…',
  },
  ko: {
    Platform: '플랫폼', Trust: '신뢰', Dashboard: '대시보드', 'Launch App': '앱 열기', 'Open ARCTIS': 'ARCTIS 열기', 'Send USDC': 'USDC 보내기',
    'The Web3 Operating System': 'Web3 운영체제', 'for Humans and Agents': '사람과 에이전트를 위한', Overview: '개요', Activity: '활동', History: '기록', 'AI Workspace': 'AI 워크스페이스', Copilot: '코파일럿', Agents: '에이전트', Workspace: '워크스페이스', Knowledge: '지식', Transfer: '전송', Swap: '스왑', Bridge: '브리지', Finance: '금융', Treasury: '트레저리', Credits: '크레딧', Settings: '설정', Feedback: '피드백', Admin: '관리', Search: '검색', 'Wrong Network': '잘못된 네트워크', 'Switch Network': '네트워크 전환', 'Switch to Arc': 'Arc로 전환', 'Arc Testnet': 'Arc 테스트넷', From: '출발', To: '도착', 'Amount (USDC)': '금액 (USDC)', Fee: '수수료', 'Estimated time': '예상 시간', 'Bridge History': '브리지 기록', 'No bridges yet': '아직 브리지 기록이 없습니다', 'Bridge Complete': '브리지 완료', 'New Bridge': '새 브리지', 'Buy Credits': '크레딧 구매', 'Swap Tokens': '토큰 스왑', 'Bridge USDC to Arc': 'USDC를 Arc로 브리지', 'Try Again': '다시 시도', 'Bridging…': '브리지 진행 중…', 'Loading…': '로딩 중…',
  },
  vi: {
    Platform: 'Nền tảng', Trust: 'Tin cậy', Dashboard: 'Bảng điều khiển', 'Launch App': 'Mở ứng dụng', 'Open ARCTIS': 'Mở ARCTIS', 'Send USDC': 'Gửi USDC',
    'The Web3 Operating System': 'Hệ điều hành Web3', 'for Humans and Agents': 'cho con người và tác nhân', Overview: 'Tổng quan', Activity: 'Hoạt động', History: 'Lịch sử', 'AI Workspace': 'Không gian AI', Copilot: 'Trợ lý', Agents: 'Tác nhân', Workspace: 'Không gian làm việc', Knowledge: 'Kiến thức', Transfer: 'Chuyển', Swap: 'Hoán đổi', Bridge: 'Cầu nối', Finance: 'Tài chính', Treasury: 'Kho bạc', Credits: 'Tín dụng', Settings: 'Cài đặt', Feedback: 'Phản hồi', Admin: 'Quản trị', Search: 'Tìm kiếm', 'Wrong Network': 'Sai mạng', 'Switch Network': 'Đổi mạng', 'Switch to Arc': 'Chuyển sang Arc', 'Arc Testnet': 'Arc Testnet', From: 'Từ', To: 'Đến', 'Amount (USDC)': 'Số lượng (USDC)', Fee: 'Phí', 'Estimated time': 'Thời gian dự kiến', 'Bridge History': 'Lịch sử cầu nối', 'No bridges yet': 'Chưa có giao dịch cầu nối', 'Bridge Complete': 'Cầu nối hoàn tất', 'New Bridge': 'Cầu nối mới', 'Buy Credits': 'Mua tín dụng', 'Swap Tokens': 'Hoán đổi token', 'Bridge USDC to Arc': 'Chuyển USDC sang Arc', 'Try Again': 'Thử lại', 'Bridging…': 'Đang chuyển…', 'Loading…': 'Đang tải…',
  },
  fr: {
    Platform: 'Plateforme', Trust: 'Confiance', Dashboard: 'Tableau de bord', 'Launch App': 'Ouvrir l’app', 'Open ARCTIS': 'Ouvrir ARCTIS', 'Send USDC': 'Envoyer USDC',
    'The Web3 Operating System': 'Le système d’exploitation Web3', 'for Humans and Agents': 'pour humains et agents', Overview: 'Vue d’ensemble', Activity: 'Activité', History: 'Historique', 'AI Workspace': 'Espace IA', Copilot: 'Copilote', Agents: 'Agents', Workspace: 'Espace de travail', Knowledge: 'Connaissance', Transfer: 'Transfert', Swap: 'Échange', Bridge: 'Pont', Finance: 'Finance', Treasury: 'Trésorerie', Credits: 'Crédits', Settings: 'Paramètres', Feedback: 'Commentaires', Admin: 'Admin', Search: 'Rechercher', 'Wrong Network': 'Mauvais réseau', 'Switch Network': 'Changer de réseau', 'Switch to Arc': 'Passer à Arc', 'Arc Testnet': 'Testnet Arc', From: 'De', To: 'Vers', 'Amount (USDC)': 'Montant (USDC)', Fee: 'Frais', 'Estimated time': 'Temps estimé', 'Bridge History': 'Historique des ponts', 'No bridges yet': 'Aucun pont pour le moment', 'Bridge Complete': 'Pont terminé', 'New Bridge': 'Nouveau pont', 'Buy Credits': 'Acheter des crédits', 'Swap Tokens': 'Échanger des tokens', 'Bridge USDC to Arc': 'Bridger USDC vers Arc', 'Try Again': 'Réessayer', 'Bridging…': 'Pont en cours…', 'Loading…': 'Chargement…',
  },
  sw: {
    Platform: 'Jukwaa', Trust: 'Uaminifu', Dashboard: 'Dashibodi', 'Launch App': 'Fungua programu', 'Open ARCTIS': 'Fungua ARCTIS', 'Send USDC': 'Tuma USDC',
    'The Web3 Operating System': 'Mfumo wa uendeshaji wa Web3', 'for Humans and Agents': 'kwa watu na mawakala', Overview: 'Muhtasari', Activity: 'Shughuli', History: 'Historia', 'AI Workspace': 'Eneo la AI', Copilot: 'Copilot', Agents: 'Mawakala', Workspace: 'Eneo la kazi', Knowledge: 'Maarifa', Transfer: 'Tuma', Swap: 'Badilisha', Bridge: 'Daraja', Finance: 'Fedha', Treasury: 'Hazina', Credits: 'Mikopo', Settings: 'Mipangilio', Feedback: 'Maoni', Admin: 'Msimamizi', Search: 'Tafuta', 'Wrong Network': 'Mtandao usio sahihi', 'Switch Network': 'Badilisha mtandao', 'Switch to Arc': 'Badilisha kwenda Arc', 'Arc Testnet': 'Arc Testnet', From: 'Kutoka', To: 'Kwenda', 'Amount (USDC)': 'Kiasi (USDC)', Fee: 'Ada', 'Estimated time': 'Muda unaokadiriwa', 'Bridge History': 'Historia ya madaraja', 'No bridges yet': 'Bado hakuna madaraja', 'Bridge Complete': 'Daraja limekamilika', 'New Bridge': 'Daraja jipya', 'Buy Credits': 'Nunua mikopo', 'Swap Tokens': 'Badilisha tokeni', 'Bridge USDC to Arc': 'Hamisha USDC kwenda Arc', 'Try Again': 'Jaribu tena', 'Bridging…': 'Inahamisha…', 'Loading…': 'Inapakia…',
  },
  ar: {
    Platform: 'المنصة', Trust: 'الثقة', Dashboard: 'لوحة التحكم', 'Launch App': 'فتح التطبيق', 'Open ARCTIS': 'فتح ARCTIS', 'Send USDC': 'إرسال USDC',
    'The Web3 Operating System': 'نظام تشغيل Web3', 'for Humans and Agents': 'للبشر والوكلاء', Overview: 'نظرة عامة', Activity: 'النشاط', History: 'السجل', 'AI Workspace': 'مساحة عمل الذكاء الاصطناعي', Copilot: 'المساعد', Agents: 'الوكلاء', Workspace: 'مساحة العمل', Knowledge: 'المعرفة', Transfer: 'تحويل', Swap: 'تبديل', Bridge: 'جسر', Finance: 'التمويل', Treasury: 'الخزينة', Credits: 'الأرصدة', Settings: 'الإعدادات', Feedback: 'الملاحظات', Admin: 'الإدارة', Search: 'بحث', 'Wrong Network': 'شبكة غير صحيحة', 'Switch Network': 'تبديل الشبكة', 'Switch to Arc': 'التبديل إلى Arc', 'Arc Testnet': 'شبكة Arc التجريبية', From: 'من', To: 'إلى', 'Amount (USDC)': 'المبلغ (USDC)', Fee: 'الرسوم', 'Estimated time': 'الوقت المتوقع', 'Bridge History': 'سجل الجسور', 'No bridges yet': 'لا توجد عمليات جسر بعد', 'Bridge Complete': 'اكتمل الجسر', 'New Bridge': 'جسر جديد', 'Buy Credits': 'شراء أرصدة', 'Swap Tokens': 'تبديل الرموز', 'Bridge USDC to Arc': 'جسر USDC إلى Arc', 'Try Again': 'حاول مرة أخرى', 'Bridging…': 'جارٍ الجسر…', 'Loading…': 'جارٍ التحميل…',
  },
};

const EXTRA: Partial<Record<Locale, Record<string, string>>> = {
  hi: { 'Operating System': 'ऑपरेटिंग सिस्टम', 'Top up →': 'टॉप अप →', 'Arc Testnet · Connected': 'Arc टेस्टनेट · कनेक्टेड', 'Wrong chain': 'गलत चेन', 'Expand sidebar': 'साइडबार खोलें', 'Collapse sidebar': 'साइडबार बंद करें', 'Open navigation': 'नेविगेशन खोलें', 'Open command palette': 'कमांड पैलेट खोलें', Connected: 'कनेक्टेड', 'Select chain': 'चेन चुनें', 'Switch network to continue': 'जारी रखने के लिए नेटवर्क बदलें', 'Pre-filled from ARCTIS AI — review before bridging': 'ARCTIS AI से भरा गया — ब्रिज से पहले समीक्षा करें' },
  es: { 'Operating System': 'Sistema operativo', 'Top up →': 'Recargar →', 'Arc Testnet · Connected': 'Arc Testnet · Conectado', 'Wrong chain': 'Red incorrecta', 'Expand sidebar': 'Expandir barra lateral', 'Collapse sidebar': 'Contraer barra lateral', 'Open navigation': 'Abrir navegación', 'Open command palette': 'Abrir paleta de comandos', Connected: 'Conectado', 'Select chain': 'Seleccionar red', 'Switch network to continue': 'Cambia de red para continuar' },
  pt: { 'Operating System': 'Sistema operacional', 'Top up →': 'Adicionar →', 'Arc Testnet · Connected': 'Arc Testnet · Conectado', 'Wrong chain': 'Rede incorreta', 'Expand sidebar': 'Expandir barra lateral', 'Collapse sidebar': 'Recolher barra lateral', 'Open navigation': 'Abrir navegação', 'Open command palette': 'Abrir paleta de comandos', Connected: 'Conectado', 'Select chain': 'Selecionar rede', 'Switch network to continue': 'Troque de rede para continuar' },
  zh: { 'Operating System': '操作系统', 'Top up →': '充值 →', 'Arc Testnet · Connected': 'Arc 测试网 · 已连接', 'Wrong chain': '网络错误', 'Expand sidebar': '展开侧栏', 'Collapse sidebar': '收起侧栏', 'Open navigation': '打开导航', 'Open command palette': '打开命令面板', Connected: '已连接', 'Select chain': '选择网络', 'Switch network to continue': '切换网络后继续' },
  ko: { 'Operating System': '운영체제', 'Top up →': '충전 →', 'Arc Testnet · Connected': 'Arc 테스트넷 · 연결됨', 'Wrong chain': '잘못된 네트워크', 'Expand sidebar': '사이드바 펼치기', 'Collapse sidebar': '사이드바 접기', 'Open navigation': '내비게이션 열기', 'Open command palette': '명령 팔레트 열기', Connected: '연결됨', 'Select chain': '네트워크 선택', 'Switch network to continue': '계속하려면 네트워크를 전환하세요' },
  vi: { 'Operating System': 'Hệ điều hành', 'Top up →': 'Nạp thêm →', 'Arc Testnet · Connected': 'Arc Testnet · Đã kết nối', 'Wrong chain': 'Sai mạng', 'Expand sidebar': 'Mở rộng thanh bên', 'Collapse sidebar': 'Thu gọn thanh bên', 'Open navigation': 'Mở điều hướng', 'Open command palette': 'Mở bảng lệnh', Connected: 'Đã kết nối', 'Select chain': 'Chọn mạng', 'Switch network to continue': 'Đổi mạng để tiếp tục' },
  fr: { 'Operating System': 'Système d’exploitation', 'Top up →': 'Recharger →', 'Arc Testnet · Connected': 'Arc Testnet · Connecté', 'Wrong chain': 'Mauvais réseau', 'Expand sidebar': 'Développer la barre latérale', 'Collapse sidebar': 'Réduire la barre latérale', 'Open navigation': 'Ouvrir la navigation', 'Open command palette': 'Ouvrir la palette de commandes', Connected: 'Connecté', 'Select chain': 'Sélectionner le réseau', 'Switch network to continue': 'Changez de réseau pour continuer' },
  sw: { 'Operating System': 'Mfumo wa uendeshaji', 'Top up →': 'Ongeza →', 'Arc Testnet · Connected': 'Arc Testnet · Imeunganishwa', 'Wrong chain': 'Mtandao usio sahihi', 'Expand sidebar': 'Panua upau wa pembeni', 'Collapse sidebar': 'Kunja upau wa pembeni', 'Open navigation': 'Fungua urambazaji', 'Open command palette': 'Fungua orodha ya amri', Connected: 'Imeunganishwa', 'Select chain': 'Chagua mtandao', 'Switch network to continue': 'Badilisha mtandao ili kuendelea' },
  ar: { 'Operating System': 'نظام التشغيل', 'Top up →': 'شحن →', 'Arc Testnet · Connected': 'شبكة Arc التجريبية · متصل', 'Wrong chain': 'شبكة غير صحيحة', 'Expand sidebar': 'توسيع الشريط الجانبي', 'Collapse sidebar': 'طي الشريط الجانبي', 'Open navigation': 'فتح التنقل', 'Open command palette': 'فتح لوحة الأوامر', Connected: 'متصل', 'Select chain': 'اختر الشبكة', 'Switch network to continue': 'بدّل الشبكة للمتابعة' },
};
for (const lang of Object.keys(EXTRA) as Locale[]) Object.assign(DICT[lang], EXTRA[lang] ?? {});

const context = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string }>({
  locale: 'en', setLocale: () => {}, t: (key) => key,
});

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem('arctis-locale', next); } catch { /* ignore */ }
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    window.dispatchEvent(new CustomEvent('arctis-locale-change', { detail: next }));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('arctis-locale') as Locale | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) setLocale(saved);
      else { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; }
    } catch { /* ignore */ }
  }, [setLocale]);

  const t = useCallback((key: string) => DICT[locale][key] ?? key, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <context.Provider value={value}><I18nTextLayer locale={locale}>{children}</I18nTextLayer></context.Provider>;
}

const ORIGINAL_TEXT = new WeakMap<Text, string>();

function I18nTextLayer({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    const restoreTree = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node as Text;
        const source = ORIGINAL_TEXT.get(text);
        if (source !== undefined) text.nodeValue = source;
      }
    };

    if (locale === 'en') {
      restoreTree(document.body);
      return;
    }
    const translateTree = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node as Text;
        if (!ORIGINAL_TEXT.has(text)) ORIGINAL_TEXT.set(text, text.nodeValue ?? '');
        const source = normalize(ORIGINAL_TEXT.get(text) ?? '');
        if (!source) continue;
        const translated = DICT[locale][source];
        if (translated && text.nodeValue !== translated) text.nodeValue = translated;
      }
    };
    translateTree(document.body);
    const observer = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => translateTree(n))));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);
  return <>{children}</>;
}

export function useI18n() { return useContext(context); }
export function translationsFor(locale: Locale) { return DICT[locale]; }
