'use client';
import { X, CheckCircle2, AlertCircle, Clock3, ExternalLink, RotateCcw, Loader2 } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
export type ConfirmationStatus='pending'|'confirmed'|'failed';
export interface TransactionConfirmationData { status:ConfirmationStatus; title?:string; amount?:string; route?:string; network?:string; txHash?:string; explorerUrl?:string; detail?:string; }
export function TransactionConfirmationModal({open,data,onClose,onNew}:{open:boolean;data:TransactionConfirmationData|null;onClose:()=>void;onNew?:()=>void}){
 if(!open||!data)return null;
 const status=data.status;
 const Icon=status==='confirmed'?CheckCircle2:status==='failed'?AlertCircle:Clock3;
 const iconClass=status==='confirmed'?'text-emerald-600':status==='failed'?'text-rose-600':'text-amber-600';
 return <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Transaction confirmation">
  <button aria-label="Close confirmation" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm"/>
  <div className="relative w-full max-w-md rounded-3xl bg-surface-0 border border-black/[.08] dark:border-white/[.08] shadow-2xl p-6 sm:p-7">
   <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 btn-ghost p-2"><X className="w-4 h-4"/></button>
   <div className="text-center pt-2">
    <div className={`w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4 ${status==='pending'?'animate-pulse':''}`}>
      {status==='pending'?<Loader2 className="w-8 h-8 text-amber-600 animate-spin"/>:<Icon className={`w-8 h-8 ${iconClass}`}/>} 
    </div>
    <h2 className="text-xl font-bold text-surface-950">{data.title??(status==='confirmed'?'Transaction Confirmed':status==='failed'?'Transaction Failed':'Transaction Processing')}</h2>
    <p className="text-sm text-surface-600 mt-1">{data.detail??(status==='confirmed'?'Verified on-chain':status==='failed'?'No further action was taken automatically.':'Transaction submitted. Waiting for blockchain confirmation…')}</p>
   </div>
   <div className="mt-5 rounded-2xl bg-surface-100/70 p-4 space-y-3 text-sm">
    <div className="flex justify-between gap-4"><span className="text-surface-600">Amount</span><span className="font-mono font-semibold text-surface-950">{data.amount??'—'}</span></div>
    {data.route&&<div className="flex justify-between gap-4"><span className="text-surface-600">Route</span><span className="text-right text-surface-950">{data.route}</span></div>}
    {data.network&&<div className="flex justify-between gap-4"><span className="text-surface-600">Network</span><span className="text-surface-950">{data.network}</span></div>}
    {data.txHash&&<div><p className="text-xs text-surface-600 mb-1">Transaction hash</p><p className="font-mono text-xs text-surface-950 break-all">{formatAddress(data.txHash,10)}</p></div>}
   </div>
   <div className="mt-5 flex gap-2">{data.explorerUrl&&<a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost flex-1 justify-center">View transaction <ExternalLink className="w-4 h-4"/></a>}<button onClick={onClose} className="btn-primary flex-1 justify-center"><X className="w-4 h-4"/> {status==='pending'?'Hide':'Close'}</button></div>
   {onNew&&status!=='pending'&&<button onClick={onNew} className="btn-ghost w-full justify-center mt-2"><RotateCcw className="w-4 h-4"/> New Transaction</button>}
  </div>
 </div>;
}
