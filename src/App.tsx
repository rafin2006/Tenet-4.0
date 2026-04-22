import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';

import { auth, db, googleProvider } from './firebase';
import { SCHEDULE, SUBJ, LINKS, ScheduleRow, ScheduleEntry } from './data';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setCompletedTasks([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const docRef = doc(db, 'progress', user.uid);
    const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompletedTasks(docSnap.data().completedTasks || []);
      } else {
        setCompletedTasks([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const toggleTask = async (day: number, subjectIndex: number) => {
    if (!user) {
      alert("Please login to save progress.");
      return;
    }
    const taskId = `${day}-${subjectIndex}`;
    const isCompleted = completedTasks.includes(taskId);
    
    const newTasks = isCompleted 
      ? completedTasks.filter(id => id !== taskId)
      : [...completedTasks, taskId];
      
    // Optimistic update
    setCompletedTasks(newTasks);

    try {
      const docRef = doc(db, 'progress', user.uid);
      await setDoc(docRef, {
        completedTasks: newTasks,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Failed to update task", error);
      // Revert on failure
      setCompletedTasks(completedTasks);
    }
  };

  const resetProgress = async () => {
    if (!user) return;
    if (!window.confirm('Reset all progress? This cannot be undone.')) return;
    
    try {
      const docRef = doc(db, 'progress', user.uid);
      await setDoc(docRef, {
        completedTasks: [],
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Failed to reset progress", error);
    }
  };

  // Calculate progress
  let totalTasks = 0;
  let doneTasks = 0;
  const subjectProgress: Record<string, { total: number; done: number }> = {};

  SCHEDULE.forEach((row) => {
    const day = row[0];
    [row[3], row[4], row[5]].forEach((sub, i) => {
      if (!sub) return;
      const name = sub[0];
      const taskId = `${day}-${i}`;
      
      if (!subjectProgress[name]) {
        subjectProgress[name] = { total: 0, done: 0 };
      }
      
      subjectProgress[name].total++;
      totalTasks++;
      
      if (completedTasks.includes(taskId)) {
        subjectProgress[name].done++;
        doneTasks++;
      }
    });
  });

  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const renderCell = (entry: ScheduleEntry, day: number, subjectIndex: number) => {
    if (!entry) {
      return (
        <div className="flex-1 flex items-center justify-center p-[10px_14px] text-[1.1rem] text-[#1f2b45] min-h-[60px]">
          —
        </div>
      );
    }

    const [name, ch] = entry;
    const subjData = SUBJ[name];
    if (!subjData) return null;
    
    const { cls, short } = subjData;
    const taskId = `${day}-${subjectIndex}`;
    const isDone = completedTasks.includes(taskId);

    const renderLink = (chapter: number | string) => {
      const url = LINKS[subjData.key]?.[chapter as number];
      if (url) {
        return (
          <a key={chapter} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-[5px] text-[0.8rem] font-semibold text-[var(--text)] no-underline transition-colors duration-150 hover:text-white">
            <span className={`flex items-center justify-center w-[18px] h-[18px] rounded-[4px] text-[0.55rem] shrink-0 opacity-75 ${cls}`}>▶</span>
            Ch.{chapter}
          </a>
        );
      }
      return <span key={chapter} className="text-[0.8rem] font-semibold text-[var(--muted)]">Ch.{chapter}</span>;
    };

    return (
      <div className={`flex-1 relative flex flex-col justify-center gap-2 p-3 sm:p-[10px_12px] transition-colors duration-200 ${isDone ? 'bg-[var(--green-bg)]' : ''}`}>
        {isDone && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--green)]"></div>}
        <div className="flex items-center justify-between gap-[6px]">
          <span className={`inline-flex items-center gap-1 px-[7px] py-[2px] rounded-[20px] text-[0.6rem] font-extrabold tracking-[0.3px] uppercase ${cls} ${isDone ? 'opacity-55' : ''}`}>
            {short}
          </span>
          <button 
            onClick={() => toggleTask(day, subjectIndex)}
            className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 border-[1.5px] border-[var(--border)] bg-transparent text-[var(--muted)] text-[0.7rem] cursor-pointer transition-all duration-150 font-['Syne'] font-bold hover:border-[var(--green)] hover:text-[var(--green)] ${isDone ? '!bg-[var(--green)] !border-[var(--green)] !text-white' : ''}`}
            title={isDone ? "Mark as pending" : "Mark as done"}
          >
            ✓
          </button>
        </div>
        <div className={`flex flex-wrap gap-2 ${isDone ? 'opacity-45 line-through decoration-[rgba(34,197,94,0.4)]' : ''}`}>
          {Array.isArray(ch) ? ch.map(c => renderLink(c)) : renderLink(ch)}
        </div>
      </div>
    );
  };

  const renderDay = (row: ScheduleRow) => {
    const [day, , weekday, s1, s2, s3, isExtra] = row;

    return (
      <div key={day} className={`flex flex-col sm:flex-row bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-[1px] hover:border-[#2e3d60] ${isExtra ? 'border-[rgba(251,191,36,0.3)]' : ''}`}>
        <div className="flex sm:flex-col items-center sm:justify-center justify-between p-3 sm:p-[12px_14px] w-full sm:w-[110px] bg-[var(--surface2)] border-b sm:border-b-0 sm:border-r border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
            <div className="text-[0.95rem] font-bold">
              Day {day}
            </div>
            <div className="text-[0.65rem] sm:text-[0.58rem] uppercase tracking-[1.5px] text-[var(--muted)]">{weekday}</div>
          </div>
          {isExtra && (
            <span className="inline-block text-[0.55rem] bg-[rgba(251,191,36,0.15)] text-[#fbbf24] px-[7px] py-[2px] rounded-[20px] font-extrabold tracking-[0.5px]">ADDED</span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row flex-1 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {renderCell(s1, day, 0)}
          {renderCell(s2, day, 1)}
          {renderCell(s3, day, 2)}
        </div>
      </div>
    );
  };

  const aprSchedule = SCHEDULE.filter(r => r[1].startsWith('Apr'));
  const maySchedule = SCHEDULE.filter(r => r[1].startsWith('May'));

  return (
    <div className="max-w-[1160px] mx-auto">
      {/* Header & Auth */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-[clamp(2.2rem,6vw,3.6rem)] font-extrabold tracking-[-2px] bg-gradient-to-br from-[#38bdf8] via-[#a78bfa] to-[#fb923c] bg-clip-text text-transparent mb-2">
            Tenet 4.0
          </h1>
          <div className="inline-block text-[0.8rem] font-extrabold tracking-[4px] uppercase text-[#38bdf8] border border-[rgba(56,189,248,0.3)] px-4 py-1 rounded-full mb-2.5 bg-[rgba(56,189,248,0.06)]">
            HSC 26
          </div>
          <p className="text-[var(--muted)] text-[0.82rem] tracking-[2px] uppercase">33-Day Schedule</p>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Circular Progress */}
          <div className="w-24 h-24 relative flex flex-col items-center justify-center bg-[var(--surface)] p-3 rounded-2xl border border-[var(--border)] shadow-lg">
            <CircularProgressbar 
              value={overallPct} 
              text={`${overallPct}%`}
              styles={buildStyles({
                pathColor: `rgba(34, 197, 94, ${overallPct / 100})`,
                textColor: '#fff',
                trailColor: 'var(--surface2)',
                textSize: '24px',
              })}
            />
            <div className="absolute -bottom-2 bg-[var(--surface2)] px-2 py-0.5 rounded-full text-[0.55rem] font-bold text-[var(--muted)] border border-[var(--border)]">
              TOTAL
            </div>
          </div>

          {/* Auth Button */}
          <div className="flex flex-col items-end gap-2">
            {user ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 mb-2">
                  <img src={user.photoURL || ''} alt="avatar" className="w-8 h-8 rounded-full border border-[var(--border)]" />
                  <span className="text-sm font-semibold">{user.displayName}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-400 bg-red-400/10 rounded-lg border border-red-400/20 hover:bg-red-400/20 transition-colors"
                >
                  <LogOut size={14} /> Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                <LogIn size={16} /> Login to Track
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-2.5 mx-auto mb-[26px] p-[16px_24px] bg-[var(--surface)] border border-[var(--border)] rounded-[14px] max-w-[960px]">
        {Object.values(SUBJ).map(s => (
          <div key={s.key} className="flex items-center gap-[7px] text-[0.73rem] font-bold tracking-[0.4px]">
            <div className="w-[9px] h-[9px] rounded-full" style={{ background: s.color }}></div>
            {s.short}
          </div>
        ))}
      </div>

      {/* Progress Panel */}
      <div className="max-w-[960px] mx-auto mb-[28px] bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-[22px_24px]">
        <div className="flex items-center justify-between mb-[18px]">
          <span className="text-[0.68rem] font-extrabold tracking-[3px] uppercase text-[var(--muted)]">📊 Progress Tracker</span>
          {user && (
            <button onClick={resetProgress} className="flex items-center gap-1 font-['Syne'] text-[0.63rem] font-bold tracking-[1px] uppercase text-[var(--muted)] bg-transparent border border-[var(--border)] rounded-md px-[10px] py-1 cursor-pointer transition-all duration-150 hover:text-red-400 hover:border-red-400">
              <RefreshCw size={10} /> Reset All
            </button>
          )}
        </div>
        
        <div className="mb-[18px]">
          <div className="flex items-center justify-between mb-[7px]">
            <div className="text-[0.78rem] font-bold">Overall Completion</div>
            <div className="flex items-center gap-2.5">
              <span className="text-[0.68rem] text-[var(--muted)] font-['Space_Mono']">{doneTasks}/{totalTasks}</span>
              <span className="text-[0.75rem] font-extrabold font-['Space_Mono'] text-[#22c55e] bg-[rgba(34,197,94,0.12)] px-[9px] py-[2px] rounded-lg">{overallPct}%</span>
            </div>
          </div>
          <div className="h-2 bg-[var(--surface2)] rounded-full overflow-hidden border border-[var(--border)]">
            <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#38bdf8] via-[#a78bfa] to-[#22c55e]" style={{ width: `${overallPct}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Object.entries(SUBJ).map(([name, s]) => {
            const stats = subjectProgress[name] || { total: 0, done: 0 };
            const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            return (
              <div key={s.key} className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-[10px_12px]">
                <div className="flex items-center justify-between mb-[7px]">
                  <span className={`text-[0.58rem] font-extrabold tracking-[0.3px] px-[7px] py-[2px] rounded-xl uppercase ${s.cls}`}>{s.short}</span>
                  <span className="text-[0.68rem] font-extrabold font-['Space_Mono']" style={{ color: s.color }}>{pct}%</span>
                </div>
                <div className="h-[5px] bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)] mb-[5px]">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }}></div>
                </div>
                <div className="text-[0.58rem] text-[var(--muted)] font-['Space_Mono'] text-right">{stats.done}/{stats.total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Theta Bhaiya Link */}
      <div className="max-w-[1160px] mx-auto mb-[26px] text-center">
        <a href="https://www.youtube.com/@thetabhaiya_004" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 text-[0.88rem] font-extrabold tracking-[0.5px] text-[#ff5555] no-underline bg-[rgba(255,68,68,0.07)] border border-[rgba(255,68,68,0.22)] px-6 py-2.5 rounded-xl transition-all duration-200 hover:bg-[rgba(255,68,68,0.14)] hover:border-[rgba(255,68,68,0.45)] hover:-translate-y-[1px]">
          <span className="w-[26px] h-[26px] bg-[#ff0000] rounded-md inline-flex items-center justify-center text-[0.6rem] text-white font-black shrink-0">▶</span>
          Theta Bhaiya
          <span className="text-[rgba(255,68,68,0.5)] text-[0.75rem]">↗</span>
        </a>
      </div>

      {/* Calendar */}
      <div className="max-w-[1160px] mx-auto mb-11">
        <div className="hidden sm:flex mb-2 pb-2 border-b border-[var(--border)]">
          <div className="w-[110px] shrink-0 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Day</div>
          <div className="flex-1 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Subject 1</div>
          <div className="flex-1 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Subject 2</div>
          <div className="flex-1 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Subject 3</div>
        </div>
        <div className="grid gap-[10px]">
          {aprSchedule.map(renderDay)}
        </div>
      </div>

      <div className="max-w-[1160px] mx-auto mb-11">
        <div className="hidden sm:flex mb-2 pb-2 border-b border-[var(--border)]">
          <div className="w-[110px] shrink-0 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Day</div>
          <div className="flex-1 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Subject 1</div>
          <div className="flex-1 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Subject 2</div>
          <div className="flex-1 px-[14px] py-[2px] text-[0.58rem] uppercase tracking-[2px] text-[var(--muted)] font-bold">Subject 3</div>
        </div>
        <div className="grid gap-[10px]">
          {maySchedule.map(renderDay)}
        </div>
      </div>
    </div>
  );
}
