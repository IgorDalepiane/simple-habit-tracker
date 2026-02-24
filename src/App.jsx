import { useState, useEffect, useCallback, useMemo } from 'react';
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

function getSkipIndexInWeek(dateKey, checkInsByDate, user, firstEntry) {
  const d = new Date(dateKey + 'T12:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  const skipDates = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dateToKey(day);
    const hasChecks = checkInsByDate[key] && checkInsByDate[key][user] && checkInsByDate[key][user].length > 0;
    const afterStart = !firstEntry || key >= firstEntry;
    if (!hasChecks && afterStart) skipDates.push(key);
  }
  skipDates.sort();
  const idx = skipDates.indexOf(dateKey);
  return idx;
}

function getSkipIndexFromMap(dateKey, skipByDate, firstEntry) {
  const d = new Date(dateKey + 'T12:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  const skipDates = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dateToKey(day);
    const afterStart = !firstEntry || key >= firstEntry;
    if (skipByDate[key] && afterStart) skipDates.push(key);
  }
  skipDates.sort();
  return skipDates.indexOf(dateKey);
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
  const [streakDateKeys, setStreakDateKeys] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [checkingKey, setCheckingKey] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

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
    const usersToLoad = [historyRange];
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

  const computeStreak = useCallback((habitsByUser, checkInsByDate, todayChecksOverride) => {
    const user = historyRange;
    const today = todayStr();
    if (!user) return { count: 0, dateKeys: new Set() };
    const totalHabits = (habitsByUser[user] || []).length;
    if (totalHabits === 0) return { count: 0, dateKeys: new Set() };

    const hasAnyCheckIn = Object.keys(checkInsByDate).some(
      (d) => checkInsByDate[d][user] && checkInsByDate[d][user].length > 0
    );
    const hasTodayOverride = user === currentUser && todayChecksOverride && Object.keys(todayChecksOverride).length > 0;
    if (!hasAnyCheckIn && !hasTodayOverride) return { count: 0, dateKeys: new Set() };

    const skipByDate = {};
    for (let i = 0; i < 400; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateToKey(d);
      if (key === today && user === currentUser && todayChecksOverride !== undefined) {
        const todayDoneCount = Object.keys(todayChecksOverride).length;
        skipByDate[key] = todayDoneCount < totalHabits;
        continue;
      }
      const checks = (checkInsByDate[key] && checkInsByDate[key][user]) || [];
      skipByDate[key] = checks.length < totalHabits;
    }

    const firstEntry = Object.keys(checkInsByDate).filter(
      (d) => checkInsByDate[d][user] && checkInsByDate[d][user].length > 0
    ).sort()[0] || null;

    const maxDays = firstEntry ? 400 : 1;
    let firstFailI = maxDays;
    for (let i = 0; i < maxDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateToKey(d);
      if (firstEntry && key < firstEntry) {
        firstFailI = i;
        break;
      }
      const isSkip = skipByDate[key];
      if (isSkip) {
        const skipIndex = getSkipIndexFromMap(key, skipByDate, firstEntry);
        if (skipIndex >= 2) {
          firstFailI = i;
          break;
        }
      }
    }

    const dateKeys = new Set();
    for (let i = 0; i < firstFailI; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateKeys.add(dateToKey(d));
    }
    return { count: firstFailI, dateKeys };
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
    setHistoryLoading(true);
    loadDayData().finally(() => setHistoryLoading(false));
  }, [configOk, historyRange, loadDayData]);

  useEffect(() => {
    if (Object.keys(dayData).length === 0) return;
    const { habitsByUser, checkInsByDate } = dayData;
    const { count, dateKeys } = computeStreak(habitsByUser, checkInsByDate, todayChecks);
    setStreak(count);
    setStreakDateKeys(dateKeys);
  }, [dayData, todayChecks, computeStreak]);

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
    await loadHabits();
    await loadDayData();
  };

  const deleteHabit = async (habitId) => {
    const wasLastHabit = habits.length === 1;
    await supabase.from('habits').delete().eq('id', habitId);
    setHabitToDelete(null);
    if (wasLastHabit) {
      await supabase.from('check_ins').delete().eq('user_name', currentUser);
    }
    await loadHabits();
    await loadTodayChecks();
    await loadDayData();
  };

  const toggleCheck = async (habitId, currentlyDone) => {
    const key = `habit-${habitId}`;
    setCheckingKey(key);
    try {
      const today = todayStr();
      if (currentlyDone) {
        await supabase.from('check_ins').delete().eq('habit_id', habitId).eq('user_name', currentUser).eq('date', today);
      } else {
        await supabase.from('check_ins').insert({ habit_id: habitId, user_name: currentUser, date: today });
      }
      await loadTodayChecks();
      await loadDayData();
    } finally {
      setCheckingKey(null);
    }
  };

  const toggleCheckForDate = async (habitId, dateKey, currentlyDone) => {
    if (dateKey > todayStr()) return;
    const key = `habit-${habitId}-${dateKey}`;
    setCheckingKey(key);
    try {
      if (currentlyDone) {
        await supabase.from('check_ins').delete().eq('habit_id', habitId).eq('user_name', currentUser).eq('date', dateKey);
      } else {
        await supabase.from('check_ins').insert({ habit_id: habitId, user_name: currentUser, date: dateKey });
      }
      await loadTodayChecks();
      await loadDayData();
    } finally {
      setCheckingKey(null);
    }
  };

  const getFirstEntryDate = useCallback((checkInsByDate, user) => {
    const dates = Object.keys(checkInsByDate).filter(
      (d) => checkInsByDate[d][user] && checkInsByDate[d][user].length > 0
    );
    return dates.length === 0 ? null : dates.sort()[0];
  }, []);

  const getFirstCompletedDate = useCallback((checkInsByDate, user, totalHabits) => {
    if (totalHabits === 0) return null;
    const dates = Object.keys(checkInsByDate).filter(
      (d) => checkInsByDate[d][user] && checkInsByDate[d][user].length === totalHabits
    );
    return dates.length === 0 ? null : dates.sort()[0];
  }, []);

  const getDayStatus = (dateKey) => {
    const { habitsByUser, checkInsByDate } = dayData;
    const today = todayStr();
    if (dateKey > today) return 'future';

    const u = historyRange;
    const habs = habitsByUser[u] || [];
    const total = habs.length;
    if (total === 0) return 'beforeFirst';
    const firstEntry = getFirstEntryDate(checkInsByDate, u);
    if (!firstEntry) return 'beforeFirst';
    if (dateKey < firstEntry) return 'beforeFirst';
    const done = (checkInsByDate[dateKey] && checkInsByDate[dateKey][u]) || [];
    if (done.length === total) return 'success';
    if (done.length > 0) return 'partial';
    const skipIndex = getSkipIndexInWeek(dateKey, checkInsByDate, u, firstEntry);
    if (skipIndex >= 0) return skipIndex <= 1 ? 'skip' : 'fail';
    return 'fail';
  };

  const getPopupContent = (dateKey) => {
    const { habitsByUser, checkInsByDate } = dayData;
    const u = historyRange;
    const habs = habitsByUser[u] || [];
    const doneIds = (checkInsByDate[dateKey] && checkInsByDate[dateKey][u]) || [];
    return habs.map((h) => ({ user: u, habitId: h.id, habit: h.name, done: doneIds.includes(h.id) }));
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
                <label>Criar senha (apenas números)</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))} placeholder="Senha numérica" autoComplete="new-password" />
                <label>Confirmar senha</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, ''))} placeholder="Repita a senha" autoComplete="new-password" />
              </>
            ) : (
              <>
                <label>Senha (apenas números)</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))} placeholder="Senha numérica" autoComplete="current-password" />
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
                    <button type="button" className="habitDelete" onClick={() => setHabitToDelete({ id: habit.id, name: habit.name })} aria-label="Remover hábito">×</button>
                    <span className="habitName">{habit.name}</span>
                    <div className="habitRowActions">
                      <button type="button" className={`habitCheck ${done ? 'done' : ''} ${checkingKey === `habit-${habit.id}` ? 'loading' : ''}`} onClick={() => toggleCheck(habit.id, done)} disabled={!!checkingKey} aria-label={done ? 'Desmarcar' : 'Marcar'}>
                        {checkingKey === `habit-${habit.id}` ? <span className="habitCheckSpinner" aria-hidden /> : (done ? '✓' : '')}
                      </button>
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
            {['Igor', 'Vinicius'].map((r) => (
              <button key={r} type="button" className={`historyTab ${historyRange === r ? 'active' : ''}`} onClick={() => setHistoryRange(r)}>{r}</button>
            ))}
          </div>
          <div className="streakBox">
            <div className="streakNumberWrap">
              <span className="streakFlame" aria-hidden>🔥</span>
              <span className="streakNumber">{streak}</span>
            </div>
            <div className="streakLabel">dias de streak</div>
            <div className="streakRule">Até 2 dias sem marcar por semana não quebram a streak.</div>
          </div>
          <div className="calendarWrap">
            {historyLoading ? (
              <div className="calendarLoading" aria-busy="true">
                <span className="calendarLoadingSpinner" aria-hidden />
                <span>Carregando…</span>
              </div>
            ) : (
              <>
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
                    const inStreak = streakDateKeys.has(key);
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`calendarDay ${isOtherMonth ? 'otherMonth' : ''} ${isToday ? 'today' : ''} bubble${status.charAt(0).toUpperCase() + status.slice(1)} ${inStreak ? 'inStreak' : ''}`}
                        onClick={() => setSelectedDay(key)}
                      >
                        <span className="calendarDayNum">{d.getDate()}</span>
                        {inStreak && <span className="calendarDayFlame" aria-hidden>🔥</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
            <ul className="popupHabits">
              {getPopupContent(selectedDay).map((line, i) => {
                const editable = line.user === currentUser && canEditDay(selectedDay);
                return (
                  <li key={i} className={`popupHabitRow ${line.done ? 'done' : 'notDone'}`}>
                    <span className="popupHabitName">{line.habit}</span>
                    {editable ? (
                      <button type="button" className={`habitCheck ${line.done ? 'done' : ''} ${checkingKey === `habit-${line.habitId}-${selectedDay}` ? 'loading' : ''}`} onClick={() => toggleCheckForDate(line.habitId, selectedDay, line.done)} disabled={!!checkingKey} aria-label={line.done ? 'Desmarcar' : 'Marcar'}>
                        {checkingKey === `habit-${line.habitId}-${selectedDay}` ? <span className="habitCheckSpinner" aria-hidden /> : (line.done ? '✓' : '')}
                      </button>
                    ) : (
                      <span className="popupHabitCheckOnly" aria-hidden>{line.done ? '✓' : '○'}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
