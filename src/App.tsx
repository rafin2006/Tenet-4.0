m 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';

import { auth, db, googleProvider } from './firebase';
import { SCHEDULE, SUBJ, LINKS, ScheduleRow, ScheduleEntry } from './data';

