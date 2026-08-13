'use client';

export type TransactionVoiceState =
  | 'network_required' | 'switching_network' | 'network_switched'
  | 'preflight' | 'wallet_approval' | 'submitted' | 'processing'
  | 'pending' | 'confirmed' | 'failed' | 'unknown';

export type TransactionVoiceLocale = 'en'|'hi'|'es'|'pt'|'zh'|'ko'|'vi'|'fr'|'sw'|'ar';

const VOICE_LOCALE: Record<TransactionVoiceLocale,string> = {
  en:'en-US',hi:'hi-IN',es:'es-ES',pt:'pt-PT',zh:'zh-CN',ko:'ko-KR',vi:'vi-VN',fr:'fr-FR',sw:'sw-KE',ar:'ar-SA',
};

const COPY: Record<TransactionVoiceLocale,Record<TransactionVoiceState,string>> = {
  en:{network_required:'Please switch to the required network.',switching_network:'Switching network.',network_switched:'The required network is now active.',preflight:'Checking balances, route and transaction requirements.',wallet_approval:'Please approve the transaction in your wallet.',submitted:'Your transaction has been submitted. Waiting for blockchain confirmation.',processing:'Your transaction is processing.',pending:'Your transaction is pending blockchain confirmation.',confirmed:'Your transaction has been confirmed successfully.',failed:'Your transaction failed. Check the transaction details for the exact cause.',unknown:'The exact transaction status is unavailable. Check transaction details.'},
  hi:{network_required:'कृपया आवश्यक नेटवर्क पर जाएँ।',switching_network:'नेटवर्क बदला जा रहा है।',network_switched:'आवश्यक नेटवर्क अब सक्रिय है।',preflight:'बैलेंस, रूट और ट्रांज़ैक्शन आवश्यकताओं की जाँच हो रही है।',wallet_approval:'कृपया अपने वॉलेट में ट्रांज़ैक्शन को मंज़ूर करें।',submitted:'आपका ट्रांज़ैक्शन सबमिट हो गया है। ब्लॉकचेन कन्फर्मेशन का इंतज़ार हो रहा है।',processing:'आपका ट्रांज़ैक्शन प्रक्रिया में है।',pending:'आपका ट्रांज़ैक्शन ब्लॉकचेन कन्फर्मेशन के लिए लंबित है।',confirmed:'आपका ट्रांज़ैक्शन सफलतापूर्वक कन्फर्म हो गया है।',failed:'ट्रांज़ैक्शन विफल हुआ। सही कारण के लिए ट्रांज़ैक्शन विवरण देखें।',unknown:'ट्रांज़ैक्शन की सही स्थिति उपलब्ध नहीं है। विवरण देखें।'},
  es:{network_required:'Cambia a la red requerida.',switching_network:'Cambiando de red.',network_switched:'La red requerida está activa.',preflight:'Comprobando saldos, ruta y requisitos de la transacción.',wallet_approval:'Aprueba la transacción en tu billetera.',submitted:'La transacción ha sido enviada. Esperando la confirmación de la cadena de bloques.',processing:'La transacción está procesándose.',pending:'La transacción está pendiente de confirmación.',confirmed:'La transacción se confirmó correctamente.',failed:'La transacción falló. Consulta los detalles para conocer la causa exacta.',unknown:'El estado exacto no está disponible. Consulta los detalles.'},
  pt:{network_required:'Mude para a rede necessária.',switching_network:'Trocando de rede.',network_switched:'A rede necessária está ativa.',preflight:'Verificando saldos, rota e requisitos da transação.',wallet_approval:'Aprove a transação na sua carteira.',submitted:'A transação foi enviada. Aguardando confirmação da blockchain.',processing:'A transação está sendo processada.',pending:'A transação está aguardando confirmação.',confirmed:'A transação foi confirmada com sucesso.',failed:'A transação falhou. Consulte os detalhes para saber a causa exata.',unknown:'O status exato não está disponível. Consulte os detalhes.'},
  zh:{network_required:'请切换到所需网络。',switching_network:'正在切换网络。',network_switched:'所需网络现在已启用。',preflight:'正在检查余额、路由和交易要求。',wallet_approval:'请在钱包中批准交易。',submitted:'交易已提交，正在等待区块链确认。',processing:'交易正在处理中。',pending:'交易正在等待区块链确认。',confirmed:'交易已成功确认。',failed:'交易失败。请查看交易详情了解确切原因。',unknown:'无法获取确切交易状态，请查看交易详情。'},
  ko:{network_required:'필요한 네트워크로 전환하세요.',switching_network:'네트워크를 전환하고 있습니다.',network_switched:'필요한 네트워크가 활성화되었습니다.',preflight:'잔액, 경로 및 거래 요구사항을 확인하고 있습니다.',wallet_approval:'지갑에서 거래를 승인하세요.',submitted:'거래가 제출되었습니다. 블록체인 확인을 기다리고 있습니다.',processing:'거래를 처리하고 있습니다.',pending:'거래가 블록체인 확인을 기다리고 있습니다.',confirmed:'거래가 성공적으로 확인되었습니다.',failed:'거래에 실패했습니다. 정확한 원인은 거래 세부정보를 확인하세요.',unknown:'정확한 거래 상태를 확인할 수 없습니다. 거래 세부정보를 확인하세요.'},
  vi:{network_required:'Hãy chuyển sang mạng cần thiết.',switching_network:'Đang chuyển mạng.',network_switched:'Mạng cần thiết hiện đã hoạt động.',preflight:'Đang kiểm tra số dư, tuyến và yêu cầu giao dịch.',wallet_approval:'Hãy phê duyệt giao dịch trong ví của bạn.',submitted:'Giao dịch đã được gửi. Đang chờ blockchain xác nhận.',processing:'Giao dịch đang được xử lý.',pending:'Giao dịch đang chờ blockchain xác nhận.',confirmed:'Giao dịch đã được xác nhận thành công.',failed:'Giao dịch thất bại. Hãy xem chi tiết giao dịch để biết nguyên nhân chính xác.',unknown:'Không thể xác định trạng thái chính xác. Hãy xem chi tiết giao dịch.'},
  fr:{network_required:'Passez au réseau requis.',switching_network:'Changement de réseau en cours.',network_switched:'Le réseau requis est maintenant actif.',preflight:'Vérification des soldes, de la route et des exigences de transaction.',wallet_approval:'Approuvez la transaction dans votre portefeuille.',submitted:'La transaction a été envoyée. En attente de confirmation de la blockchain.',processing:'La transaction est en cours de traitement.',pending:'La transaction est en attente de confirmation.',confirmed:'La transaction a été confirmée avec succès.',failed:'La transaction a échoué. Consultez les détails pour connaître la cause exacte.',unknown:'Le statut exact est indisponible. Consultez les détails de la transaction.'},
  sw:{network_required:'Tafadhali badilisha hadi mtandao unaohitajika.',switching_network:'Inabadilisha mtandao.',network_switched:'Mtandao unaohitajika sasa umeamilishwa.',preflight:'Inakagua salio, njia na mahitaji ya muamala.',wallet_approval:'Tafadhali thibitisha muamala kwenye pochi yako.',submitted:'Muamala umetumwa. Inasubiri uthibitisho wa blockchain.',processing:'Muamala unashughulikiwa.',pending:'Muamala unasubiri uthibitisho wa blockchain.',confirmed:'Muamala umethibitishwa kwa mafanikio.',failed:'Muamala umeshindwa. Angalia maelezo ya muamala kwa sababu halisi.',unknown:'Hali halisi ya muamala haipatikani. Angalia maelezo.'},
  ar:{network_required:'يرجى التبديل إلى الشبكة المطلوبة.',switching_network:'جارٍ تبديل الشبكة.',network_switched:'الشبكة المطلوبة نشطة الآن.',preflight:'جارٍ فحص الرصيد والمسار ومتطلبات المعاملة.',wallet_approval:'يرجى الموافقة على المعاملة في محفظتك.',submitted:'تم إرسال المعاملة. جارٍ انتظار تأكيد البلوكشين.',processing:'جارٍ معالجة المعاملة.',pending:'المعاملة معلقة بانتظار تأكيد البلوكشين.',confirmed:'تم تأكيد المعاملة بنجاح.',failed:'فشلت المعاملة. راجع تفاصيل المعاملة لمعرفة السبب الدقيق.',unknown:'حالة المعاملة الدقيقة غير متاحة. راجع التفاصيل.'},
};

function getLocale(): TransactionVoiceLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('arctis:preferences:v1');
  try { const value = stored ? JSON.parse(stored).language : undefined; const code = String(value || document.documentElement.lang || 'en').split('-')[0] as TransactionVoiceLocale; return COPY[code] ? code : 'en'; } catch { return 'en'; }
}

export function announceTransactionState(state: TransactionVoiceState): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  try {
    const prefs = localStorage.getItem('arctis:preferences:v1');
    if (prefs && JSON.parse(prefs).voiceEnabled === false) return;
  } catch {}
  const locale = getLocale();
  const key = `${locale}:${state}`;
  const target = window as Window & { __arctisVoiceKey?: string };
  if (target.__arctisVoiceKey === key) return;
  target.__arctisVoiceKey = key;
  const utterance = new SpeechSynthesisUtterance(COPY[locale][state]);
  utterance.lang = VOICE_LOCALE[locale];
  utterance.rate = 0.95;
  const speak = () => {
    try {
      const voices = window.speechSynthesis.getVoices();
      const exact = voices.find((voice) => voice.lang.toLowerCase() === VOICE_LOCALE[locale].toLowerCase());
      const prefix = voices.find((voice) => voice.lang.toLowerCase().startsWith(`${locale}-`));
      if (exact || prefix) utterance.voice = exact || prefix || null;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {}
  };
  if (window.speechSynthesis.getVoices().length) speak();
  else window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
}
