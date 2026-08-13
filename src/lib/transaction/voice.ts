export type TransactionVoiceLocale = 'en' | 'hi' | 'es' | 'pt' | 'zh' | 'ko' | 'vi' | 'fr' | 'sw' | 'ar';

const VOICE_LOCALE: Record<TransactionVoiceLocale, string> = {
  en: 'en-US', hi: 'hi-IN', es: 'es-ES', pt: 'pt-PT', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', fr: 'fr-FR', sw: 'sw-KE', ar: 'ar-SA',
};

const COPY: Record<TransactionVoiceLocale, Record<string, string>> = {
  en: { processing: 'Transaction processing.', submitted: 'Transaction submitted.', success: 'Transaction confirmed successfully.', failed: 'Transaction failed.', network: 'Please switch to the required network.', switching: 'Switching network.' },
  hi: { processing: 'लेन-देन प्रक्रिया में है।', submitted: 'लेन-देन भेज दिया गया है।', success: 'लेन-देन सफलतापूर्वक पुष्टि हो गया है।', failed: 'लेन-देन विफल हुआ।', network: 'कृपया आवश्यक नेटवर्क पर जाएँ।', switching: 'नेटवर्क बदला जा रहा है।' },
  es: { processing: 'La transacción está procesándose.', submitted: 'La transacción ha sido enviada.', success: 'La transacción se confirmó correctamente.', failed: 'La transacción falló.', network: 'Cambia a la red requerida.', switching: 'Cambiando de red.' },
  pt: { processing: 'A transação está sendo processada.', submitted: 'A transação foi enviada.', success: 'A transação foi confirmada com sucesso.', failed: 'A transação falhou.', network: 'Mude para a rede necessária.', switching: 'Trocando de rede.' },
  zh: { processing: '交易正在处理中。', submitted: '交易已提交。', success: '交易已成功确认。', failed: '交易失败。', network: '请切换到所需网络。', switching: '正在切换网络。' },
  ko: { processing: '거래를 처리하고 있습니다.', submitted: '거래가 제출되었습니다.', success: '거래가 성공적으로 확인되었습니다.', failed: '거래에 실패했습니다.', network: '필요한 네트워크로 전환하세요.', switching: '네트워크를 전환하고 있습니다.' },
  vi: { processing: 'Giao dịch đang được xử lý.', submitted: 'Giao dịch đã được gửi.', success: 'Giao dịch đã được xác nhận thành công.', failed: 'Giao dịch thất bại.', network: 'Hãy chuyển sang mạng cần thiết.', switching: 'Đang chuyển mạng.' },
  fr: { processing: 'La transaction est en cours de traitement.', submitted: 'La transaction a été envoyée.', success: 'La transaction a été confirmée avec succès.', failed: 'La transaction a échoué.', network: 'Passez au réseau requis.', switching: 'Changement de réseau en cours.' },
  sw: { processing: 'Muamala unashughulikiwa.', submitted: 'Muamala umetumwa.', success: 'Muamala umethibitishwa kwa mafanikio.', failed: 'Muamala umeshindwa.', network: 'Tafadhali badilisha hadi mtandao unaohitajika.', switching: 'Inabadilisha mtandao.' },
  ar: { processing: 'جارٍ معالجة المعاملة.', submitted: 'تم إرسال المعاملة.', success: 'تم تأكيد المعاملة بنجاح.', failed: 'فشلت المعاملة.', network: 'يرجى التبديل إلى الشبكة المطلوبة.', switching: 'جارٍ تبديل الشبكة.' },
};

function resolveLocale(): TransactionVoiceLocale {
  if (typeof window === 'undefined') return 'en';
  const value = localStorage.getItem('arctis-locale') || document.documentElement.lang || 'en';
  const code = value.split('-')[0] as TransactionVoiceLocale;
  return COPY[code] ? code : 'en';
}

export function announceTransactionState(state: keyof typeof COPY.en): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const locale = resolveLocale();
  const text = COPY[locale][state];
  if (!text) return;
  const key = `${locale}:${state}`;
  const w = window as Window & { __arctisLastTransactionVoice?: string };
  if (w.__arctisLastTransactionVoice === key) return;
  w.__arctisLastTransactionVoice = key;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LOCALE[locale];
  utterance.rate = 0.95;
  utterance.volume = 1;
  const speak = () => {
    const voices = window.speechSynthesis.getVoices();
    const prefix = VOICE_LOCALE[locale].toLowerCase();
    const match = voices.find((v) => v.lang.toLowerCase() === prefix) || voices.find((v) => v.lang.toLowerCase().startsWith(prefix.split('-')[0]));
    if (match) utterance.voice = match;
    window.speechSynthesis.speak(utterance);
  };
  if (window.speechSynthesis.getVoices().length) speak(); else window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
}
