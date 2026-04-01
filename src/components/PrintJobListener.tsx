import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function PrintJobListener() {
  const { userData } = useAuth();
  const [isAgentOnline, setIsAgentOnline] = useState(false);

  useEffect(() => {
    // Only run this listener on the Cashier/Admin PC
    if (!userData || (userData.role !== 'admin' && userData.role !== 'cashier')) return;

    // Health check for the agent
    const checkAgent = async () => {
      try {
        const res = await fetch('http://localhost:17321/health');
        if (res.ok && !isAgentOnline) {
          setIsAgentOnline(true);
          // When agent comes online, try to process all pending jobs
          processPendingJobs();
        } else if (!res.ok && isAgentOnline) {
          setIsAgentOnline(false);
        }
      } catch (e) {
        if (isAgentOnline) setIsAgentOnline(false);
      }
    };

    const processPendingJobs = async () => {
      const q = query(collection(db, 'printJobs'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (document) => {
        await printJob(document.id, document.data());
      });
    };

    const printJob = async (jobId: string, job: any) => {
      try {
        const res = await fetch('http://localhost:17321/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job)
        });
        
        if (res.ok) {
          await updateDoc(doc(db, 'printJobs', jobId), { status: 'completed' });
          toast.success(`Pedido da Mesa ${job.mesa} impresso com sucesso!`);
        } else {
          console.error(`Failed to print job ${jobId}`);
        }
      } catch (e) {
        console.error(`Error printing job ${jobId}`, e);
      }
    };

    const interval = setInterval(checkAgent, 5000);
    checkAgent();

    const q = query(collection(db, 'printJobs'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' && isAgentOnline) {
          await printJob(change.doc.id, change.doc.data());
        }
      });
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [userData, isAgentOnline]);

  return null;
}
