import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Image } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <div className="d-flex justify-content-end">
        <Image
          src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
          roundedCircle
          width={40}
          height={40}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/profile')}
        />
      </div>
      <h2>Welcome to Home Page</h2>
    </div>
  );
}

export default Home;
