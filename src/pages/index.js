import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import {
  totalHours, daysUntilDue, getPriority, sortOrders,
  buildDailyPlan, parseCSV, PRIORITY_COLOR, PRIORITY_ORDER
} from '../lib/helpers'

const d = n => new Date(Date.now()+n*86400000).toISOString().split('T')[0]
const SAMPLES = [
  { id:'s1', order_id:'ORD-001', customer:'Reliance Industries',  product:'Steel Frame A',     qty:50,  due_date:d(1),  time_per_unit:0.25, status:'Not Started' },
  { id:'s2', order_id:'ORD-002', customer:'Tata Motors',           product:'Gear Assembly B',   qty:200, due_date:d(3),  time_per_unit:0.08, status:'In Progress'  },
  { id:'s3', order_id:'ORD-003', customer:'L&T Engineering',       product:'Hydraulic Valve C', qty:30,  due_date:d(6),  time_per_unit:0.5,  status:'Not Started' },
  { id:'s4', order_id:'ORD-004', customer:'Mahindra Group',        product:'Conveyor Belt D',   qty:10,  due_date:d(10), time_per_unit:2.0,  status:'Not Started' },
  { id:'s5', order_id:'ORD-005', customer:'BHEL',                  product:'Motor Housing E',   qty:5,   due_date:d(2),  time_per_unit:2.5,  status:'Not Started' },
]
const EMPTY = { order_id:'', customer:'', product:'', qty:'', due_date:'', time_per_unit:'' }

export default function Home() {
  const router  = useRouter()
  const fileRef = useRef()

  const [user,        setUser]        = useState(null)
  const [orders,      setOrders]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [teamSize,    setTeamSize]    = useState(20)
  const [daySettings, setDaySettings] = useState({})
  const [tab,         setTab]         = useState('dashboard')
  const [modal,       setModal]       = useState(false)
  const [form,        setForm]        = useState(EMPTY)
  const [formErr,     setFormErr]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [dragOver,    setDragOver]    = useState(false)

  const notify = (msg, err=false) => { setToast({msg,err}); setTimeout(()=>setToast(null),3200) }

  // ── Auth check ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadOrders(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load orders ──
  const loadOrders = async (uid) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setOrders(SAMPLES); }
    else setOrders(data && data.length > 0 ? data : SAMPLES)
    setLoading(false)
  }

  // ── Add order ──
  const submitForm = async () => {
    const { order_id, customer, product, qty, due_date, time_per_unit } = form
    if (!order_id||!customer||!product||!qty||!due_date||!time_per_unit) { setFormErr('All fields are required.'); return }
    if (orders.find(o=>o.order_id===order_id)) { setFormErr('Order ID already exists.'); return }
    setSaving(true)
    const newOrder = { order_id, customer, product, qty:parseFloat(qty), due_date, time_per_unit:parseFloat(time_per_unit), status:'Not Started', user_id:user.id }
    const { data, error } = await supabase.from('orders').insert([newOrder]).select().single()
    setSaving(false)
    if (error) { notify('Failed to save order', true); return }
    setOrders(p => [data, ...p])
    setForm(EMPTY); setFormErr(''); setModal(false); notify('Order added!')
  }

  // ── Update status ──
  const updateStatus = async (id, status) => {
    setOrders(p => p.map(o => o.id===id ? {...o,status} : o))
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  // ── Delete order ──
  const deleteOrder = async (id) => {
    setOrders(p => p.filter(o => o.id!==id))
    await supabase.from('orders').delete().eq('id', id)
    notify('Order deleted')
  }

  // ── Import CSV ──
  const importCSV = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const rows = parseCSV(e.target.result).map(r => ({ ...r, user_id: user.id }))
      if (!rows.length) { notify('No valid rows found.', true); return }
      const { data, error } = await supabase.from('orders').insert(rows).select()
      if (error) { notify('Import failed', true); return }
      setOrders(p => [...(data||[]), ...p])
      notify(`${rows.length} orders imported!`)
    }
    reader.readAsText(file)
  }

  const setDayHours = (key, val) => {
    const v = Math.max(0, Math.min(24, parseFloat(val)||0))
    setDaySettings(p => ({ ...p, [key]: v }))
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login') }

  // ── Derived ──
  const sorted    = sortOrders(orders)
  const pending   = sorted.filter(o => o.status !== 'Completed')
  const totalPH   = pending.reduce((s,o) => s + totalHours(o), 0)
  const dailyPlan = buildDailyPlan(orders, teamSize, daySettings)
  const schedule5 = Array.from({length:5}, (_,i) => {
    const date = new Date(); date.setDate(date.getDate()+i)
    const key  = date.toISOString().split('T')[0]
    return { date, key, workingHours: daySettings[key]??8, capacity: teamSize*(daySettings[key]??8) }
  })
  const cap7      = Array.from({length:7}, (_,i) => {
    const date = new Date(); date.setDate(date.getDate()+i)
    const key  = date.toISOString().split('T')[0]
    return teamSize * (daySettings[key]??8)
  }).reduce((s,v)=>s+v,0)

  const countP = p => pending.filter(o => getPriority(o)===p).length

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#020817'}}>
      <div style={{fontFamily:"'Fira Code',monospace",color:'#334155',fontSize:14}}>Loading production data…</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#020817',color:'#e2e8f0',fontFamily:"'DM Mono',monospace"}}>

      {/* ── Header ── */}
      <header style={{background:'#080f1e',borderBottom:'1px solid #0f172a'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',flexWrap:'wrap',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>⚙</div>
            <div>
              <div style={{fontFamily:"'Fira Code',monospace",fontWeight:700,fontSize:15,color:'#e2e8f0',letterSpacing:'.06em'}}>PRODPLAN</div>
              <div style={{fontSize:10,color:'#1e293b',textTransform:'uppercase',letterSpacing:'.08em'}}>Production Scheduler</div>
            </div>
          </div>

          <div style={{display:'flex',alignItems:'flex-end',gap:14,flexWrap:'wrap'}}>
            {/* Team Size */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
              <div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:'.07em'}}>Team Size</div>
              <input type="number" min={1} max={500} value={teamSize}
                onChange={e=>setTeamSize(Math.max(1,parseInt(e.target.value)||1))}
                style={{width:64,background:'#0f172a',border:'1px solid #1e293b',borderRadius:7,color:'#7dd3fc',padding:'7px 8px',fontFamily:"'Fira Code',monospace",fontSize:16,fontWeight:700,textAlign:'center',outline:'none'}}/>
              <div style={{fontSize:10,color:'#1e293b'}}>people</div>
            </div>

            <div style={{width:1,height:48,background:'#0f172a'}}/>

            {/* Working hours next 5 days */}
            <div>
              <div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>Working Hours / Day</div>
              <div style={{display:'flex',gap:6}}>
                {schedule5.map(day => (
                  <div key={day.key} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <div style={{fontSize:10,color:'#334155'}}>{day.date.toLocaleDateString('en-IN',{weekday:'short'})}</div>
                    <div style={{fontSize:9,color:'#1e293b'}}>{day.date.getDate()}/{day.date.getMonth()+1}</div>
                    <input type="number" min={0} max={24} step={0.5} value={day.workingHours}
                      onChange={e=>setDayHours(day.key,e.target.value)}
                      style={{width:44,background:'#0f172a',border:'1px solid #1e293b',borderRadius:6,color:'#fb923c',fontFamily:"'Fira Code',monospace",fontSize:13,fontWeight:700,textAlign:'center',outline:'none',padding:'4px 3px'}}/>
                    <div style={{fontSize:9,color:'#334155'}}>{(teamSize*day.workingHours).toFixed(0)}h</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{width:1,height:48,background:'#0f172a'}}/>

            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button className="pp-btn" onClick={()=>{setModal(true);setFormErr('')}}>+ Order</button>
              <div style={{fontSize:11,color:'#334155',textAlign:'right'}}>
                <div style={{color:'#475569'}}>{user?.email}</div>
                <div style={{color:'#1d4ed8',cursor:'pointer',textDecoration:'underline'}} onClick={signOut}>Sign out</div>
              </div>
            </div>
          </div>
        </div>

        <nav style={{maxWidth:1200,margin:'0 auto',display:'flex',padding:'0 20px'}}>
          {[['dashboard','📊 Dashboard'],['orders','📋 Orders'],['plan','📅 Daily Plan'],['import','⬆ Import CSV']].map(([k,l])=>(
            <button key={k} className={`pp-tab ${tab===k?'pp-tab-active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </nav>
      </header>

      <main style={{maxWidth:1200,margin:'0 auto',padding:'20px'}}>

        {/* ══ DASHBOARD ══ */}
        {tab==='dashboard' && (<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:14}}>
            {[
              {icon:'📦',val:orders.length,label:'Total Orders',col:'#7dd3fc'},
              {icon:'🔴',val:countP('Overdue')+countP('Critical'),label:'Overdue / Critical',col:'#f87171'},
              {icon:'⚡',val:orders.filter(o=>o.status==='In Progress').length,label:'In Progress',col:'#fb923c'},
              {icon:'✅',val:orders.filter(o=>o.status==='Completed').length,label:'Completed',col:'#4ade80'},
            ].map(k=>(
              <div key={k.label} className="pp-card" style={{textAlign:'center'}}>
                <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
                <div style={{fontSize:30,fontFamily:"'Fira Code',monospace",fontWeight:700,color:k.col}}>{k.val}</div>
                <div style={{fontSize:10,color:'#334155',marginTop:4,textTransform:'uppercase',letterSpacing:'.07em'}}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div className="pp-card">
              <div style={{fontSize:10,fontWeight:700,color:'#1e293b',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>CAPACITY OVERVIEW</div>
              {[
                ['7-Day Total Capacity',`${cap7.toFixed(1)} hrs`,'#7dd3fc'],
                ['Total Pending Work',`${totalPH.toFixed(1)} hrs`,'#fb923c'],
                ['Days to Clear Queue',`${dailyPlan.length} days`,'#4ade80'],
              ].map(([l,v,c])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #0f172a'}}>
                  <span style={{fontSize:13,color:'#64748b'}}>{l}</span>
                  <span style={{fontSize:14,fontFamily:"'Fira Code',monospace",color:c}}>{v}</span>
                </div>
              ))}
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,color:'#334155',marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em'}}>Load vs 7-day capacity</div>
                <div style={{height:7,background:'#020817',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:4,transition:'width .5s',width:`${Math.min(100,(totalPH/Math.max(cap7,1))*100)}%`,background:'linear-gradient(90deg,#3b82f6,#ef4444)'}}/>
                </div>
              </div>
            </div>

            <div className="pp-card">
              <div style={{fontSize:10,fontWeight:700,color:'#1e293b',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>PRIORITY BREAKDOWN</div>
              {['Overdue','Critical','High','Medium','Low'].map(p=>{
                const cnt=countP(p), pct=pending.length?(cnt/pending.length)*100:0
                return (
                  <div key={p} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:PRIORITY_COLOR[p],flexShrink:0}}/>
                    <span style={{fontSize:12,color:'#475569',width:58}}>{p}</span>
                    <div style={{flex:1,height:5,background:'#020817',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,width:`${pct}%`,background:PRIORITY_COLOR[p]}}/>
                    </div>
                    <span style={{fontSize:12,fontFamily:"'Fira Code',monospace",color:'#334155',width:16,textAlign:'right'}}>{cnt}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pp-card">
            <div style={{fontSize:10,fontWeight:700,color:'#1e293b',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>
              TOP PRIORITY ORDERS — <span style={{color:'#7dd3fc'}}>{teamSize} ppl × {schedule5[0].workingHours}h = {schedule5[0].capacity}h today</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{color:'#334155',fontSize:11,textTransform:'uppercase',letterSpacing:'.06em'}}>
                    {['Order ID','Customer','Product','Qty','Time/Unit','Total Hrs','Due In','Priority'].map(h=>(
                      <th key={h} style={{padding:'6px 10px',textAlign:'left',borderBottom:'1px solid #0f172a',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0,6).map(o=>{
                    const p=getPriority(o), dLeft=daysUntilDue(o.due_date)
                    return (
                      <tr key={o.id} className="pp-row" style={{borderBottom:'1px solid #080f1e'}}>
                        <td style={{padding:'9px 10px',fontFamily:"'Fira Code',monospace",fontSize:12,color:'#475569'}}>{o.order_id}</td>
                        <td style={{padding:'9px 10px',color:'#cbd5e1'}}>{o.customer}</td>
                        <td style={{padding:'9px 10px',color:'#64748b'}}>{o.product}</td>
                        <td style={{padding:'9px 10px',fontFamily:"'Fira Code',monospace",color:'#7dd3fc'}}>{o.qty}</td>
                        <td style={{padding:'9px 10px',fontFamily:"'Fira Code',monospace",color:'#a78bfa'}}>{o.time_per_unit}h</td>
                        <td style={{padding:'9px 10px',fontFamily:"'Fira Code',monospace",color:'#fb923c',fontWeight:700}}>{totalHours(o)}h</td>
                        <td style={{padding:'9px 10px',color:dLeft<0?'#ff4d4d':dLeft<=1?'#ef4444':'#475569'}}>
                          {dLeft<0?`${Math.abs(dLeft)}d over`:dLeft===0?'Today':`${dLeft}d`}
                        </td>
                        <td style={{padding:'9px 10px'}}>
                          <span className="pp-badge" style={{background:PRIORITY_COLOR[p]+'22',color:PRIORITY_COLOR[p],border:`1px solid ${PRIORITY_COLOR[p]}44`}}>{p}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* ══ ORDERS ══ */}
        {tab==='orders' && (<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontSize:13,color:'#334155'}}>{orders.length} orders · sorted by priority & due date</span>
            <button className="pp-btn" onClick={()=>{setModal(true);setFormErr('')}}>+ New Order</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{color:'#334155',fontSize:11,textTransform:'uppercase',letterSpacing:'.06em',background:'#080f1e'}}>
                  {['#','Order ID','Customer','Product','Qty','Time/Unit (h)','Total Hours','Due Date','Days Left','Priority','Status',''].map(h=>(
                    <th key={h} style={{padding:'9px 12px',textAlign:'left',borderBottom:'1px solid #0f172a',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((o,i)=>{
                  const p=getPriority(o), dLeft=daysUntilDue(o.due_date)
                  return (
                    <tr key={o.id} className="pp-row">
                      <td style={{padding:'10px 12px',color:'#1e293b',fontFamily:"'Fira Code',monospace",fontSize:11}}>{i+1}</td>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{width:3,height:28,borderRadius:2,background:PRIORITY_COLOR[p]}}/>
                          <span style={{fontFamily:"'Fira Code',monospace",fontSize:12,color:'#475569'}}>{o.order_id}</span>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px',color:'#cbd5e1',fontWeight:500}}>{o.customer}</td>
                      <td style={{padding:'10px 12px',color:'#64748b'}}>{o.product}</td>
                      <td style={{padding:'10px 12px',fontFamily:"'Fira Code',monospace",color:'#7dd3fc'}}>{o.qty}</td>
                      <td style={{padding:'10px 12px',fontFamily:"'Fira Code',monospace",color:'#a78bfa'}}>{o.time_per_unit} h</td>
                      <td style={{padding:'10px 12px',fontFamily:"'Fira Code',monospace",color:'#fb923c',fontWeight:700}}>{totalHours(o)} h</td>
                      <td style={{padding:'10px 12px',color:'#334155',whiteSpace:'nowrap'}}>{new Date(o.due_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{padding:'10px 12px',color:dLeft<0?'#ff4d4d':dLeft<=1?'#ef4444':'#475569',fontFamily:"'Fira Code',monospace"}}>
                        {dLeft<0?`-${Math.abs(dLeft)}d`:`${dLeft}d`}
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <span className="pp-badge" style={{background:PRIORITY_COLOR[p]+'22',color:PRIORITY_COLOR[p],border:`1px solid ${PRIORITY_COLOR[p]}44`}}>{p}</span>
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <select className="pp-select" value={o.status} onChange={e=>updateStatus(o.id,e.target.value)}>
                          <option>Not Started</option><option>In Progress</option><option>Completed</option>
                        </select>
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <button onClick={()=>deleteOrder(o.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#1e293b',fontSize:15}}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ══ DAILY PLAN ══ */}
        {tab==='plan' && (<>
          <div style={{marginBottom:16,fontSize:13,color:'#334155'}}>
            Capacity = <span style={{color:'#7dd3fc'}}>Team Size ({teamSize}) × Working Hours that day</span>. Edit hours on each day card.
          </div>
          {dailyPlan.length===0 && <div style={{textAlign:'center',padding:60,color:'#1e293b'}}>🎉 No pending orders — all clear!</div>}
          {dailyPlan.map((day,di)=>{
            const pct=(day.used/day.capacity)*100
            const barCol=pct>90?'#ef4444':pct>70?'#f97316':'#22c55e'
            return (
              <div key={day.key} className="pp-card" style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',borderRadius:8,padding:'4px 12px',fontFamily:"'Fira Code',monospace",fontSize:12,fontWeight:700,color:'#fff'}}>
                      DAY {di+1}
                    </div>
                    <span style={{fontSize:14,color:'#94a3b8',fontWeight:500}}>
                      {day.date.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'})}
                    </span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'#080f1e',border:'1px solid #0f172a',borderRadius:10,padding:'6px 14px'}}>
                    <span style={{fontSize:11,color:'#334155',textTransform:'uppercase',letterSpacing:'.06em'}}>Working hrs</span>
                    <input type="number" min={0} max={24} step={0.5} value={day.workingHours}
                      onChange={e=>setDayHours(day.key,e.target.value)}
                      style={{width:50,background:'#020817',border:'1px solid #0f172a',borderRadius:6,color:'#7dd3fc',fontFamily:"'Fira Code',monospace",fontSize:15,fontWeight:700,textAlign:'center',outline:'none',padding:'3px 5px'}}/>
                    <span style={{fontSize:11,color:'#334155'}}>h × {teamSize} ppl =</span>
                    <span style={{fontSize:13,fontFamily:"'Fira Code',monospace",color:'#4ade80',fontWeight:700}}>{day.capacity}h</span>
                    <span style={{fontSize:11,color:'#334155',marginLeft:6}}>used:</span>
                    <span style={{fontSize:13,fontFamily:"'Fira Code',monospace",color:barCol,fontWeight:700}}>{day.used}h</span>
                  </div>
                </div>
                <div style={{height:5,background:'#020817',borderRadius:3,marginBottom:14,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:barCol,borderRadius:3,transition:'width .4s'}}/>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{color:'#1e293b',fontSize:11,textTransform:'uppercase',letterSpacing:'.05em'}}>
                        {['#','Order ID','Customer','Product','Qty','Time/Unit','Hours Today','Total Hrs','Due','Priority'].map(h=>(
                          <th key={h} style={{padding:'5px 10px',textAlign:'left',borderBottom:'1px solid #080f1e',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {day.slots.map((s,idx)=>{
                        const p=getPriority(s), dLeft=daysUntilDue(s.due_date)
                        return (
                          <tr key={s.id+idx} style={{borderBottom:'1px solid #080f1e'}}>
                            <td style={{padding:'8px 10px',color:'#1e293b'}}>{idx+1}</td>
                            <td style={{padding:'8px 10px',fontFamily:"'Fira Code',monospace",color:'#334155'}}>{s.order_id}</td>
                            <td style={{padding:'8px 10px',color:'#94a3b8'}}>{s.customer}</td>
                            <td style={{padding:'8px 10px',color:'#64748b'}}>{s.product}</td>
                            <td style={{padding:'8px 10px',fontFamily:"'Fira Code',monospace",color:'#7dd3fc'}}>{s.qty}</td>
                            <td style={{padding:'8px 10px',fontFamily:"'Fira Code',monospace",color:'#a78bfa'}}>{s.time_per_unit}h</td>
                            <td style={{padding:'8px 10px',fontFamily:"'Fira Code',monospace",color:'#34d399',fontWeight:700}}>
                              {s.hoursToday}h{!s.done&&<span style={{color:'#f97316',fontSize:10,marginLeft:4}}>(partial)</span>}
                            </td>
                            <td style={{padding:'8px 10px',fontFamily:"'Fira Code',monospace",color:'#fb923c'}}>{totalHours(s)}h</td>
                            <td style={{padding:'8px 10px',color:dLeft<0?'#ff4d4d':dLeft<=1?'#ef4444':'#475569',whiteSpace:'nowrap'}}>
                              {dLeft<0?`${Math.abs(dLeft)}d over`:dLeft===0?'Today':`${dLeft}d`}
                            </td>
                            <td style={{padding:'8px 10px'}}>
                              <span className="pp-badge" style={{background:PRIORITY_COLOR[p]+'22',color:PRIORITY_COLOR[p],border:`1px solid ${PRIORITY_COLOR[p]}44`}}>{p}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </>)}

        {/* ══ IMPORT ══ */}
        {tab==='import' && (<>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:600,color:'#cbd5e1',marginBottom:6}}>Import Orders from TranZact CSV</div>
            <div style={{fontSize:13,color:'#334155',lineHeight:1.7}}>
              Required columns: <span style={{color:'#7dd3fc'}}>Order ID, Customer Name, Product Name, Quantity, Delivery Due Date, Time Per Unit</span>
            </div>
          </div>
          <div className={`pp-drop ${dragOver?'pp-drop-active':''}`}
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);importCSV(e.dataTransfer.files[0])}}
            onClick={()=>fileRef.current.click()}>
            <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>importCSV(e.target.files[0])}/>
            <div style={{fontSize:36,marginBottom:10}}>📂</div>
            <div style={{fontSize:14,color:'#7dd3fc',fontWeight:600}}>Drop CSV file here or click to browse</div>
            <div style={{fontSize:12,color:'#1e293b',marginTop:6}}>Supports .csv exports from TranZact</div>
          </div>
          <div className="pp-card" style={{marginTop:20}}>
            <div style={{fontSize:10,fontWeight:700,color:'#1e293b',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>EXPECTED CSV FORMAT</div>
            <div style={{background:'#020817',borderRadius:8,padding:16,fontFamily:"'Fira Code',monospace",fontSize:12,color:'#4ade80',overflowX:'auto',lineHeight:1.9}}>
              Order ID,Customer Name,Product Name,Quantity,Delivery Due Date,Time Per Unit<br/>
              ORD-101,Reliance Industries,Steel Frame A,50,2026-04-25,0.25<br/>
              ORD-102,Tata Motors,Gear Assembly B,200,2026-04-27,0.08
            </div>
          </div>
        </>)}
      </main>

      {/* ── Add Order Modal ── */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}
          onClick={()=>setModal(false)}>
          <div style={{background:'#080f1e',border:'1px solid #0f172a',borderRadius:16,padding:28,width:500,maxWidth:'95vw'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:'#e2e8f0',marginBottom:20}}>Add New Production Order</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {[
                {k:'order_id',l:'Order ID',t:'text',p:'e.g. ORD-106'},
                {k:'customer',l:'Customer Name',t:'text',p:'e.g. Tata Motors'},
                {k:'product',l:'Product Name',t:'text',p:'e.g. Gear Assembly'},
                {k:'qty',l:'Quantity',t:'number',p:'e.g. 100'},
                {k:'due_date',l:'Delivery Due Date',t:'date',p:''},
                {k:'time_per_unit',l:'Time Per Unit (hrs)',t:'number',p:'e.g. 0.5 = 30 min'},
              ].map(f=>(
                <div key={f.k}>
                  <label className="pp-label">{f.l}</label>
                  <input type={f.t} placeholder={f.p} value={form[f.k]}
                    onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                    className="pp-input"/>
                </div>
              ))}
            </div>
            {form.qty && form.time_per_unit && (
              <div style={{marginTop:12,padding:'10px 14px',background:'#020817',borderRadius:8,fontSize:13,color:'#fb923c',fontFamily:"'Fira Code',monospace"}}>
                ⟹ Total production hours: <strong>{(parseFloat(form.time_per_unit||0)*parseFloat(form.qty||0)).toFixed(2)} hrs</strong>
              </div>
            )}
            {formErr && <div style={{marginTop:10,fontSize:12,color:'#f87171'}}>⚠ {formErr}</div>}
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
              <button className="pp-btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
              <button className="pp-btn" onClick={submitForm} disabled={saving}>{saving?'Saving…':'Add Order'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pp-toast" style={{border:`1px solid ${toast.err?'#7f1d1d':'#1d4ed8'}`,color:toast.err?'#f87171':'#7dd3fc'}}>
          {toast.err?'❌':'✅'} {toast.msg}
        </div>
      )}
    </div>
  )
}
