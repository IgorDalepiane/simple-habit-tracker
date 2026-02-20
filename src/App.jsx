import { useState, useEffect, useCallback } from 'react';
import supabase from './utils/supabase';

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

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  const today = todayStr();
  if (iso === today) return 'Hoje';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr =
    yesterday.getFullYear() +
    '-' +
    String(yesterday.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(yesterday.getDate()).padStart(2, '0');
  if (iso === yStr) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function App() {
  const [hasConfig, setHasConfig] = useState(true);
  const [habits, setHabits] = useState([]);
  const [currentUser, setCurrentUser] = useState('eu');
  const [historyRange, setHistoryRange] = useState('eu');
  const [todayChecks, setTodayChecks] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const configOk = url && key;

  const ensureHabits = useCallback(async () => {
    const { data } = await supabase.from('habits').select('id').limit(1);
    if (data && data.length > 0) return;
    await supabase.from('habits').insert([
      { name: 'Hábito 1', sort_order: 0 },
      { name: 'Hábito 2', sort_order: 1 },
    ]);
  }, []);

  const loadHabits = useCallback(async () => {
    const { data } = await supabase
      .from('habits')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true });
    setHabits((data || []).slice(0, 2));
  }, []);

  const loadTodayChecks = useCallback(async () => {
    const today = todayStr();
    const { data } = await supabase
      .from('check_ins')
      .select('habit_id')
      .eq('user_name', currentUser)
      .eq('date', today);
    const doneIds = {};
    (data || []).forEach((r) => {
      doneIds[r.habit_id] = true;
    });
    setTodayChecks(doneIds);
  }, [currentUser]);

  const loadHistory = useCallback(async () => {
    let q = supabase
      .from('check_ins')
      .select('date, user_name, habits(name)')
      .order('date', { ascending: false })
      .limit(60);
    if (historyRange === 'eu') q = q.eq('user_name', 'eu');
    else if (historyRange === 'amigo') q = q.eq('user_name', 'amigo');
    const { data: rows } = await q;
    const byDate = {};
    (rows || []).forEach((r) => {
      const d = r.date;
      if (!byDate[d]) byDate[d] = { eu: [], amigo: [] };
      const name = r.habits?.name || 'Hábito';
      byDate[d][r.user_name].push(name);
    });
    const dates = Object.keys(byDate)
      .sort()
      .reverse()
      .slice(0, 30);
    setHistory(dates.map((d) => ({ date: d, ...byDate[d] })));
  }, [historyRange]);

  useEffect(() => {
    setHasConfig(configOk);
  }, [configOk]);

  useEffect(() => {
    if (!configOk) return;
    (async () => {
      setLoading(true);
      await ensureHabits();
      await loadHabits();
      setLoading(false);
    })();
  }, [configOk, ensureHabits, loadHabits]);

  useEffect(() => {
    if (!configOk || habits.length === 0) return;
    loadTodayChecks();
  }, [configOk, currentUser, habits.length, loadTodayChecks]);

  useEffect(() => {
    if (!configOk) return;
    loadHistory();
  }, [configOk, historyRange, loadHistory]);

  const toggleCheck = async (habitId, currentlyDone) => {
    const today = todayStr();
    if (currentlyDone) {
      await supabase
        .from('check_ins')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_name', currentUser)
        .eq('date', today);
    } else {
      await supabase
        .from('check_ins')
        .insert({ habit_id: habitId, user_name: currentUser, date: today });
    }
    loadTodayChecks();
    loadHistory();
  };

  if (!hasConfig) {
    return (
      <div className="app">
        <div className="setup">
          <h1>Configurar Supabase</h1>
          <p>
            Crie um projeto em{' '}
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">
              supabase.com
            </a>
            , copie <code>.env.example</code> para <code>.env</code> e preencha:
          </p>
          <pre>
            <code>
              {`VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable`}
            </code>
          </pre>
          <p>Rode o SQL em <code>supabase/migrations/001_initial.sql</code> no SQL Editor do Supabase.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Hábitos</h1>
        <p className="subtitle">Quem está marcando?</p>
        <div className="userTabs">
          <button
            type="button"
            className={`userTab ${currentUser === 'eu' ? 'active' : ''}`}
            onClick={() => setCurrentUser('eu')}
          >
            Eu
          </button>
          <button
            type="button"
            className={`userTab ${currentUser === 'amigo' ? 'active' : ''}`}
            onClick={() => setCurrentUser('amigo')}
          >
            Amigo
          </button>
        </div>
      </header>

      <main className="main">
        <section className="section">
          <h2>Hoje</h2>
          <div className="habitsList">
            {loading ? (
              <p className="historyEmpty">Carregando…</p>
            ) : habits.length === 0 ? (
              <p className="historyEmpty">Nenhum hábito. Rode a migration no Supabase.</p>
            ) : (
              habits.map((habit) => {
                const done = !!todayChecks[habit.id];
                return (
                  <div key={habit.id} className="habitRow">
                    <span className="habitName">{habit.name}</span>
                    <button
                      type="button"
                      className={`habitCheck ${done ? 'done' : ''}`}
                      onClick={() => toggleCheck(habit.id, done)}
                      aria-label={done ? 'Desmarcar' : 'Marcar como feito'}
                    >
                      {done ? '✓' : ''}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="section">
          <h2>Histórico</h2>
          <div className="historyTabs">
            <button
              type="button"
              className={`historyTab ${historyRange === 'eu' ? 'active' : ''}`}
              onClick={() => setHistoryRange('eu')}
            >
              Meus checks
            </button>
            <button
              type="button"
              className={`historyTab ${historyRange === 'amigo' ? 'active' : ''}`}
              onClick={() => setHistoryRange('amigo')}
            >
              Amigo
            </button>
            <button
              type="button"
              className={`historyTab ${historyRange === 'all' ? 'active' : ''}`}
              onClick={() => setHistoryRange('all')}
            >
              Todos
            </button>
          </div>
          <div className="historyContent">
            {history.length === 0 ? (
              <p className="historyEmpty">Nenhum check ainda.</p>
            ) : (
              history.map(({ date, eu = [], amigo = [] }) => {
                const showEu = historyRange === 'all' || historyRange === 'eu';
                const showAmigo = historyRange === 'all' || historyRange === 'amigo';
                const parts = [];
                if (showEu && eu.length) parts.push(`Eu: ${eu.join(', ')}`);
                if (showAmigo && amigo.length) parts.push(`Amigo: ${amigo.join(', ')}`);
                const line = parts.length ? parts.join(' · ') : '—';
                return (
                  <div key={date} className="historyDay">
                    <span className="date">{formatDate(date)}</span>
                    <span className="checks">{line}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
