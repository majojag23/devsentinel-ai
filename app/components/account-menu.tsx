'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {signOut} from 'next-auth/react';
import {LogIn,LogOut,Crown,Code2} from 'lucide-react';
export function AccountMenu(){const [user,setUser]=useState<any>(null);useEffect(()=>{fetch('/api/account').then(r=>r.json()).then(d=>setUser(d.user)).catch(()=>{});},[]);return <div className="account-actions"><Link className="account-link studio-link" href="/studio"><Code2 size={14}/> Editor</Link><Link className="account-link premium-link" href="/plans"><Crown size={13}/> Pro</Link>{user?<><span className="account-name">{user.name||user.email}</span><button className="account-link" onClick={()=>signOut({callbackUrl:'/login'})}><LogOut size={13}/> Salir</button></>:<Link className="account-link login-link" href="/login"><LogIn size={13}/> Acceder</Link>}</div>}
