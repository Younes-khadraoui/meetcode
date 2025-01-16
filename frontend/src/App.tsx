import { useNavigate } from "react-router";

function App() {
  const navigate = useNavigate();

  const createNewMeet = async () => {
    const host = createRandomYounes();
    try {
      const response = await fetch("http://localhost:8000/create-meeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ host }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.type === "MEETING_CREATED") {
          // Correctly redirect to the session endpoint
          navigate(`/session/${data.endpoint}`);
        } else {
          console.error("Failed to create meeting:", data);
        }
      } else {
        console.error("Failed to communicate with server");
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
    }
  };

  const createRandomYounes = () => {
    let username = localStorage.getItem("username");
    if (!username) {
      username = "younes" + Math.floor(Math.random() * 100);
      localStorage.setItem("username", username);
    }
    return username;
  };

  return (
    <div className="p-10">
      <h1 className="text-red-100 text-xl font-semibold">Welcome to Meetcode</h1>
      <button
        onClick={createNewMeet}
        className="bg-blue-600 px-2 py-1 rounded-sm hover:scale-105 transition-transform duration-200 outline-none"
      >
        Create new meet
      </button>
    </div>
  );
}

export default App;