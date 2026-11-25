import { useEffect, useState } from 'react';
import { bossById } from './bosses.ts';
import { loadGame } from './lib/saved-game.ts';
import { Bench } from './screens/Bench.tsx';
import { Home } from './screens/Home.tsx';
import { Play } from './screens/Play.tsx';

const routeOf = () => (location.hash.startsWith('#/bench') ? 'bench' : location.hash.startsWith('#/play') ? 'play' : 'home');

export function App() {
  const [route, setRoute] = useState(routeOf);
  useEffect(() => {
    const on = () => setRoute(routeOf());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // Không có ván để chơi thì về màn chọn đối thủ
  const saved = route === 'play' ? loadGame() : null;
  const shown = route === 'play' && !saved ? 'home' : route;
  useEffect(() => {
    document.body.dataset.route = shown;
    window.scrollTo(0, 0);
  }, [shown]);
  return (
    <main className="canvas">
      {shown === 'bench' ? <Bench /> : shown === 'play' && saved ? <Play key={saved.id} boss={bossById(saved.bossId)} /> : <Home key={route} />}
    </main>
  );
}
