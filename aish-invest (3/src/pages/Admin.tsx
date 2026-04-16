import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogOut, Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';

interface AIQuery {
  id: string;
  question: string;
  response: string;
  timestamp: any;
  userId: string;
}

export default function Admin() {
  const [queries, setQueries] = useState<AIQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser || auth.currentUser.email !== 'aish8512@gmail.com') {
      window.location.href = '/';
      return;
    }

    const q = query(collection(db, 'aiQueries'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const queryData: AIQuery[] = [];
      snapshot.forEach((doc) => {
        queryData.push({ id: doc.id, ...doc.data() } as AIQuery);
      });
      setQueries(queryData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching queries:", err);
      setError('Failed to load queries. Check permissions.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this query?')) {
      try {
        await deleteDoc(doc(db, 'aiQueries', id));
      } catch (err) {
        console.error("Error deleting query:", err);
        alert("Failed to delete query.");
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
              <p className="text-slate-500">Manage AI Assistant Queries</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-8 border border-red-100">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">Date</th>
                  <th className="p-4 font-semibold text-slate-600">Question</th>
                  <th className="p-4 font-semibold text-slate-600">AI Response</th>
                  <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No queries found.
                    </td>
                  </tr>
                ) : (
                  queries.map((q) => (
                    <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-500 whitespace-nowrap align-top">
                        {q.timestamp?.toDate().toLocaleString() || 'N/A'}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-800 align-top max-w-xs">
                        {q.question}
                      </td>
                      <td className="p-4 text-sm text-slate-600 align-top max-w-md">
                        <div className="line-clamp-3 hover:line-clamp-none cursor-pointer">
                          {q.response}
                        </div>
                      </td>
                      <td className="p-4 align-top text-right">
                        <button 
                          onClick={() => handleDelete(q.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Query"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
