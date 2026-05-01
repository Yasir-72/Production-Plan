import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [mode,     setMode]     = useState('login') // 'login' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [info,     setInfo]     = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        setInfo('Account created! Check your email to confirm, then log in.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logo}>
          <div style={S.logoMark}>⚙</div>
          <div>
            <div style={S.logoName}>PRODPLAN</div>
            <div style={S.logoSub}>Production Scheduler</div>
          </div>
        </div>

        <div style={S.tabs}>
          {['login','signup'].map(m => (
            <button key={m} onClick={()=>{setMode(m);setError('');setInfo('')}}
              style={{ ...S.modeBtn, ...(mode===m ? S.modeBtnActive : {}) }}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handle}>
          {mode === 'signup' && (
            <div style={S.field}>
              <label style={S.label}>Full Name</label>
              <input className="pp-input" type="text" placeholder="Your name"
                value={name} onChange={e=>setName(e.target.value)} required />
            </div>
          )}
          <div style={S.field}>
            <label style={S.label}>Email Address</label>
            <input className="pp-input" type="email" placeholder="you@company.com"
              value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input className="pp-input" type="password" placeholder="••••••••"
              value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div style={S.error}>⚠ {error}</div>}
          {info  && <div style={S.info}>✅ {info}</div>}

          <button className="pp-btn" type="submit" disabled={loading}
            style={{ width:'100%', marginTop:8, opacity: loading ? .6 : 1 }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        <div style={S.hint}>
          {mode==='login'
            ? <>No account? <span style={S.link} onClick={()=>setMode('signup')}>Sign up</span></>
            : <>Have an account? <span style={S.link} onClick={()=>setMode('login')}>Sign in</span></>}
        </div>
      </div>
    </div>
  )
}

const S = {
  page:        { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#020817', padding:20 },
  card:        { background:'#080f1e', border:'1px solid #0f172a', borderRadius:16, padding:36, width:420, maxWidth:'100%' },
  logo:        { display:'flex', alignItems:'center', gap:12, marginBottom:28 },
  logoMark:    { width:40, height:40, background:'linear-gradient(135deg,#1d4ed8,#7c3aed)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  logoName:    { fontFamily:"'Fira Code',monospace", fontWeight:700, fontSize:18, color:'#e2e8f0', letterSpacing:'.06em' },
  logoSub:     { fontSize:11, color:'#1e293b', textTransform:'uppercase', letterSpacing:'.08em' },
  tabs:        { display:'flex', borderBottom:'1px solid #0f172a', marginBottom:24 },
  modeBtn:     { flex:1, background:'none', border:'none', borderBottom:'2px solid transparent', padding:'8px 0', fontFamily:"'DM Mono',monospace", fontSize:13, color:'#334155', cursor:'pointer', transition:'all .2s' },
  modeBtnActive:{ color:'#7dd3fc', borderBottomColor:'#7dd3fc' },
  field:       { marginBottom:16 },
  label:       { display:'block', fontSize:11, color:'#334155', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 },
  error:       { background:'#450a0a', border:'1px solid #7f1d1d', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#f87171', marginBottom:12 },
  info:        { background:'#052e16', border:'1px solid #14532d', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#4ade80', marginBottom:12 },
  hint:        { textAlign:'center', marginTop:20, fontSize:12, color:'#334155' },
  link:        { color:'#3b82f6', cursor:'pointer', textDecoration:'underline' },
}
