import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [data, setData] = useState("")

  useEffect(() => {
    axios.get("http://localhost:8000/")
      .then(res => {
          console.log(res.data)
          setData(res.data)
      })
      .catch(err => {
        console.error(err)
      })
  },[])

  return (
    <>
      {data}
    </>
  )
}

export default App
