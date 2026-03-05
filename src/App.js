import React from "react";
import UsersList from "./components/UsersList";

function App() {

  const users = [
     { name: "John", country: "US", balance: 540 },
    { name: "Ahmed", country: "AE", balance: 900 },
  ];

  return (
    <div>
      <UsersList users={users} />
    </div>
  );
}

export default App;