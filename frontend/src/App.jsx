import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Signup from './Signup';
import Signin from './Signin';
import Profile from './Profile';
import CreateProject from './CreateProject';
import EditProject from './EditProject';
import Tasks from './Tasks';
import Annotate from './Annotate';
import AudioWaveformLabeler from './AudioWaveformLabeler';
import SuperProject from './SuperProject';
import CreateSuperProject from './CreateSuperProject';
import EditSuperProject from './EditSuperProject';
import Project from './Project';
import InferencePage from './InferencePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/create_project" element={<CreateProject />} />
        <Route path="/edit_project/:id" element={<EditProject />} />
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/annotate/:id" element={<Annotate />} />
        <Route path="/example" element={<AudioWaveformLabeler/>}/>
        <Route path="/superprojects" element={<SuperProject />} />
        <Route path="/create_superproject" element={<CreateSuperProject />} />
        <Route path="/edit_superproject/:id" element={<EditSuperProject />} />
        <Route path="/projects" element={<Project />} />
        <Route path="/inference" element={<InferencePage/>}/>s
      </Routes>
    </Router>
  );
}

export default App;
