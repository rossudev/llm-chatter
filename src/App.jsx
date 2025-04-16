import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chatter from './Chatter.jsx';
import Shared from './Shared.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chatter />} />
        <Route path="/shared/:userName/:uniqueId" element={<Shared />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;