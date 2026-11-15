'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Shell } from './shell';
export function AuthGuard({children}:{children:React.ReactNode}) { const [ready,setReady]=useState(false);const router=useRouter();useEffect(()=>{const s=createClient();s.auth.getUser().then(({data})=>{if(!data.user)router.replace('/login');else setReady(true)});},[router]);if(!ready)return <div className="p-10 text-center text-slate-500">Comprobando sesión…</div>;return <Shell>{children}</Shell>}
