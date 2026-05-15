import { useState } from 'react'

export default function EntryForm({ onAdd }){
  const [text, setText] = useState('')
  const [category, setCategory] = useState([])

  function toggleCat(c){
    setCategory(prev => prev.includes(c)? prev.filter(x=>x!==c): [...prev,c])
  }

  async function submit(e){
    e.preventDefault()
    if(!text.trim()) return
    const payload = { text, category }
    try{
      const res = await fetch('/api/entries', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const data = await res.json()
      onAdd && onAdd(data)
      setText('')
      setCategory([])
    }catch(err){
      console.error(err)
      // fallback: still notify parent
      onAdd && onAdd(payload)
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <div><strong>Neu eintragen</strong></div>
      <div style={{marginTop:8}}>
        <textarea className="input" rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder={'Art is ... / I acted through art today by ...'} />
      </div>
      <div style={{marginTop:8}}>
        <label style={{marginRight:8}}><input type="checkbox" checked={category.includes('intrinsic')} onChange={()=>toggleCat('intrinsic')} /> Intrinsic</label>
        <label style={{marginRight:8}}><input type="checkbox" checked={category.includes('extrinsic')} onChange={()=>toggleCat('extrinsic')} /> Extrinsic</label>
        <label><input type="checkbox" checked={category.includes('shared')} onChange={()=>toggleCat('shared')} /> Shared</label>
      </div>
      <div style={{marginTop:8}}>
        <button className="btn" type="submit">Absenden</button>
      </div>
    </form>
  )
}
