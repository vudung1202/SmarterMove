import { useEffect, useState } from 'react';
import { BOSSES, bossById, type Boss } from '../bosses.ts';
import { Board } from '../components/Board.tsx';
import { NewGameSheet } from '../components/NewGameSheet.tsx';
import { listGames } from '../lib/history.ts';
import { passed, PROMOTE, recent, recentWins, recommended, record, type GameRecord } from '../lib/progress.ts';
import { loadGame, startGame } from '../lib/saved-game.ts';

const RESULT = { win: ['Thắng', 'win'], draw: ['Hòa', 'draw'], loss: ['Thua', 'loss'] } as const;

function dayText(iso: string) {
  const d = new Date(iso), today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  return days === 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Home() {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [sheetFor, setSheetFor] = useState<Boss | null>(null);
  const [saved] = useState(loadGame);
  useEffect(() => { void listGames().then(setGames, () => setGames([])); }, []);
  if (!games) return null; // IndexedDB trả trong vài ms; không cần khung chờ

  const unfinished = saved && !saved.over ? saved : null;
  const unBoss = unfinished ? bossById(unfinished.bossId) : null;
  const rec = recommended(games, BOSSES);
  const prev = BOSSES[BOSSES.indexOf(rec) - 1];
  const need = PROMOTE.wins - recentWins(games, rec.id);
  const finding = !games.length
    ? `Chưa có ván nào. Bắt đầu với ${rec.name}, đối thủ dễ nhất.`
    : passed(games, rec.id)
      ? `Bạn đã qua cả ${BOSSES.length} boss. Tiếp tục giữ phong độ với ${rec.name}.`
      : `${prev ? `Bạn thắng ${prev.name} ${recentWins(games, prev.id)}/${recent(games, prev.id).length} ván gần nhất. ` : ''}Với ${rec.name}, thắng thêm ${need} ván nữa là lên cấp.`;

  const start = (b: Boss, color: 'w' | 'b') => {
    startGame(b.id, color);
    location.hash = '#/play';
  };

  return (
    <div className="page home">
      <header className="title-row"><div><h1>Chọn đối thủ</h1><p className="sub">{finding}</p></div></header>

      {unfinished && unBoss && (
        <section className="panel resume" aria-labelledby="resume-h">
          <div className="resume-board">
            <Board fen={unfinished.game.fen()} orientation={unfinished.color} coords={false} label={`Thế cờ ván đang dở với ${unBoss.name}`} />
          </div>
          <div className="resume-text">
            <h2 id="resume-h">Ván đang dở với {unBoss.name}</h2>
            <p className="muted">
              Nước {Math.floor(unfinished.sans.length / 2) + 1}, {unfinished.game.turn() === unfinished.color ? 'lượt bạn' : `lượt ${unBoss.name}`}, bạn cầm {unfinished.color === 'w' ? 'Trắng' : 'Đen'}.
            </p>
          </div>
          <a className="btn secondary" href="#/play">Tiếp tục ván</a>
        </section>
      )}

      <section className="bosses-sec" aria-labelledby="bosses-h">
        <h2 id="bosses-h" className="sec-h">Bốn boss, từ dễ đến khó</h2>
        <div className="bosses">
          {BOSSES.map((b) => {
            const r = record(games, b.id), isRec = b === rec;
            const n = (v: number, w: string) => <span className={v ? '' : 'zero'}><b className="num">{v}</b> {w}</span>;
            return (
              <article key={b.id} className={`boss${isRec ? ' is-rec' : ''}`}>
                <div className="boss-top">
                  <div className="avatar"><img src={`pieces/${b.piece}.svg`} alt="" /></div>
                  {isRec ? <span className="pill">Nên đấu</span> : passed(games, b.id) ? <span className="pill">Đã qua</span> : null}
                </div>
                <h3>{b.name}</h3>
                <p className="elo num">khoảng {b.elo.toLocaleString('vi')} Elo</p>
                <p className="style">{b.style}</p>
                <p className="tally">{r.games ? <>{n(r.win, 'thắng')}{n(r.draw, 'hòa')}{n(r.loss, 'thua')}</> : <span className="zero">Chưa đấu ván nào</span>}</p>
                <button type="button" className={`btn ${isRec ? 'primary' : 'secondary'}`} onClick={() => setSheetFor(b)}>
                  {isRec ? `Đấu với ${b.name}` : 'Đấu'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid lower">
        <section className={`panel recent${games.length ? '' : ' full'}`}>
          <header><h2>Ván gần đây</h2>{games.length > 0 && <span className="meta num">{games.length} ván</span>}</header>
          {games.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ngày</th><th>Đối thủ</th><th className="hide-sm">Quân</th><th>Kết quả</th><th className="n">Số nước</th></tr></thead>
                <tbody>
                  {games.slice(0, 5).map((g) => {
                    const b = bossById(g.bossId);
                    return (
                      <tr key={g.id}>
                        <td>{dayText(g.endedAt)}</td>
                        <td><span className="who"><span className="avatar xs"><img src={`pieces/${b.piece}.svg`} alt="" /></span>{b.name}</span></td>
                        <td className="hide-sm">{g.color === 'w' ? 'Trắng' : 'Đen'}</td>
                        <td className={`res ${RESULT[g.result][1]}`} title={g.reason}>{RESULT[g.result][0]}</td>
                        <td className="n num">{Math.ceil(g.sans.length / 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">Chưa có ván nào. Thắng {PROMOTE.wins} trong {PROMOTE.window} ván với một boss để mở boss tiếp theo.</p>}
        </section>
        {games.length > 0 && (
          <section className="panel ladder">
            <header><h2>Tiến độ lên cấp</h2></header>
            <p className="muted ladder-rule">Thắng {PROMOTE.wins} trong {PROMOTE.window} ván gần nhất để mở boss tiếp theo.</p>
            <ol className="ladder-list">
              {BOSSES.map((b) => {
                const r = recent(games, b.id), w = recentWins(games, b.id);
                return (
                  <li key={b.id} className="ladder-row">
                    <div className="ladder-line">
                      <span>{b.name}</span>
                      <span className="ladder-val">
                        {!r.length ? <span className="zero">—</span> : passed(games, b.id) ? <><span className="num">{w}/{r.length}</span> đã qua</> : <><span className="num">{w}/{PROMOTE.wins}</span> ván thắng</>}
                      </span>
                    </div>
                    <div className="track" role="img" aria-label={`${b.name}: thắng ${w} trong ${r.length} ván gần nhất`}>
                      <span style={{ width: `${Math.min(1, w / PROMOTE.wins) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="ladder-total">Đã mở <b className="num">{BOSSES.indexOf(rec) + 1}/{BOSSES.length}</b> boss</p>
          </section>
        )}
      </div>
      <p className="credit">Quân cờ: bộ cburnett của Colin M.L. Burnett, CC BY-SA 3.0. Engine: Stockfish 19, GPLv3. Sách khai cuộc: lichess-org/chess-openings, CC0.</p>

      {sheetFor && (
        <NewGameSheet boss={sheetFor} onClose={() => setSheetFor(null)} onStart={(c) => start(sheetFor, c)}
          warning={unfinished && unBoss && unfinished.sans.length ? `Ván dở với ${unBoss.name} sẽ bị xóa, không tính thắng thua.` : null} />
      )}
    </div>
  );
}
