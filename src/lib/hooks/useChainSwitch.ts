'use client';
import { useCallback } from 'react';
import { useAccount,useSwitchChain } from 'wagmi';
import { CHAIN_ID } from '@/lib/contracts';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';
declare global{interface Window{ethereum?:{request(args:{method:string}):Promise<unknown>}}}
export function useChainSwitch(){const{chainId}=useAccount();const{switchChainAsync,isPending}=useSwitchChain();const isCorrectChain=chainId===CHAIN_ID;const switchToArc=useCallback(async()=>{if(isCorrectChain)return true;announceTransactionState('network_required');try{announceTransactionState('switching_network');await switchChainAsync({chainId:CHAIN_ID});for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,250));if(window.ethereum){const raw=await window.ethereum.request({method:'eth_chainId'});const actual=typeof raw==='string'?parseInt(raw,16):Number(raw);if(actual===CHAIN_ID){announceTransactionState('network_switched');toast.success('Switched to Arc Testnet');return true}}}throw new Error('Wallet switch could not be verified');}catch(err){const e=err as{message?:string};toast.error(e.message?.toLowerCase().includes('reject')?'Chain switch rejected':'Failed to verify network switch');return false}},[isCorrectChain,switchChainAsync]);return{isCorrectChain,switchToArc,isSwitching:isPending,currentChainId:chainId,targetChainId:CHAIN_ID};}
