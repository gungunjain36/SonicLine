import axios from "axios"
import { useState } from "react"

export default function Chat() {

  const [message, setMessage] = useState<string>("");
  const [response, setResponse] = useState<string>("");

  function handleSend(message: string) {
    axios.post("http://localhost:8000/agent/chat", { message: message })
      .then((response) => {
      if (response.data.status === "success") {
        console.log(response.data.response);
        setResponse(response.data.response);
      }
      })
      .catch((error) => {
      console.error("Error:", error);
      });
  }
  return (
    <div>
      <h1 className='text-4xl font-bold text-center'>
      Chat
      </h1>

      <label htmlFor="chatInput" className="sr-only">Enter your command</label>
      <input onChange={(e) =>{
        setMessage(e.target.value)}
      }
        id="chatInput"
        type='text' 
        className='border border-gray-300 rounded-lg p-2 w-full'
        placeholder="Type your message"
        aria-label="Chat input"
      />
      <button onClick={() => handleSend(message)} className='bg-blue-500 text-white p-2 rounded-lg mt-2 w-full'>Send</button>
      <div>{response}</div>
    </div>
  )
}