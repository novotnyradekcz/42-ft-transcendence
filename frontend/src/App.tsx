// The app's only component. There is one screen — a terminal — so App holds
// nothing itself: state lives in the five providers main.tsx stacks around it,
// and <Terminal /> owns the routes and the command line.

import Terminal from "./components/Terminal";

export default function App() {
  return <Terminal />;
}
