'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, Volume2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useI18n, type Locale } from '@/lib/i18n';

type GuideCopy = { title: string; text: string; listen: string };

const GUIDE: Record<string, Record<Locale, GuideCopy>> = {
  '/': {
    en: { title: 'Welcome to ARCTIS', text: 'ARCTIS combines stablecoin-native DeFi, payments and an agentic economy on Arc. Connect your wallet, choose an action, review the details, then authorize in your wallet.', listen: 'Listen' },
    hi: { title: 'ARCTIS में आपका स्वागत है', text: 'ARCTIS Arc पर stablecoin-native DeFi, payments और agentic economy को एक साथ लाता है। अपना wallet connect करें, action चुनें, details review करें और फिर wallet में authorize करें।', listen: 'सुनें' },
    es: { title: 'Bienvenido a ARCTIS', text: 'ARCTIS combina DeFi nativo de stablecoins, pagos y una economía de agentes en Arc. Conecta tu wallet, elige una acción, revisa los detalles y autoriza en tu wallet.', listen: 'Escuchar' },
    pt: { title: 'Bem-vindo ao ARCTIS', text: 'ARCTIS combina DeFi nativo de stablecoins, pagamentos e uma economia de agentes na Arc. Conecte sua carteira, escolha uma ação, revise os detalhes e autorize na sua carteira.', listen: 'Ouvir' },
    zh: { title: '欢迎使用 ARCTIS', text: 'ARCTIS 将基于稳定币的 DeFi、支付和 Arc 上的代理经济结合在一起。连接钱包，选择操作，检查详情，然后在钱包中授权。', listen: '收听' },
    ko: { title: 'ARCTIS에 오신 것을 환영합니다', text: 'ARCTIS는 Arc에서 스테이블코인 기반 DeFi, 결제 및 에이전트 경제를 결합합니다. 지갑을 연결하고 작업을 선택한 뒤 내용을 검토하고 지갑에서 승인하세요.', listen: '듣기' },
    vi: { title: 'Chào mừng đến với ARCTIS', text: 'ARCTIS kết hợp DeFi dựa trên stablecoin, thanh toán và nền kinh tế tác nhân trên Arc. Kết nối ví, chọn hành động, xem lại chi tiết rồi xác nhận trong ví.', listen: 'Nghe' },
    fr: { title: 'Bienvenue sur ARCTIS', text: 'ARCTIS réunit la DeFi basée sur les stablecoins, les paiements et une économie d’agents sur Arc. Connectez votre portefeuille, choisissez une action, vérifiez les détails puis autorisez-la dans votre portefeuille.', listen: 'Écouter' },
    sw: { title: 'Karibu ARCTIS', text: 'ARCTIS inaunganisha DeFi ya stablecoin, malipo na uchumi wa mawakala kwenye Arc. Unganisha pochi yako, chagua hatua, kagua maelezo kisha idhinisha kwenye pochi yako.', listen: 'Sikiliza' },
    ar: { title: 'مرحبًا بك في ARCTIS', text: 'يجمع ARCTIS بين التمويل اللامركزي القائم على العملات المستقرة والمدفوعات واقتصاد الوكلاء على Arc. اربط محفظتك، اختر إجراءً، راجع التفاصيل ثم وافق من محفظتك.', listen: 'استمع' },
  },
  '/dashboard': {
    en: { title: 'Dashboard', text: 'Your dashboard is the control center. Review balances and activity, then open Transfer, Swap, Bridge or Agents for an action.', listen: 'Listen' },
    hi: { title: 'डैशबोर्ड', text: 'आपका डैशबोर्ड control center है। balances और activity देखें, फिर किसी action के लिए Transfer, Swap, Bridge या Agents खोलें।', listen: 'सुनें' },
    es: { title: 'Panel', text: 'Tu panel es el centro de control. Revisa saldos y actividad, y abre Transferir, Intercambiar, Puente o Agentes para realizar una acción.', listen: 'Escuchar' },
    pt: { title: 'Painel', text: 'Seu painel é o centro de controle. Revise saldos e atividades e abra Transferir, Trocar, Ponte ou Agentes para realizar uma ação.', listen: 'Ouvir' },
    zh: { title: '仪表板', text: '仪表板是控制中心。查看余额和活动，然后打开转账、兑换、跨链或代理来执行操作。', listen: '收听' },
    ko: { title: '대시보드', text: '대시보드는 제어 센터입니다. 잔액과 활동을 확인한 다음 전송, 스왑, 브리지 또는 에이전트를 열어 작업을 수행하세요.', listen: '듣기' },
    vi: { title: 'Bảng điều khiển', text: 'Bảng điều khiển là trung tâm kiểm soát. Xem số dư và hoạt động, sau đó mở Chuyển, Hoán đổi, Cầu nối hoặc Tác nhân để thực hiện hành động.', listen: 'Nghe' },
    fr: { title: 'Tableau de bord', text: 'Votre tableau de bord est le centre de contrôle. Consultez les soldes et l’activité, puis ouvrez Transfert, Échange, Pont ou Agents pour agir.', listen: 'Écouter' },
    sw: { title: 'Dashibodi', text: 'Dashibodi yako ni kituo cha udhibiti. Kagua salio na shughuli, kisha fungua Hamisha, Badilisha, Daraja au Mawakala kwa hatua.', listen: 'Sikiliza' },
    ar: { title: 'لوحة التحكم', text: 'لوحة التحكم هي مركز التحكم. راجع الأرصدة والنشاط، ثم افتح التحويل أو التبديل أو الجسر أو الوكلاء لتنفيذ إجراء.', listen: 'استمع' },
  },
  '/transfer': {
    en: { title: 'Transfer', text: 'Enter a recipient and USDC amount. Review the destination and network, then confirm in your wallet. A blockchain confirmation is the final success signal.', listen: 'Listen' },
    hi: { title: 'ट्रांसफ़र', text: 'recipient और USDC amount डालें। destination और network review करें, फिर wallet में confirm करें। blockchain confirmation ही final success signal है।', listen: 'सुनें' },
    es: { title: 'Transferir', text: 'Introduce un destinatario y una cantidad de USDC. Revisa el destino y la red, y confirma en tu wallet. La confirmación en blockchain es la señal final de éxito.', listen: 'Escuchar' },
    pt: { title: 'Transferir', text: 'Insira um destinatário e um valor em USDC. Revise o destino e a rede e confirme na sua carteira. A confirmação na blockchain é o sinal final de sucesso.', listen: 'Ouvir' },
    zh: { title: '转账', text: '输入收款人和 USDC 金额。检查目标地址和网络，然后在钱包中确认。区块链确认是最终成功信号。', listen: '收听' },
    ko: { title: '전송', text: '수신자와 USDC 금액을 입력하세요. 목적지와 네트워크를 확인한 후 지갑에서 승인하세요. 블록체인 확인이 최종 성공 신호입니다.', listen: '듣기' },
    vi: { title: 'Chuyển', text: 'Nhập người nhận và số USDC. Kiểm tra đích và mạng, sau đó xác nhận trong ví. Xác nhận trên blockchain là tín hiệu thành công cuối cùng.', listen: 'Nghe' },
    fr: { title: 'Transfert', text: 'Saisissez un destinataire et un montant en USDC. Vérifiez la destination et le réseau, puis confirmez dans votre portefeuille. La confirmation blockchain est le signal final de réussite.', listen: 'Écouter' },
    sw: { title: 'Hamisha', text: 'Weka mpokeaji na kiasi cha USDC. Kagua anwani ya mwisho na mtandao, kisha thibitisha kwenye pochi yako. Uthibitisho wa blockchain ndio ishara ya mwisho ya mafanikio.', listen: 'Sikiliza' },
    ar: { title: 'تحويل', text: 'أدخل المستلم ومبلغ USDC. راجع الوجهة والشبكة ثم أكد من محفظتك. تأكيد المعاملة على البلوك تشين هو إشارة النجاح النهائية.', listen: 'استمع' },
  },
  '/swap': {
    en: { title: 'Swap', text: 'Choose the supported token pair and amount. Review the quoted route and settlement details, then authorize the transaction in your wallet.', listen: 'Listen' },
    hi: { title: 'स्वैप', text: 'supported token pair और amount चुनें। quoted route और settlement details review करें, फिर wallet में transaction authorize करें।', listen: 'सुनें' },
    es: { title: 'Intercambiar', text: 'Elige el par de tokens compatible y la cantidad. Revisa la ruta cotizada y los detalles de liquidación, y autoriza la transacción en tu wallet.', listen: 'Escuchar' },
    pt: { title: 'Trocar', text: 'Escolha o par de tokens compatível e o valor. Revise a rota cotada e os detalhes de liquidação e autorize a transação na sua carteira.', listen: 'Ouvir' },
    zh: { title: '兑换', text: '选择支持的代币对和金额。检查报价路线和结算详情，然后在钱包中授权交易。', listen: '收听' },
    ko: { title: '스왑', text: '지원되는 토큰 쌍과 금액을 선택하세요. 견적 경로와 결제 세부 정보를 확인한 뒤 지갑에서 거래를 승인하세요.', listen: '듣기' },
    vi: { title: 'Hoán đổi', text: 'Chọn cặp token và số lượng được hỗ trợ. Xem lại tuyến báo giá và chi tiết thanh toán rồi xác nhận giao dịch trong ví.', listen: 'Nghe' },
    fr: { title: 'Échange', text: 'Choisissez la paire de tokens et le montant pris en charge. Vérifiez la route cotée et les détails de règlement, puis autorisez la transaction dans votre portefeuille.', listen: 'Écouter' },
    sw: { title: 'Badilisha', text: 'Chagua jozi ya tokeni na kiasi kinachotumika. Kagua njia ya bei na maelezo ya malipo, kisha idhinisha muamala kwenye pochi yako.', listen: 'Sikiliza' },
    ar: { title: 'تبديل', text: 'اختر زوج الرموز المدعوم والمبلغ. راجع المسار المسعّر وتفاصيل التسوية ثم وافق على المعاملة من محفظتك.', listen: 'استمع' },
  },
  '/bridge': {
    en: { title: 'Bridge', text: 'Select the supported source and destination flow. Review the amount and network before authorizing. Bridge status should be treated as pending until verified.', listen: 'Listen' },
    hi: { title: 'ब्रिज', text: 'supported source और destination flow चुनें। authorize करने से पहले amount और network review करें। verified होने तक bridge status को pending मानें।', listen: 'सुनें' },
    es: { title: 'Puente', text: 'Selecciona el flujo de origen y destino compatible. Revisa la cantidad y la red antes de autorizar. El estado del puente debe considerarse pendiente hasta que se verifique.', listen: 'Escuchar' },
    pt: { title: 'Ponte', text: 'Selecione o fluxo de origem e destino compatível. Revise o valor e a rede antes de autorizar. O status da ponte deve ser considerado pendente até ser verificado.', listen: 'Ouvir' },
    zh: { title: '跨链', text: '选择支持的源和目标流程。授权前检查金额和网络。跨链状态在验证完成前应视为处理中。', listen: '收听' },
    ko: { title: '브리지', text: '지원되는 출발지와 목적지 흐름을 선택하세요. 승인하기 전에 금액과 네트워크를 확인하세요. 검증될 때까지 브리지 상태는 대기 중으로 표시됩니다.', listen: '듣기' },
    vi: { title: 'Cầu nối', text: 'Chọn luồng nguồn và đích được hỗ trợ. Kiểm tra số tiền và mạng trước khi xác nhận. Trạng thái cầu nối vẫn là đang chờ cho đến khi được xác minh.', listen: 'Nghe' },
    fr: { title: 'Pont', text: 'Sélectionnez le flux source et destination pris en charge. Vérifiez le montant et le réseau avant d’autoriser. Le pont reste en attente jusqu’à sa vérification.', listen: 'Écouter' },
    sw: { title: 'Daraja', text: 'Chagua mtiririko wa chanzo na lengwa unaotumika. Kagua kiasi na mtandao kabla ya kuidhinisha. Hali ya daraja inapaswa kubaki ikisubiri hadi ithibitishwe.', listen: 'Sikiliza' },
    ar: { title: 'جسر', text: 'اختر مسار المصدر والوجهة المدعوم. راجع المبلغ والشبكة قبل الموافقة. يجب اعتبار حالة الجسر معلقة حتى يتم التحقق منها.', listen: 'استمع' },
  },
  '/agents': {
    en: { title: 'Agents', text: 'Agents can reason and prepare economic actions, but the wallet approval remains the authorization boundary. Review every proposal before signing.', listen: 'Listen' },
    hi: { title: 'एजेंट्स', text: 'Agents economic actions को समझ और तैयार कर सकते हैं, लेकिन wallet approval ही authorization boundary है। signing से पहले हर proposal review करें।', listen: 'सुनें' },
    es: { title: 'Agentes', text: 'Los agentes pueden razonar y preparar acciones económicas, pero la aprobación de la wallet sigue siendo el límite de autorización. Revisa cada propuesta antes de firmar.', listen: 'Escuchar' },
    pt: { title: 'Agentes', text: 'Os agentes podem raciocinar e preparar ações econômicas, mas a aprovação da carteira continua sendo o limite de autorização. Revise cada proposta antes de assinar.', listen: 'Ouvir' },
    zh: { title: '代理', text: '代理可以分析并准备经济操作，但钱包授权仍是最终授权边界。签名之前请检查每个提案。', listen: '收听' },
    ko: { title: '에이전트', text: '에이전트는 경제적 작업을 분석하고 준비할 수 있지만 지갑 승인이 최종 권한 경계입니다. 서명하기 전에 모든 제안을 검토하세요.', listen: '듣기' },
    vi: { title: 'Tác nhân', text: 'Tác nhân có thể phân tích và chuẩn bị hành động kinh tế, nhưng phê duyệt ví vẫn là ranh giới cấp quyền. Hãy xem lại mọi đề xuất trước khi ký.', listen: 'Nghe' },
    fr: { title: 'Agents', text: 'Les agents peuvent raisonner et préparer des actions économiques, mais l’approbation du portefeuille reste la limite d’autorisation. Vérifiez chaque proposition avant de signer.', listen: 'Écouter' },
    sw: { title: 'Mawakala', text: 'Mawakala wanaweza kufikiri na kuandaa hatua za kiuchumi, lakini idhini ya pochi bado ni mpaka wa uidhinishaji. Kagua kila pendekezo kabla ya kusaini.', listen: 'Sikiliza' },
    ar: { title: 'الوكلاء', text: 'يمكن للوكلاء تحليل الإجراءات الاقتصادية وإعدادها، لكن موافقة المحفظة تظل حد التفويض. راجع كل اقتراح قبل التوقيع.', listen: 'استمع' },
  },
};

const FALLBACK: Record<Locale, GuideCopy> = {
  en: { title: 'ARCTIS Help', text: 'Use the navigation to explore ARCTIS. Financial actions always require review and wallet authorization.', listen: 'Listen' },
  hi: { title: 'ARCTIS सहायता', text: 'ARCTIS को explore करने के लिए navigation का उपयोग करें। Financial actions के लिए हमेशा review और wallet authorization जरूरी है।', listen: 'सुनें' },
  es: { title: 'Ayuda de ARCTIS', text: 'Usa la navegación para explorar ARCTIS. Las acciones financieras siempre requieren revisión y autorización de la wallet.', listen: 'Escuchar' },
  pt: { title: 'Ajuda do ARCTIS', text: 'Use a navegação para explorar o ARCTIS. Ações financeiras sempre exigem revisão e autorização da carteira.', listen: 'Ouvir' },
  zh: { title: 'ARCTIS 帮助', text: '使用导航探索 ARCTIS。金融操作始终需要检查和钱包授权。', listen: '收听' },
  ko: { title: 'ARCTIS 도움말', text: '탐색 메뉴를 사용해 ARCTIS를 살펴보세요. 금융 작업에는 항상 검토와 지갑 승인이 필요합니다.', listen: '듣기' },
  vi: { title: 'Trợ giúp ARCTIS', text: 'Sử dụng điều hướng để khám phá ARCTIS. Các hành động tài chính luôn cần xem xét và xác nhận bằng ví.', listen: 'Nghe' },
  fr: { title: 'Aide ARCTIS', text: 'Utilisez la navigation pour explorer ARCTIS. Les actions financières nécessitent toujours une vérification et une autorisation du portefeuille.', listen: 'Écouter' },
  sw: { title: 'Msaada wa ARCTIS', text: 'Tumia urambazaji kuchunguza ARCTIS. Hatua za kifedha daima zinahitaji ukaguzi na idhini ya pochi.', listen: 'Sikiliza' },
  ar: { title: 'مساعدة ARCTIS', text: 'استخدم التنقل لاستكشاف ARCTIS. الإجراءات المالية تتطلب دائمًا المراجعة وموافقة المحفظة.', listen: 'استمع' },
};

const SPEECH_LANG: Record<Locale, string> = {
  en: 'en-US', hi: 'hi-IN', es: 'es-ES', pt: 'pt-BR', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', fr: 'fr-FR', sw: 'sw-KE', ar: 'ar-SA',
};

export default function HelpGuide() {
  const pathname = usePathname() || '/';
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => GUIDE[pathname]?.[locale] ?? FALLBACK[locale], [pathname, locale]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [locale]);

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${guide.title}. ${guide.text}`);
    const target = SPEECH_LANG[locale];
    utterance.lang = target;
    const voices = window.speechSynthesis.getVoices();
    const exact = voices.find((voice) => voice.lang.toLowerCase() === target.toLowerCase());
    const base = target.split('-')[0].toLowerCase();
    const regional = voices.find((voice) => voice.lang.toLowerCase().split('-')[0] === base);
    if (exact || regional) utterance.voice = exact ?? regional ?? null;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && (
        <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/[0.08] bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-surface-900/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-surface-950 dark:text-white">{guide.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-surface-600 dark:text-surface-300">{guide.text}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="rounded-lg p-1 text-surface-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={speak} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Volume2 className="h-4 w-4" /> {guide.listen}
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="How to use this page" aria-expanded={open} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-surface-700 shadow-xl backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/[0.1] dark:bg-surface-900/90 dark:text-surface-200">
        <CircleHelp className="h-5 w-5" />
      </button>
    </div>
  );
}
