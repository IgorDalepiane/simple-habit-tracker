import { useState, useEffect, useCallback } from 'react';
import supabase, { hasSupabaseConfig } from './utils/supabase';

const USERS = ['Igor', 'Vinicius'];

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function dateToKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.getTime();
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  const today = todayStr();
  if (iso === today) return 'Hoje';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === dateToKey(yesterday)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function App() {
  const [hasConfig, setHasConfig] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginSelectedUser, setLoginSelectedUser] = useState('Igor');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [habits, setHabits] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [todayChecks, setTodayChecks] = useState({});
  const [historyRange, setHistoryRange] = useState('Igor'); // será ajustado para currentUser ao logar
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [dayData, setDayData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [habitToDelete, setHabitToDelete] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const configOk = hasSupabaseConfig;

  const checkHasPassword = useCallback(async (userName) => {
    const { data, error } = await supabase.rpc('has_password', { user_name: userName });
    if (error) return false;
    return !!data;
  }, []);

  const loadHabits = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('habits')
      .select('id, name, sort_order')
      .eq('user_name', currentUser)
      .order('sort_order', { ascending: true });
    setHabits(data || []);
  }, [currentUser]);

  const loadTodayChecks = useCallback(async () => {
    if (!currentUser) return;
    const today = todayStr();
    const { data } = await supabase
      .from('check_ins')
      .select('habit_id')
      .eq('user_name', currentUser)
      .eq('date', today);
    const doneIds = {};
    (data || []).forEach((r) => { doneIds[r.habit_id] = true; });
    setTodayChecks(doneIds);
  }, [currentUser]);

  const loadDayData = useCallback(async () => {
    const usersToLoad = historyRange === 'Todos' ? ['Igor', 'Vinicius'] : [historyRange];
    const habitsByUser = {};
    const checkInsByDate = {};

    for (const u of usersToLoad) {
      const { data: habs } = await supabase
        .from('habits')
        .select('id, name')
        .eq('user_name', u)
        .order('sort_order');
      habitsByUser[u] = habs || [];

      const { data: checks } = await supabase
        .from('check_ins')
        .select('date, habit_id')
        .eq('user_name', u);
      (checks || []).forEach((c) => {
        if (!checkInsByDate[c.date]) checkInsByDate[c.date] = {};
        if (!checkInsByDate[c.date][u]) checkInsByDate[c.date][u] = [];
        checkInsByDate[c.date][u].push(c.habit_id);
      });
    }
    setDayData({ habitsByUser, checkInsByDate });
  }, [historyRange]);

  const computeStreak = useCallback((habitsByUser, checkInsByDate) => {
    const user = historyRange === 'Todos' ? currentUser : historyRange;
    if (!user) return 0;
    const totalHabits = (habitsByUser[user] || []).length;
    if (totalHabits === 0) return 0;

    const today = todayStr();
    const skipByDate = {};
    for (let i = 0; i < 400; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateToKey(d);
      const checks = (checkInsByDate[key] && checkInsByDate[key][user]) || [];
      skipByDate[key] = checks.length === 0;
    }

    const weekSkipCount = {};
    for (let i = 0; i < 400; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateToKey(d);
      const wk = getWeekKey(key);
      if (!weekSkipCount[wk]) weekSkipCount[wk] = 0;
      if (skipByDate[key]) weekSkipCount[wk]++;
    }

    let streakCount = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateToKey(d);
      const wk = getWeekKey(key);
      if (weekSkipCount[wk] > 2) break;
      streakCount++;
    }
    return streakCount;
  }, [historyRange, currentUser]);

  useEffect(() => {
    setHasConfig(configOk);
  }, [configOk]);

  useEffect(() => {
    if (!configOk || !loginSelectedUser) return;
    checkHasPassword(loginSelectedUser).then((hasPassword) => setNeedsPassword(!hasPassword));
  }, [configOk, loginSelectedUser, checkHasPassword]);

  useEffect(() => {
    if (!configOk || !currentUser) return;
    setHistoryRange(currentUser);
    (async () => {
      setLoading(true);
      await loadHabits();
      setLoading(false);
    })();
  }, [configOk, currentUser, loadHabits]);

  useEffect(() => {
    if (!configOk || !currentUser || habits.length === 0) return;
    loadTodayChecks();
  }, [configOk, currentUser, habits.length, loadTodayChecks]);

  useEffect(() => {
    if (!configOk) return;
    loadDayData();
  }, [configOk, historyRange, loadDayData]);

  useEffect(() => {
    if (Object.keys(dayData).length === 0) return;
    const { habitsByUser, checkInsByDate } = dayData;
    setStreak(computeStreak(habitsByUser, checkInsByDate));
  }, [dayData, computeStreak]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      if (needsPassword) {
        if (password.length < 4) {
          setLoginError('Senha deve ter pelo menos 4 caracteres.');
          return;
        }
        if (password !== confirmPassword) {
          setLoginError('As senhas não coincidem.');
          return;
        }
        const { error } = await supabase.rpc('set_password', {
          user_name: loginSelectedUser,
          plain_password: password,
        });
        if (error) throw error;
        setCurrentUser(loginSelectedUser);
      } else {
        const { data, error } = await supabase.rpc('check_password', {
          user_name: loginSelectedUser,
          plain_password: password,
        });
        if (error) throw error;
        if (!data) {
          setLoginError('Senha incorreta.');
          return;
        }
        setCurrentUser(loginSelectedUser);
      }
    } catch (err) {
      setLoginError(err.message || 'Erro ao entrar.');
    } finally {
      setLoginLoading(false);
    }
  };

  const addHabit = async () => {
    const name = newHabitName.trim();
    if (!name || !currentUser) return;
    const sortOrder = habits.length;
    await supabase.from('habits').insert({ user_name: currentUser, name, sort_order: sortOrder });
    setNewHabitName('');
    loadHabits();
  };

  const deleteHabit = async (habitId) => {
    await supabase.from('habits').delete().eq('id', habitId);
    setHabitToDelete(null);
    loadHabits();
    loadTodayChecks();
  };

  const toggleCheck = async (habitId, currentlyDone) => {
    const today = todayStr();
    if (currentlyDone) {
      await supabase.from('check_ins').delete().eq('habit_id', habitId).eq('user_name', currentUser).eq('date', today);
    } else {
      await supabase.from('check_ins').insert({ habit_id: habitId, user_name: currentUser, date: today });
    }
    loadTodayChecks();
    loadDayData();
  };

  const toggleCheckForDate = async (habitId, dateKey, currentlyDone) => {
    if (dateKey > todayStr()) return;
    if (currentlyDone) {
      await supabase.from('check_ins').delete().eq('habit_id', habitId).eq('user_name', currentUser).eq('date', dateKey);
    } else {
      await supabase.from('check_ins').insert({ habit_id: habitId, user_name: currentUser, date: dateKey });
    }
    loadTodayChecks();
    loadDayData();
  };

  const getFirstEntryDate = useCallback((checkInsByDate, user) => {
    const dates = Object.keys(checkInsByDate).filter(
      (d) => checkInsByDate[d][user] && checkInsByDate[d][user].length > 0
    );
    return dates.length === 0 ? null : dates.sort()[0];
  }, []);

  const getDayStatus = (dateKey) => {
    const { habitsByUser, checkInsByDate } = dayData;
    const today = todayStr();
    if (dateKey > today) return 'future';

    const users = historyRange === 'Todos' ? ['Igor', 'Vinicius'] : [historyRange];
    if (historyRange === 'Todos') {
      const firstEntries = users.map((u) => getFirstEntryDate(checkInsByDate, u)).filter(Boolean);
      const earliest = firstEntries.length ? firstEntries.sort()[0] : null;
      if (earliest && dateKey < earliest) return 'skip';
      let allSuccess = true;
      let anySuccess = false;
      for (const u of users) {
        const habs = habitsByUser[u] || [];
        const total = habs.length;
        if (total === 0) continue;
        const done = (checkInsByDate[dateKey] && checkInsByDate[dateKey][u]) || [];
        if (done.length === total) anySuccess = true;
        else allSuccess = false;
      }
      if (users.every((u) => (habitsByUser[u] || []).length === 0)) return 'skip';
      if (allSuccess && anySuccess) return 'success';
      if (anySuccess) return 'partial';
      return 'fail';
    }
    const u = users[0];
    const habs = habitsByUser[u] || [];
    const total = habs.length;
    if (total === 0) return 'skip';
    const firstEntry = getFirstEntryDate(checkInsByDate, u);
    if (firstEntry && dateKey < firstEntry) return 'skip';
    const done = (checkInsByDate[dateKey] && checkInsByDate[dateKey][u]) || [];
    if (done.length === total) return 'success';
    if (done.length > 0) return 'partial';
    return 'fail';
  };

  const getPopupContent = (dateKey) => {
    const { habitsByUser, checkInsByDate } = dayData;
    const users = historyRange === 'Todos' ? ['Igor', 'Vinicius'] : [historyRange];
    const lines = [];
    for (const u of users) {
      const habs = habitsByUser[u] || [];
      const doneIds = (checkInsByDate[dateKey] && checkInsByDate[dateKey][u]) || [];
      habs.forEach((h) => {
        lines.push({ user: u, habitId: h.id, habit: h.name, done: doneIds.includes(h.id) });
      });
    }
    return lines;
  };

  const canEditDay = (dateKey) => dateKey <= todayStr();

  const selectedDayStatus = selectedDay ? getDayStatus(selectedDay) : null;

  if (!hasConfig) {
    return (
      <div className="app">
        <div className="setup">
          <h1>Configurar Supabase</h1>
          <p>Copie <code>.env.example</code> para <code>.env</code> e preencha as variáveis. Rode também as migrations 001 e 002 no SQL Editor.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app">
        <div className="loginWrap">
          <h1 className="loginTitle">Hábitos</h1>
          <p className="loginSub">Escolha seu usuário e entre com a senha</p>
          <div className="loginUserButtons">
            {USERS.map((u) => (
              <button
                key={u}
                type="button"
                className={`loginUserBtn ${loginSelectedUser === u ? 'active' : ''}`}
                onClick={() => { setLoginSelectedUser(u); setPassword(''); setConfirmPassword(''); setLoginError(''); }}
              >
                {u}
              </button>
            ))}
          </div>
          <form className="loginForm" onSubmit={handleLogin}>
            {loginError && <p className="loginError">{loginError}</p>}
            {needsPassword ? (
              <>
                <label>Criar senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" autoComplete="new-password" />
                <label>Confirmar senha</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
              </>
            ) : (
              <>
                <label>Senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password" />
              </>
            )}
            <button type="submit" className="btn primary" disabled={loginLoading}>
              {needsPassword ? 'Criar e entrar' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const days = getMonthDays(calendarMonth.year, calendarMonth.month);
  const prevMonth = () => {
    if (calendarMonth.month === 0) setCalendarMonth({ year: calendarMonth.year - 1, month: 11 });
    else setCalendarMonth({ year: calendarMonth.year, month: calendarMonth.month - 1 });
  };
  const nextMonth = () => {
    if (calendarMonth.month === 11) setCalendarMonth({ year: calendarMonth.year + 1, month: 0 });
    else setCalendarMonth({ year: calendarMonth.year, month: calendarMonth.month + 1 });
  };
  const monthTitle = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const today = todayStr();

  return (
    <div className={`app ${selectedDayStatus === 'success' ? 'tintSuccess' : ''} ${selectedDayStatus === 'fail' ? 'tintFail' : ''}`}>
      <header className="header">
        <div className="headerLeft">
          <h1>Hábitos</h1>
          <span className="headerUser">{currentUser}</span>
        </div>
        <button type="button" className="logoutBtn" onClick={() => { setCurrentUser(null); setPassword(''); setConfirmPassword(''); }}>Sair</button>
      </header>

      <main className="main">
        <section className="section">
          <h2 className="sectionTitle">Hoje</h2>
          {loading ? (
            <p className="loadingMsg">Carregando…</p>
          ) : habits.length === 0 ? (
            <p className="historyEmpty">Nenhum hábito. Adicione um abaixo.</p>
          ) : (
            <div className="habitsList">
              {habits.map((habit) => {
                const done = !!todayChecks[habit.id];
                return (
                  <div key={habit.id} className="habitRow">
                    <span className="habitName">{habit.name}</span>
                    <div className="habitRowActions">
                      <button type="button" className={`habitCheck ${done ? 'done' : ''}`} onClick={() => toggleCheck(habit.id, done)} aria-label={done ? 'Desmarcar' : 'Marcar'}>
                        {done ? '✓' : ''}
                      </button>
                      <button type="button" className="habitDelete" onClick={() => setHabitToDelete({ id: habit.id, name: habit.name })} aria-label="Remover hábito">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="addHabitRow">
            <input type="text" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} placeholder="Novo hábito" onKeyDown={(e) => e.key === 'Enter' && addHabit()} />
            <button type="button" className="btn primary" onClick={addHabit}>Adicionar</button>
          </div>
        </section>

        <section className="section">
          <h2 className="sectionTitle">Histórico</h2>
          <div className="historyTabs">
            {['Igor', 'Vinicius', 'Todos'].map((r) => (
              <button key={r} type="button" className={`historyTab ${historyRange === r ? 'active' : ''}`} onClick={() => setHistoryRange(r)}>{r}</button>
            ))}
          </div>
          <div className="streakBox">
            <div className="streakNumber">{streak}</div>
            <div className="streakLabel">dias de streak</div>
            <div className="streakRule">Até 2 dias sem marcar por semana não quebram a streak.</div>
          </div>
          <div className="calendarWrap">
            <div className="calendarMonthNav">
              <button type="button" onClick={prevMonth}>←</button>
              <span className="calendarMonthTitle">{monthTitle}</span>
              <button type="button" onClick={nextMonth}>→</button>
            </div>
            <div className="calendarWeekdays">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="calendarGrid">
              {days.map((d, i) => {
                if (!d) return <div key={i} />;
                const key = dateToKey(d);
                const isOtherMonth = d.getMonth() !== calendarMonth.month;
                const isToday = key === today;
                const status = getDayStatus(key);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`calendarDay ${isOtherMonth ? 'otherMonth' : ''} ${isToday ? 'today' : ''} bubble${status.charAt(0).toUpperCase() + status.slice(1)}`}
                    onClick={() => setSelectedDay(key)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {habitToDelete && (
        <div className="modalBackdrop" onClick={() => setHabitToDelete(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h3 className="modalTitle">Remover hábito?</h3>
            <p className="modalText">“{habitToDelete.name}” será excluído e os check-ins desse hábito serão perdidos.</p>
            <div className="modalActions">
              <button type="button" className="btn modalBtnCancel" onClick={() => setHabitToDelete(null)}>Cancelar</button>
              <button type="button" className="btn primary modalBtnConfirm" onClick={() => deleteHabit(habitToDelete.id)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="popupBackdrop" onClick={() => setSelectedDay(null)}>
          <div className={`popupCard ${selectedDayStatus}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="popupClose" onClick={() => setSelectedDay(null)} aria-label="Fechar">×</button>
            <h3 className="popupTitle">{formatDate(selectedDay)}</h3>
            {historyRange === 'Todos' ? (
              (() => {
                const lines = getPopupContent(selectedDay);
                const byUser = {};
                lines.forEach((line) => {
                  if (!byUser[line.user]) byUser[line.user] = [];
                  byUser[line.user].push(line);
                });
                return (
                  <div className="popupSections">
                    {['Igor', 'Vinicius'].map((user) => {
                      const userLines = byUser[user] || [];
                      if (userLines.length === 0) return null;
                      return (
                        <div key={user} className="popupUserSection">
                          <h4 className="popupUserHeader">{user}</h4>
                          <ul className="popupHabits">
                            {userLines.map((line, i) => {
                              const editable = line.user === currentUser && canEditDay(selectedDay);
                              return (
                                <li key={i} className={line.done ? 'done' : 'notDone'}>
                                  {editable ? (
                                    <button type="button" className="popupHabitBtn" onClick={() => toggleCheckForDate(line.habitId, selectedDay, line.done)}>
                                      {line.done ? '✓' : '○'} {line.habit}
                                    </button>
                                  ) : (
                                    <span>{line.done ? '✓' : '○'} {line.habit}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <ul className="popupHabits">
                {getPopupContent(selectedDay).map((line, i) => {
                  const editable = line.user === currentUser && canEditDay(selectedDay);
                  return (
                    <li key={i} className={line.done ? 'done' : 'notDone'}>
                      {editable ? (
                        <button type="button" className="popupHabitBtn" onClick={() => toggleCheckForDate(line.habitId, selectedDay, line.done)}>
                          {line.done ? '✓' : '○'} {line.habit}
                        </button>
                      ) : (
                        <span>{line.done ? '✓' : '○'} {line.habit}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
