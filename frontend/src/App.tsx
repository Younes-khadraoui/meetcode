import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [data, setData] = useState("")

  useEffect(() => {
    axios.get("http://localhost:8000/")
      .then(res => {
           setData(res.data)
      })
      .catch(err => {
        console.error(err)
      })
  },[])

  return (
    <div className='p-10'>
      <p className='text-white'>{data}</p>
      <h1 className='text-red-100 text-xl font-semibold' >Welcome to Meetcode</h1>
      <button className='bg-blue-600 text-white px-2 py-1 rounded-sm hover:scale-105 transition-transform duration-200 outline-none'>Create new meet</button>
    </div>
  )
}

export default App
