export const totalHours = (o) => parseFloat((o.time_per_unit * o.qty).toFixed(2))

export function daysUntilDue(dueDateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const due   = new Date(dueDateStr); due.setHours(0,0,0,0)
  return Math.ceil((due - today) / 86400000)
}

export function getPriority(o) {
  const d = daysUntilDue(o.due_date)
  if (d <  0) return 'Overdue'
  if (d <= 1) return 'Critical'
  if (d <= 3) return 'High'
  if (d <= 7) return 'Medium'
  return 'Low'
}

export const PRIORITY_ORDER = { Overdue:5, Critical:4, High:3, Medium:2, Low:1 }
export const PRIORITY_COLOR = {
  Overdue:'#ff4d4d', Critical:'#ef4444', High:'#f97316', Medium:'#eab308', Low:'#22c55e'
}

export function sortOrders(list) {
  return [...list].sort((a,b) => {
    const pd = PRIORITY_ORDER[getPriority(b)] - PRIORITY_ORDER[getPriority(a)]
    return pd !== 0 ? pd : new Date(a.due_date) - new Date(b.due_date)
  })
}

export function buildDailyPlan(orders, teamSize, daySettings) {
  const pending = sortOrders(orders.filter(o => o.status !== 'Completed'))
  let queue     = pending.map(o => ({ ...o, _rem: totalHours(o) }))
  const plan    = []

  for (let i = 0; i < 30; i++) {
    if (queue.length === 0) break
    const date = new Date(); date.setDate(date.getDate() + i)
    const key  = date.toISOString().split('T')[0]
    const wh   = daySettings[key] ?? 8
    const cap  = parseFloat((teamSize * wh).toFixed(2))
    let   rem  = cap
    const slots = [], nextQueue = []

    for (const o of queue) {
      if (rem <= 0) { nextQueue.push(o); continue }
      const canDo = Math.min(o._rem, rem)
      rem = parseFloat((rem - canDo).toFixed(2))
      const done = canDo >= o._rem - 0.001
      slots.push({ ...o, hoursToday: parseFloat(canDo.toFixed(2)), done })
      if (!done) nextQueue.push({ ...o, _rem: parseFloat((o._rem - canDo).toFixed(2)) })
    }

    if (slots.length > 0)
      plan.push({ date, key, workingHours: wh, capacity: cap, used: parseFloat((cap - rem).toFixed(2)), slots })
    queue = nextQueue
  }
  return plan
}

export function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const raw = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s_]/g,''))
  const idx = k => raw.findIndex(h => h.includes(k))
  const [iID,iCust,iProd,iQty,iDue,iTPU] = ['orderid','customer','product','qty','due','timeperunit'].map(idx)
  return lines.slice(1).map((line,i) => {
    const v = line.split(',').map(x=>x.trim())
    return {
      order_id: v[iID]||`ORD-${Date.now()}-${i}`,
      customer: v[iCust]||'Unknown',
      product:  v[iProd]||'Unknown',
      qty:      parseFloat(v[iQty])||1,
      due_date: v[iDue]||new Date(Date.now()+7*86400000).toISOString().split('T')[0],
      time_per_unit: parseFloat(v[iTPU])||1,
      status: 'Not Started',
    }
  })
}
